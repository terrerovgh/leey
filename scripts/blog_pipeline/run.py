#!/usr/bin/env python3
"""
Leey blog multi-agent pipeline (free/local-first).

Stages (agents):
  1 research  — season, local towns, market angle, sources
  2 topic     — pick/refine angle from research + topics bank
  3 assets    — download free web photos (Wikimedia/Openverse); EN chart only if zero photos
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


# ── Stage 3: Assets (free web images) ──────────────────────────────────────

def wikimedia_search(query: str, limit: int = 6) -> list[dict]:
    api = "https://commons.wikimedia.org/w/api.php"
    params = {
        "action": "query",
        "generator": "search",
        "gsrsearch": query,
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
        if not mime.startswith("image/"):
            continue
        if "svg" in mime:
            continue
        meta = info.get("extmetadata") or {}
        license_short = (meta.get("LicenseShortName") or {}).get("value") or ""
        artist = re.sub(r"<[^>]+>", "", (meta.get("Artist") or {}).get("value") or "Wikimedia")
        # Prefer freely reusable licenses
        lic_l = license_short.lower()
        if not any(x in lic_l for x in ("cc0", "public domain", "cc by", "cc-by", "pd")):
            # still allow cc by-sa
            if "cc" not in lic_l and "pd" not in lic_l and "public" not in lic_l:
                continue
        thumb = info.get("thumburl") or info.get("url")
        full = info.get("url")
        if not thumb and not full:
            continue
        out.append(
            {
                "url": thumb or full,
                "full": full or thumb,
                "title": pg.get("title") or query,
                "license": license_short,
                "artist": artist[:120],
                "source": "wikimedia",
                "page": f"https://commons.wikimedia.org/wiki/{urllib.parse.quote(pg.get('title') or '')}",
            }
        )
    return out


def openverse_search(query: str, limit: int = 5) -> list[dict]:
    # Openverse public API — free, attribution required
    url = "https://api.openverse.org/v1/images/?" + urllib.parse.urlencode(
        {"q": query, "page_size": str(limit), "license": "cc0,pdm,by,by-sa"}
    )
    try:
        data = http_get_json(url, timeout=30)
    except Exception as e:
        log(f"[assets] openverse fail: {e}")
        return []
    out = []
    for r in data.get("results") or []:
        out.append(
            {
                "url": r.get("url") or r.get("thumbnail"),
                "full": r.get("url"),
                "title": r.get("title") or query,
                "license": r.get("license") or "cc",
                "artist": (r.get("creator") or "Openverse")[:120],
                "source": "openverse",
                "page": r.get("foreign_landing_url") or r.get("detail_url") or "",
            }
        )
    return out


def download_image(url: str, dest: Path, min_bytes: int = 8000, seen_hashes: set | None = None) -> bool:
    try:
        data = http_get(url, timeout=45)
        if len(data) < min_bytes:
            return False
        # basic magic — require real image bytes
        ok_magic = (
            data[:3] == b"\xff\xd8\xff"
            or data[:8] == b"\x89PNG\r\n\x1a\n"
            or data[:4] == b"RIFF"
            or data[:4] == b"RIFF"
        )
        if not ok_magic and len(data) < 20000:
            return False
        # reject near-duplicates across posts
        h = hashlib.sha1(data).hexdigest()
        if seen_hashes is not None:
            if h in seen_hashes:
                log(f"[assets] skip duplicate hash {h[:10]}")
                return False
            seen_hashes.add(h)
        dest.write_bytes(data)
        return True
    except Exception as e:
        log(f"[assets] download fail {url[:80]}: {e}")
        return False


def relevance_score(candidate: dict, topic: dict) -> float:
    """Higher is better. Filters off-topic Commons noise (docs, cars, maps…)."""
    title = f"{candidate.get('title') or ''} {candidate.get('artist') or ''}".lower()
    blob = " ".join(
        [
            topic.get("id") or "",
            topic.get("category") or "",
            topic.get("angleEn") or "",
            topic.get("angleEs") or "",
            " ".join(topic.get("areas") or []),
            " ".join(topic.get("image_queries") or []),
        ]
    ).lower()

    # Hard rejects
    bad = (
        "constitution",
        "djvu",
        "map of",
        "locator map",
        "coat of arms",
        "flag of",
        "logo",
        "svg",
        "diagram",
        "chart",
        "screenshot",
        "passport",
        "document",
        "dealership",
        "subaru",
        "toyota",
        "ford dealer",
        "airport",
        "aircraft",
        "military",
        "museum interior exhibit",
        "skeleton",
        "anatomy",
        "microscopy",
        "ellipsis",
        "postcard large letter",
    )
    if any(b in title for b in bad):
        return -100.0

    score = 0.0
    # Prefer residential / realty cues
    good = (
        "house",
        "home",
        "residential",
        "porch",
        "yard",
        "for sale",
        "real estate",
        "suburban",
        "ranch",
        "kitchen",
        "neighborhood",
        "street",
        "downtown",
        "georgia",
        "valdosta",
        "hahira",
        "adel",
        "cottage",
        "bungalow",
        "front",
        "door",
        "lawn",
    )
    for g in good:
        if g in title:
            score += 2.0
    # Place boosts from topic areas
    for a in topic.get("areas") or []:
        token = str(a).replace("-", " ").lower()
        if token and token in title:
            score += 4.0
    # Category boosts
    cat = (topic.get("category") or "").lower()
    if cat in ("buying", "selling") and any(w in title for w in ("for sale", "house", "home", "yard sign", "real estate")):
        score += 3.0
    if cat == "neighborhoods" and any(w in title for w in ("downtown", "street", "georgia", "town")):
        score += 3.0
    if cat in ("decor", "remodel") and any(w in title for w in ("kitchen", "porch", "interior", "room", "house")):
        score += 3.0
    # Mild preference if query words appear
    for q in topic.get("image_queries") or []:
        for token in str(q).lower().split():
            if len(token) > 4 and token in title:
                score += 0.4
    # Prefer larger / photo-looking titles over abstract art
    if title.startswith("file:") and "house" not in title and "home" not in title and score < 2:
        score -= 1.0
    return score


def stage_assets(day: str, topic: dict, force: bool = False) -> dict:
    wd = workdir(day)
    out_path = wd / "assets.json"
    if out_path.exists() and not force:
        log("[assets] reuse existing")
        return load_json(out_path)

    queries = list(topic.get("image_queries") or ["South Georgia house exterior"])
    # expand with towns + generic fallbacks
    for a in topic.get("areas") or []:
        queries.append(f"{a.replace('-', ' ')} Georgia residential house")
    cat = (topic.get("category") or "").lower()
    if cat in ("buying", "selling"):
        queries.extend(
            [
                "house for sale yard sign residential",
                "for sale sign in front of house",
                "american suburban home exterior",
                "brick ranch house front yard",
            ]
        )
    elif cat == "neighborhoods":
        queries.extend(
            [
                "small town Georgia main street",
                "south Georgia residential neighborhood",
                "downtown street Georgia USA",
            ]
        )
    elif cat in ("decor", "remodel"):
        queries.extend(
            [
                "southern front porch house",
                "bright kitchen residential interior",
                "house exterior curb appeal",
            ]
        )
    else:
        queries.extend(
            [
                "Georgia ranch house exterior",
                "Southern porch house",
                "American suburban home front yard",
            ]
        )
    queries = list(dict.fromkeys(queries))[:12]

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
        time.sleep(0.3)
        if len(candidates) >= 40:
            break

    # score + filter
    scored = []
    for c in candidates:
        s = relevance_score(c, topic)
        if s < 0:
            continue
        scored.append((s, c))
    scored.sort(key=lambda x: x[0], reverse=True)
    log(f"[assets] candidates={len(candidates)} scored_keep={len(scored)} top={[round(s,1) for s,_ in scored[:5]]}")

    # dedupe by url, keep score order
    seen = set()
    uniq = []
    for s, c in scored:
        u = c.get("url") or ""
        if not u or u in seen:
            continue
        seen.add(u)
        c = {**c, "_score": s}
        uniq.append(c)

    saved = []
    img_dir = wd / "images"
    pub_dir = ASSETS_PUB / day.replace("-", "")
    pub_dir.mkdir(parents=True, exist_ok=True)
    # Global hash set of existing blog photos so posts don't share identical files
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

    for i, c in enumerate(uniq[:30]):
        ext = ".jpg"
        u = c.get("url") or ""
        full = c.get("full") or u
        if ".png" in u.lower() or ".png" in full.lower():
            ext = ".png"
        elif ".webp" in u.lower():
            ext = ".webp"
        name = f"{topic['id']}-{i+1}{ext}"
        dest_work = img_dir / name
        dest_pub = pub_dir / name
        ok = download_image(u, dest_work, seen_hashes=seen_hashes)
        if not ok and full != u:
            ok = download_image(full, dest_work, seen_hashes=seen_hashes)
        if ok:
            shutil.copy2(dest_work, dest_pub)
            rel = f"/assets/blog/{day.replace('-', '')}/{name}"
            saved.append({**c, "local": rel, "file": name})
            log(f"[assets] saved {rel} score={c.get('_score')} ({c.get('license')}) {(c.get('title') or '')[:60]}")
        if len(saved) >= 4:
            break

    # If still thin, one more broad pass with residential queries only
    if len(saved) < 2:
        append_log(wd, "assets.retry_broad", {"have": len(saved)})
        for q in [
            "house exterior United States residential",
            "front porch American home",
            "suburban house yard for sale sign",
            "brick house front yard USA",
            "ranch house exterior driveway",
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
                    u = c.get("url") or ""
                    if not u or u in seen:
                        continue
                    seen.add(u)
                    name = f"{topic['id']}-b{len(saved)+1}.jpg"
                    dest_work = img_dir / name
                    dest_pub = pub_dir / name
                    if download_image(u, dest_work, seen_hashes=seen_hashes):
                        shutil.copy2(dest_work, dest_pub)
                        rel = f"/assets/blog/{day.replace('-', '')}/{name}"
                        saved.append({**c, "local": rel, "file": name, "_score": s})
                        log(f"[assets] broad saved {rel} score={s} {(c.get('title') or '')[:50]}")
                    if len(saved) >= 4:
                        break
            except Exception as e:
                log(f"[assets] broad fail {q}: {e}")
            if len(saved) >= 4:
                break

    # Prefer real photos only. Optional English-only chart as last resort
    # (never Spanish decorative SVG covers).
    chart_rel = None
    if not saved:
        append_log(wd, "assets.en_chart_fallback", True)
        chart_name = f"{topic['id']}-chart-en.svg"
        chart_path = pub_dir / chart_name
        title = (topic.get("headline_angle") or topic.get("angleEn") or topic.get("angleEs") or "Note")[
            :56
        ]
        # English-only labels — charts are for US readers of the EN body
        chart_path.write_text(
            f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720" role="img" aria-label="{_xml(title)}">
  <rect width="1200" height="720" fill="#f7f1e8"/>
  <rect x="48" y="48" width="1104" height="624" rx="28" fill="#fffdf9" stroke="#e2d4bc"/>
  <rect x="96" y="120" width="140" height="8" rx="4" fill="#c45c26"/>
  <text x="96" y="220" font-family="Georgia, serif" font-size="36" fill="#1c1612">{_xml(title)}</text>
  <text x="96" y="290" font-family="system-ui,sans-serif" font-size="22" fill="#6b5a4c">South Georgia · real estate note</text>
  <text x="96" y="520" font-family="system-ui,sans-serif" font-size="20" fill="#6b5a4c">Leey Hernandez · Lock &amp; Key Realty</text>
  <text x="96" y="580" font-family="system-ui,sans-serif" font-size="16" fill="#8a7664">leeyrealty.com · photo sources unavailable — chart placeholder</text>
</svg>
''',
            encoding="utf-8",
        )
        chart_rel = f"/assets/blog/{day.replace('-', '')}/{chart_name}"
        saved.append(
            {
                "local": chart_rel,
                "license": "original",
                "artist": "Leey Realty",
                "source": "chart-en",
                "title": title,
                "lang": "en",
            }
        )
        log(f"[assets] EN chart fallback only (no photos): {chart_rel}")

    assets = {
        "date": day,
        "queries": queries,
        "images": saved,
        "cover": saved[0]["local"] if saved else chart_rel,
        "photo_count": sum(1 for s in saved if s.get("source") not in ("generated", "chart-en")),
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
    append_log(wd, "assets.done", {"images": len(saved), "photos": assets["photo_count"]})
    log(f"[assets] {len(saved)} image(s) photos={assets['photo_count']}")
    return assets


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
        choices=["all", "research", "topic", "assets", "write", "polish", "publish", "prep"],
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
    single = stage in ("research", "topic", "assets", "write", "polish", "publish")

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
