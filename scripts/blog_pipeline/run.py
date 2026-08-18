#!/usr/bin/env python3
"""
Leey blog multi-agent pipeline (free/local-first).

Stages (agents):
  1 research  — season, local towns, market angle, sources
  2 topic     — pick/refine angle from research + topics bank
  3 assets    — image agents: prefer live listing photos, then color web photos (no B&W/archival)
  3a image-search  — candidate pool only (listings + web)
  3b image-download — download/filter/save final assets
  4 write     — bilingual draft (free LLM or human template)
  5 polish    — SEO + anti-AI humanizer pass
  6 publish   — merge into posts.json, commit, ship

Usage:
  python3 scripts/blog_pipeline/run.py                 # full pipeline for today
  python3 scripts/blog_pipeline/run.py --stage research
  python3 scripts/blog_pipeline/run.py --stage publish
  python3 scripts/blog_pipeline/run.py --date 2026-08-18
  python3 scripts/blog_pipeline/run.py --force          # rewrite today's draft
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import re
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(os.environ.get("LEEY_ROOT", Path(__file__).resolve().parents[2]))
POSTS_PATH = ROOT / "public/data/blog/posts.json"
TOPICS_PATH = ROOT / "data/blog/topics.json"
WORK_ROOT = ROOT / "data/blog/pipeline"
ASSETS_PUB = ROOT / "public/assets/blog"
UA = "LeeyBlogPipeline/2.0 (+https://leeyrealty.com; free-edu-use)"

SOUTH_GA = [
    "Valdosta",
    "Hahira",
    "Adel",
    "Sparks",
    "Lenox",
    "Ray City",
    "Moultrie",
    "Thomasville",
    "Nashville",
    "Tifton",
]

AI_BANS = [
    r"\bdelve\b",
    r"\blandscape\b",
    r"\btestament\b",
    r"\bseamless\b",
    r"\bcutting-edge\b",
    r"\bgame-?changer\b",
    r"\bunlock\b",
    r"\belevate your\b",
    r"\bin today's world\b",
    r"\bit's important to note\b",
    r"\bmoreover\b",
    r"\bfurthermore\b",
    r"\bin conclusion\b",
    r"\bnestled\b",
    r"\bvibrant community\b",
    r"\bcomprehensive guide\b",
]


def log(msg: str) -> None:
    print(msg, flush=True)


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def workdir(d: str) -> Path:
    p = WORK_ROOT / d
    p.mkdir(parents=True, exist_ok=True)
    (p / "images").mkdir(exist_ok=True)
    return p


def save_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def load_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def http_get(url: str, timeout: int = 40, retries: int = 3) -> bytes:
    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:
            last_err = e
            log(f"[http] try {attempt}/{retries} fail {url[:90]}: {e}")
            time.sleep(min(1.5 * attempt, 5))
    raise RuntimeError(f"http_get failed after {retries}: {last_err}")


def http_get_json(url: str, timeout: int = 40, retries: int = 3) -> Any:
    return json.loads(http_get(url, timeout=timeout, retries=retries).decode("utf-8", "replace"))


def slugify(s: str, n: int = 72) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")[:n] or "note"


def scrub_ai(text: str) -> str:
    out = text or ""
    for pat in AI_BANS:
        out = re.sub(pat, "", out, flags=re.I)
    out = out.replace("—", " - ").replace("–", "-")
    out = re.sub(r"[ \t]{2,}", " ", out)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()


def append_log(wd: Path, event: str, detail: Any = None) -> None:
    path = wd / "pipeline.log.jsonl"
    row = {"at": utc_now(), "event": event, "detail": detail}
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


def try_llm(
    prompt: str,
    models: list[str] | None = None,
    *,
    min_chars: int = 120,
    attempts_per_model: int = 2,
) -> str | None:
    """Try free/local models with per-model retries."""
    models = models or ["free-then-local", "free", "local", "background"]
    for model in models:
        for attempt in range(1, attempts_per_model + 1):
            try:
                r = subprocess.run(
                    ["hermes", "chat", "-q", prompt, "--model", model],
                    capture_output=True,
                    text=True,
                    timeout=240,
                    cwd=str(ROOT),
                )
                out = (r.stdout or "").strip()
                if r.returncode == 0 and len(out) >= min_chars:
                    log(f"[llm] ok model={model} attempt={attempt} chars={len(out)}")
                    return out
                log(
                    f"[llm] weak model={model} attempt={attempt} "
                    f"code={r.returncode} chars={len(out)}"
                )
            except Exception as e:
                log(f"[llm] fail model={model} attempt={attempt}: {e}")
            time.sleep(0.6 * attempt)
    return None


def extract_json_obj(text: str) -> dict | None:
    if not text:
        return None
    # fenced json
    fence = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", text, re.I)
    candidates = []
    if fence:
        candidates.append(fence.group(1))
    # largest balanced-ish object: from first { to last }
    if "{" in text and "}" in text:
        candidates.append(text[text.find("{") : text.rfind("}") + 1])
    # also any medium objects
    for m in re.finditer(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", text):
        if len(m.group(0)) > 200:
            candidates.append(m.group(0))
    for raw in candidates:
        cleaned = raw
        # common LLM damage
        cleaned = cleaned.replace("\u201c", '"').replace("\u201d", '"').replace("\u2019", "'")
        cleaned = re.sub(r",\s*}", "}", cleaned)
        cleaned = re.sub(r",\s*]", "]", cleaned)
        for attempt in (raw, cleaned):
            try:
                obj = json.loads(attempt)
                if isinstance(obj, dict) and (
                    "bodyEs" in obj or "titleEs" in obj or "headline_angle" in obj
                ):
                    return obj
            except Exception:
                continue
    return None


def llm_json(
    prompt: str,
    *,
    required_any: list[str],
    models: list[str] | None = None,
    max_rounds: int = 3,
    wd: Path | None = None,
    tag: str = "json",
) -> dict | None:
    """Ask LLM for JSON; on parse failure run correction rounds with free/local models."""
    models = models or ["free-then-local", "free", "local", "background"]
    last_raw = None
    for round_i in range(1, max_rounds + 1):
        if round_i == 1:
            p = prompt
        else:
            p = (
                "Tu respuesta anterior NO fue JSON válido o le faltaban campos. "
                "Devuelve SOLO un objeto JSON válido (sin markdown, sin ```), "
                f"incluyendo al menos uno de: {required_any}. "
                "Corrige y compacta.\n\n"
                f"Pedido original:\n{prompt[:3500]}\n\n"
                f"Respuesta rota (recorta si hace falta):\n{(last_raw or '')[:2500]}"
            )
        raw = try_llm(p, models=models if round_i == 1 else list(reversed(models)))
        last_raw = raw
        if wd is not None and raw:
            (wd / f"{tag}.round{round_i}.txt").write_text(raw, encoding="utf-8")
        obj = extract_json_obj(raw or "")
        if obj and any(k in obj for k in required_any):
            if wd is not None:
                append_log(wd, f"{tag}.json_ok", {"round": round_i, "keys": list(obj.keys())[:20]})
            return obj
        log(f"[llm_json] {tag} round {round_i}/{max_rounds} parse/fields failed")
        if wd is not None:
            append_log(wd, f"{tag}.json_fail", {"round": round_i})
    return None


def validate_post(final: dict) -> dict[str, bool]:
    body_es = final.get("bodyEs") or ""
    body_en = final.get("bodyEn") or ""
    meta_es = final.get("seoDescriptionEs") or ""
    meta_en = final.get("seoDescriptionEn") or ""
    title_es = final.get("titleEs") or ""
    title_en = final.get("titleEn") or ""
    cover = (final.get("cover") or {}).get("src") or ""
    banned_hit = any(re.search(p, body_es + "\n" + body_en, re.I) for p in AI_BANS)
    return {
        "has_cover": bool(cover),
        "has_body_es": len(body_es) > 400,
        "has_body_en": len(body_en) > 400,
        "has_title_es": len(title_es) >= 12,
        "has_title_en": len(title_en) >= 12,
        "has_meta_es": 80 <= len(meta_es) <= 180,
        "has_meta_en": 80 <= len(meta_en) <= 180,
        "has_figure_marker": "{{figure:0}}" in body_es and "{{figure:0}}" in body_en,
        "has_signoff": "Leey" in body_es[-40:] and "Leey" in body_en[-40:],
        "no_em_dash_spam": body_es.count("—") < 3 and body_en.count("—") < 3,
        "no_ai_bans": not banned_hit,
        "has_tags": isinstance(final.get("tags"), list) and len(final.get("tags") or []) >= 3,
    }


# ── Stage 1: Research ─────────────────────────────────────────────────────

def stage_research(day: str, force: bool = False) -> dict:
    wd = workdir(day)
    out_path = wd / "research.json"
    if out_path.exists() and not force:
        log("[research] reuse existing")
        return load_json(out_path)

    month = int(day[5:7])
    season = (
        "spring pollen and yard cleanup"
        if month in (3, 4, 5)
        else "hot humid summer and afternoon storms"
        if month in (6, 7, 8)
        else "fall listings and school-year moves"
        if month in (9, 10, 11)
        else "winter mild moves and holiday timing"
    )

    # Free local signals: existing listings feed + blog history
    listings = load_json(ROOT / "public/data/blog/posts.json", {"posts": []})
    feed = load_json(ROOT / "public/data/listings.json", {"listings": []})
    cities = {}
    for row in feed.get("listings") or []:
        c = row.get("city") or "?"
        cities[c] = cities.get(c, 0) + 1
    top_cities = sorted(cities.items(), key=lambda x: -x[1])[:8]

    # Lightweight free web snippets via DuckDuckGo HTML (no key)
    queries = [
        f"Valdosta GA housing market {day[:4]}",
        f"South Georgia home buying tips {season.split()[0]}",
        "Lowndes County GA real estate trends",
        "South Georgia home selling curb appeal tips",
    ]
    web_notes = []
    for q in queries:
        ok = False
        for attempt in range(1, 4):
            try:
                url = "https://html.duckduckgo.com/html/?" + urllib.parse.urlencode({"q": q})
                html = http_get(url, timeout=25, retries=2).decode("utf-8", "replace")
                texts = re.findall(
                    r'class="result__snippet"[^>]*>(.*?)</a>|<a class="result__a"[^>]*>(.*?)</a>',
                    html,
                    re.I | re.S,
                )
                flat = []
                for a, b in texts:
                    t = re.sub(r"<[^>]+>", " ", a or b or "")
                    t = re.sub(r"\s+", " ", t).strip()
                    if len(t) > 40:
                        flat.append(t[:240])
                web_notes.append({"query": q, "snippets": flat[:5], "attempts": attempt})
                ok = True
                break
            except Exception as e:
                log(f"[research] web try {attempt} fail {q}: {e}")
                time.sleep(attempt)
        if not ok:
            web_notes.append({"query": q, "error": "all attempts failed", "snippets": []})
        time.sleep(0.5)

    # Optional free LLM synthesis with JSON correction rounds
    synth_prompt = f"""You are a local South Georgia real-estate researcher for realtor Leey Hernandez (Valdosta area).
Given season="{season}", inventory city counts={top_cities}, and web snippets={json.dumps(web_notes)[:3500]},
return STRICT JSON only (no markdown):
{{
  "headline_angle": "one concrete angle for tomorrow's blog",
  "why_now": "2 sentences why this matters this week/season",
  "primary_towns": ["Valdosta", "..."],
  "category": "buying|selling|remodel|decor|neighborhoods|market|first_home",
  "keywords_es": ["..."],
  "keywords_en": ["..."],
  "image_queries": ["english search terms for free photos", "..."],
  "claims_to_avoid": ["no fake stats", "..."],
  "sources_notes": "short"
}}
No hype. No invented statistics. Towns only from South Georgia list: {SOUTH_GA}.
"""
    synth = llm_json(
        synth_prompt,
        required_any=["headline_angle", "category", "image_queries"],
        max_rounds=3,
        wd=wd,
        tag="research",
    ) or {}
    if not synth:
        append_log(wd, "research.synth_fallback", True)
        synth = {
            "headline_angle": f"Home tips for {season.split()[0]} in South Georgia",
            "why_now": f"Season context: {season}. Families are still moving around Valdosta and nearby towns.",
            "primary_towns": [c for c, _ in top_cities[:3]] or ["Valdosta", "Hahira", "Tifton"],
            "category": "buying",
            "keywords_es": ["comprar casa Valdosta", "sur de Georgia"],
            "keywords_en": ["buy home Valdosta", "South Georgia realtor"],
            "image_queries": [
                "Valdosta Georgia house exterior",
                "South Georgia porch home",
                "brick ranch house Georgia",
            ],
            "claims_to_avoid": ["no fake appreciation rates", "no invented days on market"],
            "sources_notes": "local inventory + season heuristic",
        }

    research = {
        "date": day,
        "season": season,
        "inventoryCities": top_cities,
        "web": web_notes,
        "web_ok": sum(1 for w in web_notes if w.get("snippets")),
        "synth": synth,
        "createdAt": utc_now(),
    }
    save_json(out_path, research)
    append_log(wd, "research.done", {"web_ok": research["web_ok"], "has_synth": bool(synth)})
    log(f"[research] wrote {out_path} web_ok={research['web_ok']}")
    return research


# ── Stage 2: Topic ─────────────────────────────────────────────────────────

def stage_topic(
    day: str,
    research: dict,
    force: bool = False,
    topic_id: str | None = None,
) -> dict:
    wd = workdir(day)
    out_path = wd / "topic.json"
    if out_path.exists() and not force and not topic_id:
        log("[topic] reuse existing")
        return load_json(out_path)

    topics = load_json(TOPICS_PATH, [])
    posts = load_json(POSTS_PATH, {"posts": []}).get("posts") or []
    used = " ".join(json.dumps(p, ensure_ascii=False) for p in posts).lower()

    base = None
    if topic_id:
        for t in topics:
            if t.get("id") == topic_id:
                base = t
                break
        if not base:
            raise SystemExit(f"[topic] unknown topic_id={topic_id}")
        log(f"[topic] pinned id={topic_id}")
    else:
        scored = []
        for t in topics:
            score = sum(1 for p in posts if t["id"] in json.dumps(p, ensure_ascii=False))
            key = t["angleEs"].split(":")[0].lower()
            if key in used:
                score += 2
            # season boost
            season = (research.get("season") or "").lower()
            blob = (t["angleEs"] + t["angleEn"] + t["category"]).lower()
            if "summer" in season and any(w in blob for w in ("porche", "patio", "yard", "humedad", "paint")):
                score -= 1
            if "spring" in season and any(w in blob for w in ("polen", "porche", "yard", "list")):
                score -= 1
            if "fall" in season and any(w in blob for w in ("list", "precio", "school", "vender")):
                score -= 1
            scored.append((score, t))
        scored.sort(key=lambda x: (x[0], x[1]["id"]))
        base = scored[0][1]

    synth = research.get("synth") or {}
    # When topic is pinned, prefer bank angles over research drift
    prefer_bank = bool(topic_id)
    topic = {
        "id": base["id"],
        "category": base["category"] if prefer_bank else (synth.get("category") or base["category"]),
        "areas": base.get("areas") or synth.get("primary_towns") or ["valdosta"],
        "angleEs": base["angleEs"],
        "angleEn": base["angleEn"],
        "headline_angle": base["angleEs"] if prefer_bank else (synth.get("headline_angle") or base["angleEs"]),
        "why_now": synth.get("why_now") or research.get("season"),
        "keywords_es": base.get("mustInclude") or synth.get("keywords_es") or [],
        "keywords_en": synth.get("keywords_en") or [],
        "image_queries": list(base.get("image_queries") or [])
        or list(synth.get("image_queries") or [])
        or [
            f"{(base.get('areas') or ['Valdosta'])[0]} Georgia house exterior",
            "South Georgia porch home",
            "brick ranch house yard Georgia",
        ],
        "researchDate": day,
        "pinned": prefer_bank,
    }
    # normalize areas to slugs-ish
    topic["areas"] = [
        re.sub(r"[^a-z0-9]+", "-", str(a).lower()).strip("-") for a in topic["areas"]
    ][:4]
    # enrich image queries from topic must-include / angle / named towns
    extra_q = []
    blob = (topic["angleEn"] + " " + topic["angleEs"] + " " + " ".join(topic["areas"])).lower()
    if any(w in blob for w in ("porch", "porche")):
        extra_q += ["southern front porch house", "georgia porch rocking chair home"]
    if any(w in blob for w in ("kitchen", "cocina")):
        extra_q += ["bright kitchen interior residential", "kitchen remodel before after home"]
    if any(w in blob for w in ("offer", "oferta")):
        extra_q += ["house for sale yard sign", "couple touring home interior"]
    # Prefer place-name photo searches for neighborhood posts
    for place in ("Valdosta", "Hahira", "Adel", "Sparks", "Tifton", "Moultrie", "Thomasville", "Nashville"):
        if place.lower() in blob:
            extra_q.append(f"{place} Georgia")
            extra_q.append(f"{place} Georgia downtown")
    if any(w in blob for w in ("town", "pueblo", "neighborhood", "zona", "trayecto", "drive")):
        extra_q += [
            "small town Georgia main street",
            "south Georgia residential neighborhood",
            "pine trees residential street Georgia USA",
        ]
    # bank queries first (real place searches), then extras; drop placeholder garbage
    raw_q = list(topic.get("image_queries") or []) + extra_q
    cleaned = []
    junk = ("english search", "...", "search terms", "free photos", "image query")
    for q in raw_q:
        qs = str(q).strip()
        if not qs or len(qs) < 4:
            continue
        if any(j in qs.lower() for j in junk):
            continue
        cleaned.append(qs)
    topic["image_queries"] = list(dict.fromkeys(cleaned))[:12]
    if not topic["image_queries"]:
        topic["image_queries"] = [
            f"{(topic['areas'] or ['valdosta'])[0].replace('-', ' ').title()} Georgia",
            "South Georgia residential neighborhood",
        ]
    save_json(out_path, topic)
    log(f"[topic] {topic['id']} / {topic['category']}")
    return topic


# ── Stage 3: Assets / image agents ─────────────────────────────────────────

def _meta_value(meta: dict, *keys: str) -> str:
    for k in keys:
        v = meta.get(k)
        if isinstance(v, dict):
            v = v.get("value")
        if v:
            return re.sub(r"<[^>]+>", " ", str(v)).strip()
    return ""


def image_is_colorful(path: Path, *, min_chroma: float = 12.0, sample: int = 48) -> bool:
    """Reject grayscale / near-B&W photos. True = keep (color)."""
    try:
        from PIL import Image
    except Exception:
        return True
    try:
        with Image.open(path) as im:
            im = im.convert("RGB")
            im.thumbnail((sample, sample))
            pixels = list(getattr(im, "get_flattened_data", im.getdata)())
        if not pixels:
            return False
        chroma = 0.0
        for r, g, b in pixels:
            mx, mn = max(r, g, b), min(r, g, b)
            chroma += float(mx - mn)
        avg = chroma / len(pixels)
        ok = avg >= min_chroma
        if not ok:
            log(f"[assets] reject B&W/low-color chroma={avg:.1f} {path.name}")
        return ok
    except Exception as e:
        log(f"[assets] color check fail {path.name}: {e}")
        return False


def compress_image_file(path: Path, *, max_edge: int = 1600, max_bytes: int = 1_200_000, quality: int = 82) -> None:
    """Downscale/re-encode large photos so blog assets stay web-friendly."""
    try:
        if path.suffix.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
            return
        if path.stat().st_size <= max_bytes and True:
            # still normalize huge dimensions even if under byte cap slightly over
            pass
        from PIL import Image
        with Image.open(path) as im:
            im = im.convert("RGB")
            if max(im.size) > max_edge or path.stat().st_size > max_bytes:
                im.thumbnail((max_edge, max_edge))
                tmp = path.with_suffix(".tmp.jpg")
                im.save(tmp, "JPEG", quality=quality, optimize=True, progressive=True)
                tmp.replace(path if path.suffix.lower() in (".jpg", ".jpeg") else path.with_suffix(".jpg"))
                # if original was png/webp renamed, remove old if needed
                if path.suffix.lower() not in (".jpg", ".jpeg") and path.exists() and path != tmp:
                    try:
                        # when replaced onto .jpg sibling
                        jpg = path.with_suffix(".jpg")
                        if jpg.exists() and path.exists() and path != jpg:
                            path.unlink(missing_ok=True)
                    except Exception:
                        pass
                log(f"[assets] compressed {path.name} -> {path.with_suffix('.jpg').stat().st_size if path.with_suffix('.jpg').exists() else path.stat().st_size}B")
    except Exception as e:
        log(f"[assets] compress skip {path.name}: {e}")



def topic_visual_brief(topic: dict) -> dict:
    """What the photo must show for this topic (used by vision gate)."""
    tid = (topic.get("id") or "").lower()
    cat = (topic.get("category") or "").lower()
    angle = f"{topic.get('angleEn') or ''} {topic.get('angleEs') or ''} {tid}".lower()
    areas = [str(a).replace("-", " ") for a in (topic.get("areas") or [])]

    if "porch" in tid or "porche" in angle or "porch" in angle:
        return {
            "label": "porch",
            "must_show": "a residential front porch, stoop, veranda, or covered entry with steps/railings/chairs",
            "reject_if": "only a blank exterior wall, pure yard with no porch, kitchen interior, car, document, or unrelated object",
            "keywords": ["porch", "stoop", "veranda", "portico", "front steps", "rocking chair", "entry"],
        }
    if "kitchen" in tid or "cocina" in angle or "kitchen" in angle:
        return {
            "label": "kitchen",
            "must_show": "a home kitchen interior (cabinets, counters, sink, appliances, or kitchen window light)",
            "reject_if": "exterior-only house shot with no kitchen, bathroom, empty room, or unrelated object",
            "keywords": ["kitchen", "cabinets", "counter", "sink", "stove", "refrigerator"],
        }
    if cat == "neighborhoods" or any(k in angle for k in ("valdosta", "hahira", "adel", "zona", "where to start")):
        place = ", ".join(areas) if areas else "the named South Georgia towns"
        return {
            "label": "place",
            "must_show": f"a real outdoor scene clearly associated with {place} (street, downtown, landmark, neighborhood homes)",
            "reject_if": "unrelated city, interior-only, document, car lot, or generic stock with no place cues",
            "keywords": areas + ["downtown", "street", "courthouse", "georgia"],
        }
    if cat in ("buying", "selling") or "offer" in tid or "oferta" in angle:
        return {
            "label": "home_sale",
            "must_show": "a residential house exterior and/or a for-sale context suitable for a home offer article",
            "reject_if": "unrelated commercial building only, document, car dealership, or non-home scene",
            "keywords": ["house", "home", "for sale", "yard", "exterior", "listing"],
        }
    return {
        "label": "home",
        "must_show": "a residential home scene relevant to South Georgia real estate (house exterior, yard, or interior living space)",
        "reject_if": "documents, cars, maps, logos, pure text, or unrelated objects",
        "keywords": ["house", "home", "residential"],
    }


def examine_image_for_topic(path: Path, topic: dict, candidate: dict | None = None) -> tuple[bool, str]:
    """Vision gate: examine the image before accepting it for the topic."""
    brief = topic_visual_brief(topic)
    title = f"{(candidate or {}).get('title') or ''} {(candidate or {}).get('description') or ''}".lower()
    kws = [k.lower() for k in brief.get("keywords") or []]
    meta_hit = any(k in title for k in kws if len(k) >= 4)

    # Strong metadata reject for strict topics
    if brief["label"] == "porch" and any(
        k in title for k in ("kitchen", "bathroom", "floor plan", "map of", "logo", "dealership")
    ) and "porch" not in title and "stoop" not in title and "veranda" not in title:
        return False, "metadata non-porch"

    prompt = (
        "Photo QA for real-estate blog. "
        f"Topic={brief['label']}. MUST show: {brief['must_show']}. "
        f"Reject if: {brief['reject_if']}. "
        f"Title: {(candidate or {}).get('title') or 'unknown'}. "
        'Reply ONLY JSON: {"match":true|false,"what_you_see":"...","reason":"..."}'
    )

    # One fast vision attempt, then one fallback. Short timeouts.
    models = ["free-then-local", "vision"]
    for model in models:
        try:
            r = subprocess.run(
                [
                    "hermes", "chat", "-q", prompt,
                    "--image", str(path),
                    "--model", model,
                    "-Q",
                ],
                capture_output=True,
                text=True,
                timeout=55,
                cwd=str(ROOT),
            )
            out = ((r.stdout or "") + "\n" + (r.stderr or "")).strip()
            # Prefer stdout body if present
            body = (r.stdout or "").strip() or out
            if r.returncode != 0 or len(body) < 8:
                log(f"[vision] weak model={model} code={r.returncode} chars={len(body)} err={(r.stderr or '')[:120]}")
                continue
            out = body
            obj = extract_json_obj(out)
            if not obj:
                m = re.search(r"\{[\s\S]*\}", out)
                if m:
                    try:
                        obj = json.loads(m.group(0))
                    except Exception:
                        obj = None
            if not obj:
                log(f"[vision] unparsed model={model}: {out[:140]}")
                continue
            match = obj.get("match") is True or str(obj.get("match")).lower() == "true"
            reason = str(obj.get("reason") or obj.get("what_you_see") or out[:120])
            log(f"[vision] model={model} match={match} {reason[:100]}")
            return bool(match), reason
        except subprocess.TimeoutExpired:
            log(f"[vision] timeout model={model}")
            continue
        except Exception as e:
            log(f"[vision] fail model={model}: {e}")
            continue

    # Fallback when vision stack is down
    if brief["label"] in ("porch", "kitchen"):
        if meta_hit:
            return True, "vision unavailable; metadata keywords ok"
        return False, "vision unavailable; strict topic needs porch/kitchen cues"
    if meta_hit:
        return True, "vision unavailable; metadata ok"
    return True, "vision unavailable; soft allow"



def looks_archival_or_old(candidate: dict) -> bool:
    """Reject historical/archival/HABS/old scans and B&W labelled media."""
    title = f"{candidate.get('title') or ''} {candidate.get('artist') or ''} {candidate.get('description') or ''}".lower()
    date_raw = str(candidate.get("date") or candidate.get("year") or "")
    blob = f"{title} {date_raw}".lower()

    bad_tokens = (
        "black and white",
        "black-and-white",
        "b&w",
        "b & w",
        "monochrome",
        "grayscale",
        "grey scale",
        "sepia",
        "habs",
        "haer",
        "historic american",
        "historic photo",
        "historical photograph",
        "archival",
        "archive photo",
        "glass plate",
        "daguerre",
        "tintype",
        "nitrate negative",
        "postcard",
        "old photo",
        "vintage photo",
        "circa 18",
        "circa 19",
        "19th century",
        "18th century",
        "civil war",
        "wwii",
        "world war",
        "depression-era",
        "dust bowl",
        "library of congress survey",
        "measured drawing",
        "blueprint",
        "sanborn",
        "stereo view",
        "stereograph",
        "lantern slide",
        "film negative",
        "nara ",
        "national archives",
    )
    if any(t in blob for t in bad_tokens):
        return True

    years = [int(y) for y in re.findall(r"\b(19\d{2}|20[0-2]\d)\b", blob)]
    if years:
        if max(years) < 2015:
            return True
    return False


def download_image(
    url: str,
    dest: Path,
    min_bytes: int = 12000,
    seen_hashes: set | None = None,
    *,
    require_color: bool = True,
) -> bool:
    try:
        data = http_get(url, timeout=45)
        if len(data) < min_bytes:
            return False
        ok_magic = (
            data[:3] == b"\xff\xd8\xff"
            or data[:8] == b"\x89PNG\r\n\x1a\n"
            or data[:4] == b"RIFF"
        )
        if not ok_magic and len(data) < 20000:
            return False
        h = hashlib.sha1(data).hexdigest()
        if seen_hashes is not None and h in seen_hashes:
            log(f"[assets] skip duplicate hash {h[:10]}")
            return False
        dest.write_bytes(data)
        if require_color and not image_is_colorful(dest):
            try:
                dest.unlink(missing_ok=True)
            except Exception:
                pass
            return False
        if seen_hashes is not None:
            seen_hashes.add(h)
        return True
    except Exception as e:
        log(f"[assets] download fail {url[:80]}: {e}")
        return False


def wikimedia_search(query: str, limit: int = 6) -> list[dict]:
    api = "https://commons.wikimedia.org/w/api.php"
    q = f'{query} -HABS -HAER -"black and white" -postcard'
    params = {
        "action": "query",
        "generator": "search",
        "gsrsearch": q,
        "gsrlimit": str(limit),
        "gsrnamespace": "6",
        "prop": "imageinfo",
        "iiprop": "url|extmetadata|mime|size",
        "iiurlwidth": "1600",
        "format": "json",
    }
    url = api + "?" + urllib.parse.urlencode(params)
    data = http_get_json(url)
    pages = (data.get("query") or {}).get("pages") or {}
    out = []
    for _, pg in pages.items():
        info = (pg.get("imageinfo") or [{}])[0]
        mime = info.get("mime") or ""
        if not mime.startswith("image/") or "svg" in mime:
            continue
        meta = info.get("extmetadata") or {}
        license_short = _meta_value(meta, "LicenseShortName")
        artist = _meta_value(meta, "Artist") or "Wikimedia"
        date_meta = _meta_value(meta, "DateTimeOriginal", "DateTime", "DateTimeMetadata")
        desc = _meta_value(meta, "ImageDescription", "ObjectName")
        lic_l = license_short.lower()
        if not any(x in lic_l for x in ("cc0", "public domain", "cc by", "cc-by", "pd")):
            if "cc" not in lic_l and "pd" not in lic_l and "public" not in lic_l:
                continue
        thumb = info.get("thumburl") or info.get("url")
        full = info.get("url")
        if not thumb and not full:
            continue
        cand = {
            "url": thumb or full,
            "full": full or thumb,
            "title": pg.get("title") or query,
            "license": license_short,
            "artist": artist[:120],
            "source": "wikimedia",
            "page": f"https://commons.wikimedia.org/wiki/{urllib.parse.quote(pg.get('title') or '')}",
            "date": date_meta,
            "description": desc[:200],
        }
        if looks_archival_or_old(cand):
            continue
        out.append(cand)
    return out


def openverse_search(query: str, limit: int = 5) -> list[dict]:
    url = "https://api.openverse.org/v1/images/?" + urllib.parse.urlencode(
        {
            "q": query,
            "page_size": str(limit),
            "license": "cc0,pdm,by,by-sa",
            "category": "photograph",
        }
    )
    try:
        data = http_get_json(url, timeout=30)
    except Exception as e:
        log(f"[assets] openverse fail: {e}")
        return []
    out = []
    for r in data.get("results") or []:
        tags = " ".join(
            t.get("name", t) if isinstance(t, dict) else str(t)
            for t in (r.get("tags") or [])
        )
        cand = {
            "url": r.get("url") or r.get("thumbnail"),
            "full": r.get("url"),
            "title": r.get("title") or query,
            "license": r.get("license") or "cc",
            "artist": (r.get("creator") or "Openverse")[:120],
            "source": "openverse",
            "page": r.get("foreign_landing_url") or r.get("detail_url") or "",
            "date": str(r.get("created_on") or r.get("date") or ""),
            "description": f"{r.get('description') or ''} {tags}"[:240],
        }
        if looks_archival_or_old(cand):
            continue
        out.append(cand)
    return out


def listing_image_candidates(topic: dict, limit: int = 24) -> list[dict]:
    """Prefer live Lock & Key / GAMLS listing photos (color, current inventory)."""
    feed = load_json(ROOT / "public/data/listings.json", {"listings": []})
    items = feed.get("listings") if isinstance(feed, dict) else feed
    if not isinstance(items, list):
        items = []

    areas = [str(a).replace("-", " ").lower() for a in (topic.get("areas") or [])]
    cat = (topic.get("category") or "").lower()
    angle = f"{topic.get('angleEn') or ''} {topic.get('angleEs') or ''} {topic.get('id') or ''}".lower()
    want_interior = any(k in angle or k in cat for k in ("kitchen", "cocina", "interior", "remodel", "decor"))
    want_porch = any(k in angle for k in ("porch", "porche", "curb"))
    want_exterior = cat in ("buying", "selling", "neighborhoods", "market", "first_home") or not want_interior
    # Neighborhood / place posts: only use listings that match topic areas.
    # Never fill with random South GA cities when the post names specific towns.
    require_area_match = bool(areas) and (
        cat == "neighborhoods"
        or any(k in angle for k in ("valdosta", "hahira", "adel", "sparks", "tifton", "thomasville", "donde", "where to start", "zona", "area"))
    )

    scored: list[tuple[float, dict]] = []
    seen_urls: set[str] = set()
    for it in items:
        city = str(it.get("city") or "").lower()
        addr = str(it.get("address") or it.get("title") or "")
        imgs = it.get("images") or []
        if not imgs and it.get("image"):
            imgs = [it.get("image")]
        if not isinstance(imgs, list):
            continue
        area_boost = 0.0
        area_hit = False
        for a in areas:
            if a and (a in city or a in addr.lower()):
                area_boost += 8.0
                area_hit = True
        if areas and not area_hit:
            if require_area_match:
                continue  # wrong city for this topic
            # generic posts may still use inventory elsewhere, but weakly
            area_boost = 0.5

        ordered = list(imgs)
        if want_interior and len(ordered) > 2:
            # MLS galleries usually: 0 exterior hero, then interiors (kitchen/bath/living)
            # Prefer interior slots first for kitchen/remodel/decor posts.
            interior = ordered[2:12]
            hero = ordered[:2]
            ordered = interior + hero
        elif want_porch and len(ordered) > 1:
            # porch/curb: exterior-first angles; vision gate will keep true porches
            ordered = ordered[:10]
        elif want_exterior:
            ordered = ordered[:6]

        for idx, url in enumerate(ordered[:8]):
            u = str(url or "").strip()
            if not u.startswith("http"):
                continue
            if u in seen_urls:
                continue
            seen_urls.add(u)
            ul = u.lower()
            if any(x in ul for x in ("placeholder", "no-photo", "nophoto", "default-image")):
                continue
            score = 20.0 + area_boost - (idx * 0.3)
            if "gamls" in ul or "connectmls" in ul:
                score += 4.0
            if "cdn" in ul:
                score += 1.0
            title = f"{addr} - listing photo {idx+1}"
            scored.append(
                (
                    score,
                    {
                        "url": u,
                        "full": u,
                        "title": title,
                        "license": "listing photo (Lock & Key / GAMLS inventory)",
                        "artist": it.get("listedBy") or "Lock & Key Realty",
                        "source": "listing",
                        "page": it.get("sourceUrl") or it.get("zillowUrl") or "",
                        "mlsId": it.get("mlsId") or it.get("id"),
                        "city": it.get("city"),
                        "address": addr,
                        "date": it.get("updatedAt") or "",
                        "description": f"Active inventory photo - {city}",
                    },
                )
            )

    scored.sort(key=lambda x: x[0], reverse=True)
    out = [c for _, c in scored[:limit]]
    log(f"[assets] listing candidates={len(out)} from inventory={len(items)}")
    return out


def relevance_score(candidate: dict, topic: dict) -> float:
    """Higher is better. Prefer modern color homes; reject archival/off-topic."""
    if looks_archival_or_old(candidate):
        return -100.0

    title = f"{candidate.get('title') or ''} {candidate.get('artist') or ''} {candidate.get('description') or ''}".lower()
    source = (candidate.get("source") or "").lower()

    bad = (
        "constitution", "djvu", "map of", "locator map", "coat of arms", "flag of",
        "logo", "svg", "diagram", "chart", "screenshot", "passport", "document",
        "dealership", "subaru", "toyota", "ford dealer", "airport", "aircraft",
        "military", "museum interior exhibit", "skeleton", "anatomy", "microscopy",
        "ellipsis", "postcard", "statue", "cemetery", "gravestone", "ruin",
        "demolished", "fire damage", "warship", "locomotive", "steam engine",
    )
    if any(b in title for b in bad):
        return -100.0

    score = 0.0
    if source == "listing":
        score += 25.0
    elif source in ("wikimedia", "openverse"):
        score += 2.0

    good = (
        "house", "home", "residential", "porch", "yard", "for sale", "real estate",
        "suburban", "ranch", "kitchen", "neighborhood", "street", "downtown",
        "georgia", "valdosta", "hahira", "adel", "cottage", "bungalow", "front",
        "door", "lawn", "listing", "mls", "exterior", "interior", "driveway",
        "brick", "siding",
    )
    for g in good:
        if g in title:
            score += 2.0

    place_hit = False
    for a in topic.get("areas") or []:
        token = str(a).replace("-", " ").lower()
        if token and token in title:
            score += 6.0
            place_hit = True
        if token and token in str(candidate.get("city") or "").lower():
            score += 8.0
            place_hit = True
        if token and token in str(candidate.get("address") or "").lower():
            score += 8.0
            place_hit = True
        if token and token in str(candidate.get("description") or "").lower():
            score += 3.0
            place_hit = True

    cat = (topic.get("category") or "").lower()
    # For neighborhood/place posts, web photos without place tokens are near-useless
    if cat == "neighborhoods" and candidate.get("source") != "listing" and not place_hit:
        score -= 20.0

    if cat in ("buying", "selling") and any(
        w in title for w in ("for sale", "house", "home", "yard sign", "real estate", "listing")
    ):
        score += 3.0
    if cat == "neighborhoods" and any(w in title for w in ("downtown", "street", "georgia", "town", "listing")):
        score += 3.0
    if cat in ("decor", "remodel") and any(
        w in title for w in ("kitchen", "porch", "interior", "room", "house", "listing")
    ):
        score += 3.0

    for q in topic.get("image_queries") or []:
        for token in str(q).lower().split():
            if len(token) > 4 and token in title:
                score += 0.4

    if any(w in title for w in ("historic district plaque", "museum house", "antebellum", "plantation house")):
        score -= 8.0
    return score


def build_image_queries(topic: dict) -> list[str]:
    queries = list(topic.get("image_queries") or ["South Georgia house exterior"])
    for a in topic.get("areas") or []:
        queries.append(f"{a.replace('-', ' ')} Georgia residential house")
    cat = (topic.get("category") or "").lower()
    if cat in ("buying", "selling"):
        queries.extend([
            "modern house for sale yard sign color photo",
            "suburban home exterior driveway color",
            "american ranch house front yard",
            "brick house exterior curb appeal",
        ])
    elif cat == "neighborhoods":
        queries.extend([
            "small town Georgia main street color",
            "south Georgia residential neighborhood houses",
            "downtown street Georgia USA color photo",
        ])
    elif cat in ("decor", "remodel"):
        queries.extend([
            "southern front porch house color",
            "bright kitchen residential interior color",
            "house exterior curb appeal modern",
        ])
    else:
        queries.extend([
            "Georgia ranch house exterior color",
            "Southern porch house residential",
            "American suburban home front yard",
        ])
    cleaned = []
    for q in queries:
        qs = str(q).strip()
        if not qs:
            continue
        if "historic" in qs.lower() or "vintage" in qs.lower():
            continue
        cleaned.append(qs)
    return list(dict.fromkeys(cleaned))[:12]


def collect_web_candidates(topic: dict, queries: list[str] | None = None) -> list[dict]:
    queries = queries or build_image_queries(topic)
    # For place posts, force area-named queries first
    areas = [str(a).replace("-", " ").title() for a in (topic.get("areas") or [])]
    if (topic.get("category") or "").lower() == "neighborhoods" and areas:
        place_q = []
        for a in areas:
            place_q.extend([
                f"{a} Georgia",
                f"{a} Georgia downtown",
                f"{a} Georgia street",
                f"downtown {a} Georgia",
            ])
        queries = list(dict.fromkeys(place_q + queries))[:16]
    candidates: list[dict] = []
    for q in queries:
        for attempt in range(1, 3):
            try:
                candidates.extend(wikimedia_search(q, limit=6))
                break
            except Exception as e:
                log(f"[assets] wiki fail {q} try {attempt}: {e}")
                time.sleep(attempt)
        for attempt in range(1, 3):
            try:
                candidates.extend(openverse_search(q, limit=5))
                break
            except Exception as e:
                log(f"[assets] openverse fail {q} try {attempt}: {e}")
                time.sleep(attempt)
        time.sleep(0.25)
        if len(candidates) >= 40:
            break
    return candidates


def stage_image_search(day: str, topic: dict, force: bool = False) -> dict:
    """Agent: image-search - build ranked candidate pool (no heavy downloads)."""
    wd = workdir(day)
    out_path = wd / "image_candidates.json"
    if out_path.exists() and not force:
        log("[image-search] reuse existing")
        return load_json(out_path)

    queries = build_image_queries(topic)
    listing = listing_image_candidates(topic, limit=30)
    web = collect_web_candidates(topic, queries)

    scored: list[tuple[float, dict]] = []
    for c in listing + web:
        s = relevance_score(c, topic)
        if s < 0:
            continue
        scored.append((s, {**c, "_score": s}))
    scored.sort(key=lambda x: x[0], reverse=True)

    seen = set()
    pool = []
    for s, c in scored:
        u = c.get("url") or ""
        if not u or u in seen:
            continue
        seen.add(u)
        pool.append(c)
        if len(pool) >= 40:
            break

    payload = {
        "date": day,
        "topicId": topic.get("id"),
        "queries": queries,
        "candidates": pool,
        "counts": {
            "listing": sum(1 for c in pool if c.get("source") == "listing"),
            "web": sum(1 for c in pool if c.get("source") != "listing"),
            "total": len(pool),
        },
        "policy": {
            "prefer_listings": True,
            "reject_bw": True,
            "reject_archival": True,
            "min_year_hint": 2015,
        },
        "createdAt": utc_now(),
    }
    save_json(out_path, payload)
    append_log(wd, "image_search.done", payload["counts"])
    log(
        f"[image-search] pool={payload['counts']['total']} "
        f"listing={payload['counts']['listing']} web={payload['counts']['web']}"
    )
    return payload


def _global_seen_hashes(pub_dir: Path) -> set[str]:
    seen_hashes: set[str] = set()
    for existing in ASSETS_PUB.rglob("*"):
        if existing.suffix.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
            continue
        try:
            if pub_dir in existing.parents or existing.parent == pub_dir:
                continue
        except Exception:
            pass
        try:
            seen_hashes.add(hashlib.sha1(existing.read_bytes()).hexdigest())
        except Exception:
            pass
    return seen_hashes


def stage_image_download(day: str, topic: dict, force: bool = False) -> dict:
    """Agent: image-download - download ranked pool with color/archival filters."""
    wd = workdir(day)
    out_path = wd / "assets.json"
    if out_path.exists() and not force:
        log("[image-download] reuse existing assets")
        return load_json(out_path)

    cand_path = wd / "image_candidates.json"
    if force or not cand_path.exists():
        pool_doc = stage_image_search(day, topic, force=True)
    else:
        pool_doc = load_json(cand_path) or stage_image_search(day, topic, force=True)
    pool = list(pool_doc.get("candidates") or [])
    queries = list(pool_doc.get("queries") or build_image_queries(topic))

    brief = topic_visual_brief(topic)
    strict = brief.get("label") in ("porch", "kitchen", "place")

    def _pool_key(c: dict):
        title = f"{c.get('title') or ''} {c.get('description') or ''}".lower()
        kws = [k.lower() for k in brief.get("keywords") or []]
        meta_hit = any(k in title for k in kws if len(str(k)) >= 4)
        # For porch/kitchen: prefer web/metadata hits that name the subject over random listing heroes
        if strict and brief.get("label") in ("porch", "kitchen"):
            return (
                0 if meta_hit else 1,
                0 if c.get("source") != "listing" and meta_hit else 1,
                0 if c.get("source") == "listing" and meta_hit else 1,
                -(float(c.get("_score") or 0)),
            )
        if strict and brief.get("label") == "place":
            return (
                0 if meta_hit else 1,
                0 if c.get("source") == "listing" else 1,
                -(float(c.get("_score") or 0)),
            )
        return (
            0 if c.get("source") == "listing" else 1,
            -(float(c.get("_score") or 0)),
        )

    pool.sort(key=_pool_key)

    img_dir = wd / "images"
    img_dir.mkdir(parents=True, exist_ok=True)
    pub_dir = ASSETS_PUB / day.replace("-", "")
    pub_dir.mkdir(parents=True, exist_ok=True)
    if force:
        for old in pub_dir.glob("*"):
            if old.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp", ".svg"):
                try:
                    old.unlink()
                except Exception:
                    pass

    seen_hashes = _global_seen_hashes(pub_dir)
    seen_urls: set[str] = set()
    saved: list[dict] = []

    def try_save(c: dict, name_prefix: str) -> bool:
        nonlocal saved
        u = c.get("url") or ""
        full = c.get("full") or u
        if not u or u in seen_urls:
            return False
        if looks_archival_or_old(c):
            return False
        seen_urls.add(u)
        ext = ".jpg"
        probe = (full or u).lower()
        if ".png" in probe:
            ext = ".png"
        elif ".webp" in probe:
            ext = ".webp"
        name = f"{name_prefix}-{len(saved)+1}{ext}"
        dest_work = img_dir / name
        dest_pub = pub_dir / name
        ok = download_image(u, dest_work, seen_hashes=seen_hashes, require_color=True)
        if not ok and full != u:
            ok = download_image(full, dest_work, seen_hashes=seen_hashes, require_color=True)
        if not ok:
            return False
        # Examine pixels/content before accepting
        vision_ok, vision_reason = examine_image_for_topic(dest_work, topic, c)
        if not vision_ok:
            log(f"[vision] reject {dest_work.name}: {vision_reason[:120]}")
            try:
                dest_work.unlink(missing_ok=True)
            except Exception:
                pass
            # allow hash reuse later for other topics? remove hash if we added
            return False
        shutil.copy2(dest_work, dest_pub)
        compress_image_file(dest_pub)
        # if compress rewrote png/webp to jpg, keep names consistent when possible
        if dest_pub.suffix.lower() not in (".jpg", ".jpeg") and dest_pub.with_suffix(".jpg").exists():
            try:
                dest_pub.unlink(missing_ok=True)
            except Exception:
                pass
            dest_pub = dest_pub.with_suffix(".jpg")
            name = dest_pub.name
        elif dest_pub.suffix.lower() in (".jpg", ".jpeg"):
            # recompressed in place
            pass
        rel = f"/assets/blog/{day.replace('-', '')}/{dest_pub.name}"
        saved.append({**c, "local": rel, "file": dest_pub.name})
        log(
            f"[image-download] saved {rel} src={c.get('source')} "
            f"score={c.get('_score')} {(c.get('title') or '')[:55]}"
        )
        return True

    # For porch/kitchen, walk full sorted pool (metadata-first). Else listings first.
    if strict and brief.get("label") in ("porch", "kitchen"):
        for c in pool:
            try_save(c, f"{topic.get('id') or 'img'}")
            if len(saved) >= 4:
                break
    else:
        for c in [x for x in pool if x.get("source") == "listing"]:
            try_save(c, f"{topic.get('id') or 'img'}")
            if len(saved) >= 4:
                break
        if len(saved) < 4:
            for c in [x for x in pool if x.get("source") != "listing"]:
                try_save(c, f"{topic.get('id') or 'img'}")
                if len(saved) >= 4:
                    break

    if len(saved) < 2:
        append_log(wd, "assets.retry_broad", {"have": len(saved)})
        for q in [
            "modern suburban house exterior United States color",
            "new construction home front yard driveway",
            "ranch house exterior color photo",
            "front porch residential home color",
            "bright kitchen residential interior window",
        ]:
            try:
                more = wikimedia_search(q, limit=8) + openverse_search(q, limit=5)
                more_scored = sorted(
                    ((relevance_score(c, topic), c) for c in more),
                    key=lambda x: x[0],
                    reverse=True,
                )
                for s, c in more_scored:
                    if s < 0:
                        continue
                    c = {**c, "_score": s}
                    try_save(c, f"{topic.get('id') or 'img'}-b")
                    if len(saved) >= 4:
                        break
            except Exception as e:
                log(f"[assets] broad fail {q}: {e}")
            if len(saved) >= 4:
                break

    if len(saved) < 1:
        for c in listing_image_candidates(topic, limit=40):
            c = {**c, "_score": relevance_score(c, topic)}
            try_save(c, f"{topic.get('id') or 'img'}-L")
            if len(saved) >= 3:
                break

    chart_rel = None
    if not saved:
        append_log(wd, "assets.en_chart_fallback", True)
        chart_name = f"{topic['id']}-chart-en.svg"
        chart_path = pub_dir / chart_name
        title = (topic.get("headline_angle") or topic.get("angleEn") or topic.get("angleEs") or "Note")[:56]
        chart_path.write_text(
            '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">'
            '<rect width="1200" height="720" fill="#f7f1e8"/>'
            '<rect x="48" y="48" width="1104" height="624" rx="28" fill="#fffdf9" stroke="#e2d4bc"/>'
            f'<text x="96" y="220" font-family="Georgia, serif" font-size="36" fill="#1c1612">{_xml(title)}</text>'
            '<text x="96" y="290" font-family="system-ui,sans-serif" font-size="22" fill="#6b5a4c">South Georgia real estate note</text>'
            '<text x="96" y="520" font-family="system-ui,sans-serif" font-size="20" fill="#6b5a4c">Leey Hernandez - Lock and Key Realty</text>'
            '</svg>\n',
            encoding="utf-8",
        )
        chart_rel = f"/assets/blog/{day.replace('-', '')}/{chart_name}"
        saved.append({
            "local": chart_rel,
            "license": "original",
            "artist": "Leey Realty",
            "source": "chart-en",
            "title": title,
            "lang": "en",
        })
        log(f"[assets] EN chart fallback only (no photos): {chart_rel}")

    listing_n = sum(1 for s in saved if s.get("source") == "listing")
    assets = {
        "date": day,
        "queries": queries,
        "images": saved,
        "cover": saved[0]["local"] if saved else chart_rel,
        "photo_count": sum(1 for s in saved if s.get("source") not in ("generated", "chart-en")),
        "listing_photo_count": listing_n,
        "policy": {
            "prefer_listings": True,
            "reject_bw": True,
            "reject_archival": True,
        },
        "createdAt": utc_now(),
    }
    save_json(out_path, assets)
    (wd / "ATTRIBUTION.md").write_text(
        "# Image attribution\n\n"
        + "\n".join(
            f"- {i.get('local')}: {i.get('artist')} · {i.get('license')} · {i.get('page') or i.get('source')}"
            for i in saved
        )
        + "\n",
        encoding="utf-8",
    )
    append_log(wd, "assets.done", {"images": len(saved), "photos": assets["photo_count"], "listing": listing_n})
    log(f"[image-download] {len(saved)} image(s) photos={assets['photo_count']} listing={listing_n}")
    return assets


def stage_assets(day: str, topic: dict, force: bool = False) -> dict:
    """Combined assets stage = image-search + image-download."""
    stage_image_search(day, topic, force=force)
    return stage_image_download(day, topic, force=force)


def _xml(s: str) -> str:
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


# ── Stage 4: Write ─────────────────────────────────────────────────────────

def stage_write(day: str, research: dict, topic: dict, assets: dict, force: bool = False) -> dict:
    wd = workdir(day)
    out_path = wd / "draft.json"
    if out_path.exists() and not force:
        log("[write] reuse existing draft")
        return load_json(out_path)

    cover = assets.get("cover")
    imgs = assets.get("images") or []
    img_notes = [
        f"{i.get('local')} ({i.get('license')}, {i.get('artist')})" for i in imgs[:4]
    ]

    prompt = f"""
Eres copywriter SEO para Leyanis "Leey" Hernandez (Lock & Key Realty), sur de Georgia.
Responde SOLO con un objeto JSON compacto (máx 3500 caracteres). Sin markdown, sin ```.

Contexto:
season={research.get('season')}; why_now={topic.get('why_now')}; angle={topic.get('headline_angle')};
category={topic.get('category')}; towns={topic.get('areas')}; kw_es={topic.get('keywords_es')}; kw_en={topic.get('keywords_en')};
images={img_notes}

JSON shape exacto:
{{"slug":"kebab","titleEs":"","titleEn":"","seoTitleEs":"","seoTitleEn":"","seoDescriptionEs":"","seoDescriptionEn":"","excerptEs":"","excerptEn":"","bodyEs":"parrafos con \\n\\n y **subtitulo** y {{{{figure:0}}}} cierre — Leey","bodyEn":"same","tags":["a","b"],"readMinutes":7,"primaryKeywordEs":"","primaryKeywordEn":""}}

Reglas: primera persona Leey; cero stats inventadas; prohibido delve/landscape/seamless/unlock/moreover; SEO local natural; ES de EE.UU.
""".strip()

    core = llm_json(
        prompt,
        required_any=["bodyEs", "titleEs", "bodyEn"],
        max_rounds=3,
        wd=wd,
        tag="write",
    )
    used_fallback = False
    if not core:
        log("[write] LLM draft missing after corrections — human template fallback")
        append_log(wd, "write.fallback_template", True)
        core = _fallback_draft(day, topic, research)
        used_fallback = True
    else:
        append_log(wd, "write.llm_ok", {"keys": list(core.keys())[:15]})

    # attach media
    figures = []
    for i, im in enumerate(imgs[:4]):
        figures.append(
            {
                "src": im["local"],
                "altEs": f"{topic.get('headline_angle') or topic.get('angleEs')} — imagen {i+1}",
                "altEn": f"{topic.get('headline_angle') or topic.get('angleEn')} — image {i+1}",
                "kind": "photo" if im.get("source") != "generated" else "infographic",
                "captionEs": _caption_es(im),
                "captionEn": _caption_en(im),
            }
        )
    if not figures:
        figures = [
            {
                "src": cover,
                "altEs": core.get("titleEs") or "Nota",
                "altEn": core.get("titleEn") or "Note",
                "kind": "infographic",
            }
        ]

    def _s(v: Any, default: str = "") -> str:
        if v is None:
            return default
        return str(v)

    draft = {
        "slug": slugify(_s(core.get("slug"), f"{topic['id']}-{day}")),
        "date": day,
        "category": topic.get("category") or "market",
        "readMinutes": int(core.get("readMinutes") or 7),
        "tags": core.get("tags") or topic.get("keywords_es") or [],
        "areas": topic.get("areas") or [],
        "cover": figures[0],
        "figures": figures,
        "titleEs": scrub_ai(_s(core.get("titleEs"), _s(topic.get("angleEs")))),
        "titleEn": scrub_ai(_s(core.get("titleEn"), _s(topic.get("angleEn")))),
        "seoTitleEs": scrub_ai(_s(core.get("seoTitleEs"), _s(core.get("titleEs")))),
        "seoTitleEn": scrub_ai(_s(core.get("seoTitleEn"), _s(core.get("titleEn")))),
        "seoDescriptionEs": scrub_ai(_s(core.get("seoDescriptionEs"), _s(core.get("excerptEs")))),
        "seoDescriptionEn": scrub_ai(_s(core.get("seoDescriptionEn"), _s(core.get("excerptEn")))),
        "excerptEs": scrub_ai(_s(core.get("excerptEs"))),
        "excerptEn": scrub_ai(_s(core.get("excerptEn"))),
        "bodyEs": scrub_ai(_s(core.get("bodyEs"))).replace("\\n", "\n"),
        "bodyEn": scrub_ai(_s(core.get("bodyEn"))).replace("\\n", "\n"),
        "primaryKeywordEs": _s(core.get("primaryKeywordEs")),
        "primaryKeywordEn": _s(core.get("primaryKeywordEn")),
        "attribution": [
            {
                "src": im.get("local"),
                "artist": im.get("artist"),
                "license": im.get("license"),
                "page": im.get("page"),
                "source": im.get("source"),
            }
            for im in imgs
        ],
        "pipeline": {
            "research": True,
            "assets": len(imgs),
            "model": "template" if used_fallback else "free-then-local",
            "writeFallback": used_fallback,
            "createdAt": utc_now(),
        },
    }
    if "{{figure:0}}" not in draft["bodyEs"]:
        draft["bodyEs"] += "\n\n{{figure:0}}"
    if "{{figure:0}}" not in draft["bodyEn"]:
        draft["bodyEn"] += "\n\n{{figure:0}}"
    if not draft["bodyEs"].rstrip().endswith("Leey"):
        draft["bodyEs"] += "\n\n— Leey"
    if not draft["bodyEn"].rstrip().endswith("Leey"):
        draft["bodyEn"] += "\n\n— Leey"

    save_json(out_path, draft)
    log(f"[write] draft {draft['slug']}")
    return draft


def _caption_es(im: dict) -> str:
    if im.get("source") == "generated":
        return "Ilustración · leeyrealty.com"
    lic = im.get("license") or ""
    art = im.get("artist") or "autor"
    return f"Foto: {art} · {lic}"


def _caption_en(im: dict) -> str:
    if im.get("source") == "generated":
        return "Artwork · leeyrealty.com"
    lic = im.get("license") or ""
    art = im.get("artist") or "creator"
    return f"Photo: {art} · {lic}"


def _fallback_draft(day: str, topic: dict, research: dict) -> dict:
    town = str((topic.get("areas") or ["valdosta"])[0]).replace("-", " ").title()
    angle_es = str(topic.get("headline_angle") or topic.get("angleEs") or "Nota del sur de Georgia")
    angle_en = str(topic.get("angleEn") or "South Georgia note")
    title_es = angle_es.split(":")[0][:90]
    title_en = angle_en.split(":")[0][:90]
    return {
        "slug": f"{topic['id']}-{day}",
        "titleEs": title_es,
        "titleEn": title_en,
        "excerptEs": f"{angle_es} Notas claras desde {town}.",
        "excerptEn": f"{angle_en} Clear notes from {town}.",
        "seoTitleEs": f"{title_es[:50]} | Leey",
        "seoTitleEn": f"{title_en[:50]} | Leey",
        "seoDescriptionEs": f"Consejos de realtor en {town} y el sur de Georgia: {angle_es[:80]}",
        "seoDescriptionEn": f"Realtor notes in {town} and South Georgia: {angle_en[:80]}",
        "bodyEs": "\n\n".join(
            [
                f"Hoy me quedé pensando en {town} y en cómo se siente comprar o arreglar casa en esta temporada ({research.get('season')}).",
                f"{angle_es}",
                "**Lo que miro primero**",
                "No empiezo por la foto de Pinterest. Empiezo por el trayecto, la humedad, el patio y si la casa va a pelear contigo el primer año.",
                "{{figure:0}}",
                "**Qué haría yo**",
                "Una lista corta y honesta. Si es cosmético, lo digo. Si es caro de verdad (techo, HVAC, termitas), también.",
                "Si te suena a tu búsqueda, escríbeme. Mejor cinco minutos claros que una semana de duda.",
                "— Leey",
            ]
        ),
        "bodyEn": "\n\n".join(
            [
                f"I kept thinking about {town} and what it feels like to buy or fix up a home in this season ({research.get('season')}).",
                f"{angle_en}",
                "**What I look at first**",
                "I do not start with the Pinterest photo. I start with the drive, the moisture, the yard, and whether the house will fight you in year one.",
                "{{figure:0}}",
                "**What I would do**",
                "A short honest list. If it is cosmetic, I say so. If it is truly expensive (roof, HVAC, termites), I say that too.",
                "If this sounds like your search, message me. Better five clear minutes than a week of second-guessing.",
                "— Leey",
            ]
        ),
        "tags": [topic.get("category"), town, "South Georgia", "Leey"],
        "readMinutes": 6,
    }


# ── Stage 5: Polish (SEO + humanizer) ──────────────────────────────────────

def stage_polish(day: str, draft: dict, force: bool = False) -> dict:
    wd = workdir(day)
    out_path = wd / "final.json"
    if out_path.exists() and not force:
        log("[polish] reuse existing final")
        return load_json(out_path)

    def apply_guards(final: dict) -> dict:
        for _lang, title_k, desc_k, body_k in (
            ("es", "seoTitleEs", "seoDescriptionEs", "bodyEs"),
            ("en", "seoTitleEn", "seoDescriptionEn", "bodyEn"),
        ):
            if len(final.get(desc_k) or "") > 165:
                final[desc_k] = (final[desc_k][:157]).rsplit(" ", 1)[0] + "…"
            if len(final.get(desc_k) or "") < 80:
                # pad meta from excerpt
                ex = final.get("excerptEs" if desc_k.endswith("Es") else "excerptEn") or final.get(
                    "titleEs" if desc_k.endswith("Es") else "titleEn"
                )
                final[desc_k] = scrub_ai(f"{ex} · Leey Hernandez · Lock & Key Realty · sur de Georgia.")[:160]
            if len(final.get(title_k) or "") > 65:
                final[title_k] = (final[title_k][:62]).rsplit(" ", 1)[0] + "…"
            body = final.get(body_k) or ""
            if "{{figure:0}}" not in body:
                body = body + "\n\n{{figure:0}}"
            if "Leey" not in body[-60:]:
                body = body.rstrip() + "\n\n— Leey"
            final[body_k] = scrub_ai(body)
        if not isinstance(final.get("tags"), list) or len(final.get("tags") or []) < 3:
            final["tags"] = list(
                dict.fromkeys(
                    (final.get("tags") or [])
                    + [final.get("category") or "market", "Valdosta", "South Georgia", "Leey"]
                )
            )[:8]
        return final

    final = dict(draft)
    prompt = f"""
Eres editor senior (SEO + humanizer anti-detección IA). Reescribe SOLO para mejorar naturalidad y SEO local sin inventar datos.
Entrada JSON del draft:
{json.dumps({k: draft.get(k) for k in ['slug','titleEs','titleEn','seoTitleEs','seoTitleEn','seoDescriptionEs','seoDescriptionEn','excerptEs','excerptEn','bodyEs','bodyEn','tags','primaryKeywordEs','primaryKeywordEn','category']}, ensure_ascii=False)[:7000]}

Devuelve el MISMO shape JSON (mismos campos de texto), compacto, sin markdown:
- Títulos naturales con keyword local si cabe
- Meta descriptions 140-160 chars
- Cuerpo con ritmo humano, sin clichés IA
- Conserva {{{{figure:N}}}} y el cierre — Leey
- No agregues estadísticas nuevas
Solo JSON.
"""
    polished = llm_json(
        prompt,
        required_any=["bodyEs", "titleEs", "seoDescriptionEs"],
        max_rounds=3,
        wd=wd,
        tag="polish",
    )
    if polished:
        for k in (
            "titleEs",
            "titleEn",
            "seoTitleEs",
            "seoTitleEn",
            "seoDescriptionEs",
            "seoDescriptionEn",
            "excerptEs",
            "excerptEn",
            "bodyEs",
            "bodyEn",
            "tags",
            "slug",
            "primaryKeywordEs",
            "primaryKeywordEn",
        ):
            if polished.get(k):
                final[k] = (
                    scrub_ai(str(polished[k]).replace("\\n", "\n"))
                    if isinstance(polished[k], str)
                    else polished[k]
                )
        append_log(wd, "polish.llm_ok", True)
    else:
        append_log(wd, "polish.llm_fail_keep_draft", True)
        log("[polish] LLM polish failed after corrections — keeping draft + guards")

    final = apply_guards(final)

    # Validation + correction loop (up to 2 repair rounds with free/local)
    for repair in range(0, 3):
        checks = validate_post(final)
        final["validation"] = checks
        failed = [k for k, ok in checks.items() if not ok]
        if not failed:
            log("[polish] validation OK")
            append_log(wd, "polish.validation_ok", {"repair": repair})
            break
        log(f"[polish] validation FAIL repair={repair}: {failed}")
        append_log(wd, "polish.validation_fail", {"repair": repair, "failed": failed})
        if repair >= 2:
            break
        repair_prompt = f"""
Corrige este post JSON. Falló validación en: {failed}.
Devuelve SOLO JSON con los mismos campos de texto del post, arreglando SOLO lo fallido:
- bodyEs/bodyEn > 400 chars, con {{{{figure:0}}}} y cierre — Leey
- seoDescriptionEs/En entre 140 y 160 chars
- sin clichés IA (delve, seamless, moreover, etc.)
- tags >= 3
Post actual:
{json.dumps({k: final.get(k) for k in ['slug','titleEs','titleEn','seoTitleEs','seoTitleEn','seoDescriptionEs','seoDescriptionEn','excerptEs','excerptEn','bodyEs','bodyEn','tags','category']}, ensure_ascii=False)[:7500]}
"""
        fixed = llm_json(
            repair_prompt,
            required_any=["bodyEs", "titleEs"],
            max_rounds=2,
            wd=wd,
            tag=f"repair{repair}",
            models=["local", "free-then-local", "free", "background"],
        )
        if fixed:
            for k in (
                "titleEs",
                "titleEn",
                "seoTitleEs",
                "seoTitleEn",
                "seoDescriptionEs",
                "seoDescriptionEn",
                "excerptEs",
                "excerptEn",
                "bodyEs",
                "bodyEn",
                "tags",
            ):
                if fixed.get(k):
                    final[k] = (
                        scrub_ai(str(fixed[k]).replace("\\n", "\n"))
                        if isinstance(fixed[k], str)
                        else fixed[k]
                    )
        final = apply_guards(final)

    # last-resort deterministic body pad if still short
    checks = validate_post(final)
    if not checks.get("has_body_es"):
        final["bodyEs"] = (final.get("bodyEs") or "") + (
            "\n\nEn el sur de Georgia cada casa cuenta una historia distinta. "
            "Yo miro estructura, trayecto y lo que se siente al llegar. "
            "Si quieres, lo vemos juntos con calma.\n\n{{figure:0}}\n\n— Leey"
        )
    if not checks.get("has_body_en"):
        final["bodyEn"] = (final.get("bodyEn") or "") + (
            "\n\nIn South Georgia every house tells a different story. "
            "I look at structure, the drive, and how it feels to arrive. "
            "If you want, we can walk it together without the rush.\n\n{{figure:0}}\n\n— Leey"
        )
    final = apply_guards(final)
    checks = validate_post(final)
    final["validation"] = checks
    final["updatedAt"] = utc_now()
    final["pipeline"] = {
        **(draft.get("pipeline") or {}),
        "polishedAt": utc_now(),
        "validationOk": all(checks.values()),
        "validationFailed": [k for k, ok in checks.items() if not ok],
    }
    if all(checks.values()):
        log("[polish] validation OK (final)")
    else:
        log(f"[polish] WARN validation still partial: {final['pipeline']['validationFailed']}")

    save_json(out_path, final)
    save_json(
        wd / "READY.json",
        {
            "date": day,
            "slug": final.get("slug"),
            "ready": True,
            "validationOk": all(checks.values()),
            "at": utc_now(),
        },
    )
    append_log(wd, "polish.done", final["pipeline"])
    return final


# ── Stage 6: Publish ───────────────────────────────────────────────────────

def stage_publish(
    day: str,
    final: dict | None = None,
    dry: bool = False,
    replace: bool = False,
    preserve_slug: str | None = None,
    no_ship: bool = False,
) -> int:
    wd = workdir(day)
    final = final or load_json(wd / "final.json")
    if not final:
        log("[publish] no final.json — attempting late prep")
        # last chance: run missing stages
        research = load_json(wd / "research.json") or stage_research(day, force=True)
        topic = load_json(wd / "topic.json") or stage_topic(day, research, force=True)
        assets = load_json(wd / "assets.json") or stage_assets(day, topic, force=True)
        draft = load_json(wd / "draft.json") or stage_write(day, research, topic, assets, force=True)
        final = stage_polish(day, draft, force=True)
        if not final:
            log("[publish] still no final — abort")
            return 2

    # If validation failed, one more repair pass before shipping
    checks = final.get("validation") or validate_post(final)
    if not all(checks.values()):
        log(f"[publish] preflight validation fail {checks} — repair polish")
        append_log(wd, "publish.preflight_repair", checks)
        draft = load_json(wd / "draft.json") or final
        final = stage_polish(day, draft, force=True)
        checks = final.get("validation") or validate_post(final)
        if not all(checks.values()):
            # hard requirements only
            hard = ["has_cover", "has_body_es", "has_body_en", "has_title_es", "has_title_en"]
            if not all(checks.get(k) for k in hard):
                log(f"[publish] hard validation still failing: {checks} — abort ship")
                append_log(wd, "publish.abort_hard_validation", checks)
                return 4
            log("[publish] soft validation warnings only — publishing anyway")

    posts_data = load_json(POSTS_PATH, {"version": 1, "posts": []})
    posts = posts_data.get("posts") or []
    # skip if date exists (unless replace)
    if any(p.get("date") == day for p in posts):
        if replace:
            before = len(posts)
            posts = [p for p in posts if p.get("date") != day]
            log(f"[publish] replace mode: removed {before - len(posts)} post(s) for {day}")
            append_log(wd, "publish.replace", {"removed": before - len(posts)})
        else:
            log(f"[publish] already published for {day}")
            return 0
    # unique slug — prefer preserved slug on rewrite
    slug = preserve_slug or final.get("slug") or f"note-{day}"
    slug = slugify(str(slug))
    existing = {p.get("slug") for p in posts}
    if slug in existing and not replace:
        slug = f"{slug}-{day[5:].replace('-', '')}"
    elif slug in existing and replace:
        # still unique among remaining
        if slug in existing:
            slug = f"{slug}-r{day[8:]}"
    final["slug"] = slug

    post = {
        "slug": slug,
        "date": day,
        "updatedAt": utc_now(),
        "category": final.get("category") or "market",
        "readMinutes": int(final.get("readMinutes") or 7),
        "tags": final.get("tags") or [],
        "areas": final.get("areas") or [],
        "cover": final.get("cover"),
        "figures": final.get("figures") or [],
        "titleEs": final.get("titleEs"),
        "titleEn": final.get("titleEn"),
        "seoTitleEs": final.get("seoTitleEs"),
        "seoTitleEn": final.get("seoTitleEn"),
        "seoDescriptionEs": final.get("seoDescriptionEs"),
        "seoDescriptionEn": final.get("seoDescriptionEn"),
        "excerptEs": final.get("excerptEs"),
        "excerptEn": final.get("excerptEn"),
        "bodyEs": final.get("bodyEs"),
        "bodyEn": final.get("bodyEn"),
    }
    posts.append(post)
    posts.sort(key=lambda p: p.get("date") or "", reverse=True)
    posts_data["posts"] = posts
    posts_data["version"] = 1
    posts_data["updatedAt"] = utc_now()

    if dry:
        log(f"[publish] DRY would publish {slug}")
        save_json(wd / "final.json", final)
        return 0

    save_json(POSTS_PATH, posts_data)
    log(f"[publish] wrote posts.json (+{slug})")

    if no_ship:
        log("[publish] no-ship: feed updated, skip git/ship")
        save_json(wd / "PUBLISHED.json", {"slug": slug, "at": utc_now(), "validation": checks, "replaced": replace, "no_ship": True})
        append_log(wd, "publish.done_no_ship", {"slug": slug})
        return 0

    # git + ship
    env = os.environ.copy()
    env.pop("CLOUDFLARE_API_TOKEN", None)
    subprocess.run(["git", "add", "public/data/blog", "public/assets/blog"], cwd=str(ROOT), check=False)
    st = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=str(ROOT))
    if st.returncode == 0:
        log("[publish] nothing staged after write?")
    else:
        msg = (
            f"content(blog): rewrite multi-agent note {slug}"
            if replace
            else f"content(blog): multi-agent daily note {slug}"
        )
        subprocess.run(
            ["git", "commit", "-m", msg],
            cwd=str(ROOT),
            check=False,
        )
        push = subprocess.run(["git", "push", "origin", "HEAD"], cwd=str(ROOT), check=False)
        if push.returncode != 0:
            log("[publish] push failed — retry once")
            time.sleep(2)
            push = subprocess.run(["git", "push", "origin", "HEAD"], cwd=str(ROOT), check=False)
        log("[publish] shipping…")
        r = subprocess.run(
            ["npm", "run", "ship"],
            cwd=str(ROOT),
            env=env,
            check=False,
        )
        if r.returncode != 0:
            log("[publish] ship failed — retry once")
            time.sleep(3)
            r = subprocess.run(["npm", "run", "ship"], cwd=str(ROOT), env=env, check=False)
            if r.returncode != 0:
                append_log(wd, "publish.ship_fail", {"code": r.returncode})
                return 3
    save_json(wd / "PUBLISHED.json", {"slug": slug, "at": utc_now(), "validation": checks, "replaced": replace})
    append_log(wd, "publish.done", {"slug": slug, "replaced": replace})
    log(f"[publish] DONE {slug}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", default=date.today().isoformat())
    ap.add_argument(
        "--stage",
        choices=["all", "research", "topic", "assets", "image-search", "image-download", "write", "polish", "publish", "prep"],
        default="all",
    )
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry-publish", action="store_true")
    ap.add_argument("--replace", action="store_true", help="Replace existing post for --date")
    ap.add_argument("--topic-id", default=None, help="Pin topic bank id (e.g. porch-seasonal)")
    ap.add_argument("--preserve-slug", default=None, help="Keep this slug on publish/replace")
    ap.add_argument("--no-ship", action="store_true", help="Update posts.json only (no git/ship)")
    args = ap.parse_args()
    day = args.date
    os.chdir(ROOT)
    log(f"=== leey blog pipeline {day} stage={args.stage} force={args.force} topic={args.topic_id} ===")

    stage = args.stage
    # Single-stage mode: run ONLY that stage (no cascade via load-or-run fallbacks).
    single = stage in ("research", "topic", "assets", "image-search", "image-download", "write", "polish", "publish")

    research = load_json(workdir(day) / "research.json")
    topic = load_json(workdir(day) / "topic.json")
    assets = load_json(workdir(day) / "assets.json")
    draft = load_json(workdir(day) / "draft.json")
    final = load_json(workdir(day) / "final.json")

    if stage in ("all", "prep", "research"):
        research = stage_research(day, force=args.force or stage == "research")
        if stage == "research":
            log("[stage] research only — stop")
            return 0

    if stage in ("all", "prep", "topic"):
        if not research:
            research = stage_research(day, force=False)
        topic = stage_topic(day, research, force=args.force or stage == "topic", topic_id=args.topic_id)
        if stage == "topic":
            log("[stage] topic only — stop")
            return 0

    if stage == "image-search":
        if not topic:
            if not research:
                research = stage_research(day, force=False)
            topic = stage_topic(day, research, force=False, topic_id=args.topic_id)
        stage_image_search(day, topic, force=True)
        log("[stage] image-search only — stop")
        return 0

    if stage == "image-download":
        if not topic:
            if not research:
                research = stage_research(day, force=False)
            topic = stage_topic(day, research, force=False, topic_id=args.topic_id)
        assets = stage_image_download(day, topic, force=True)
        log("[stage] image-download only — stop")
        return 0

    if stage in ("all", "prep", "assets"):
        if not research:
            research = stage_research(day, force=False)
        if not topic:
            topic = stage_topic(day, research, force=False, topic_id=args.topic_id)
        assets = stage_assets(day, topic, force=args.force or stage == "assets")
        if stage == "assets":
            log("[stage] assets only — stop")
            return 0

    if stage in ("all", "prep", "write"):
        if not research:
            research = stage_research(day, force=False)
        if not topic:
            topic = stage_topic(day, research, force=False, topic_id=args.topic_id)
        if not assets:
            assets = stage_assets(day, topic, force=False)
        draft = stage_write(day, research, topic, assets, force=args.force or stage == "write")
        if stage == "write":
            log("[stage] write only — stop")
            return 0

    if stage in ("all", "prep", "polish"):
        if not draft:
            if not research:
                research = stage_research(day, force=False)
            if not topic:
                topic = stage_topic(day, research, force=False, topic_id=args.topic_id)
            if not assets:
                assets = stage_assets(day, topic, force=False)
            draft = stage_write(day, research, topic, assets, force=False)
        final = stage_polish(day, draft, force=args.force or stage == "polish")
        if stage == "polish":
            log("[stage] polish only — stop")
            return 0

    if stage in ("all", "publish"):
        if not final:
            final = load_json(workdir(day) / "final.json")
        return stage_publish(
            day,
            final,
            dry=args.dry_publish,
            replace=args.replace,
            preserve_slug=args.preserve_slug,
            no_ship=args.no_ship,
        )

    # prep ends after polish
    log(f"[prep] ready for publish: {(workdir(day) / 'READY.json').exists()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
