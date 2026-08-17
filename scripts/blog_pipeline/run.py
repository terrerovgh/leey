#!/usr/bin/env python3
"""
Leey blog multi-agent pipeline (free/local-first).

Stages (agents):
  1 research  — season, local towns, market angle, sources
  2 topic     — pick/refine angle from research + topics bank
  3 assets    — download free web images (Wikimedia/Openverse) + optional SVG
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


def http_get(url: str, timeout: int = 40) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def http_get_json(url: str, timeout: int = 40) -> Any:
    return json.loads(http_get(url, timeout=timeout).decode("utf-8", "replace"))


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


def try_llm(prompt: str, models: list[str] | None = None) -> str | None:
    models = models or ["free-then-local", "free", "local", "background"]
    for model in models:
        try:
            r = subprocess.run(
                ["hermes", "chat", "-q", prompt, "--model", model],
                capture_output=True,
                text=True,
                timeout=240,
                cwd=str(ROOT),
            )
            out = (r.stdout or "").strip()
            if r.returncode == 0 and len(out) > 200:
                log(f"[llm] ok model={model} chars={len(out)}")
                return out
            log(f"[llm] weak model={model} code={r.returncode} chars={len(out)}")
        except Exception as e:
            log(f"[llm] fail model={model}: {e}")
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
        for attempt in (raw, re.sub(r",\s*}", "}", re.sub(r",\s*]", "]", raw))):
            try:
                obj = json.loads(attempt)
                if isinstance(obj, dict) and (
                    "bodyEs" in obj or "titleEs" in obj or "headline_angle" in obj
                ):
                    return obj
            except Exception:
                continue
    return None


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
    ]
    web_notes = []
    for q in queries:
        try:
            url = "https://html.duckduckgo.com/html/?" + urllib.parse.urlencode({"q": q})
            html = http_get(url, timeout=25).decode("utf-8", "replace")
            # result snippets
            texts = re.findall(r'class="result__snippet"[^>]*>(.*?)</a>|<a class="result__a"[^>]*>(.*?)</a>', html, re.I | re.S)
            flat = []
            for a, b in texts:
                t = re.sub(r"<[^>]+>", " ", a or b or "")
                t = re.sub(r"\s+", " ", t).strip()
                if len(t) > 40:
                    flat.append(t[:240])
            web_notes.append({"query": q, "snippets": flat[:5]})
            time.sleep(0.8)
        except Exception as e:
            web_notes.append({"query": q, "error": str(e)})

    # Optional free LLM synthesis
    synth_prompt = f"""You are a local South Georgia real-estate researcher for realtor Leey Hernandez (Valdosta area).
Given season="{season}", inventory city counts={top_cities}, and web snippets={json.dumps(web_notes)[:3500]},
return STRICT JSON only:
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
    llm = try_llm(synth_prompt)
    synth = extract_json_obj(llm or "") or {}

    research = {
        "date": day,
        "season": season,
        "inventoryCities": top_cities,
        "web": web_notes,
        "synth": synth,
        "createdAt": utc_now(),
    }
    save_json(out_path, research)
    log(f"[research] wrote {out_path}")
    return research


# ── Stage 2: Topic ─────────────────────────────────────────────────────────

def stage_topic(day: str, research: dict, force: bool = False) -> dict:
    wd = workdir(day)
    out_path = wd / "topic.json"
    if out_path.exists() and not force:
        log("[topic] reuse existing")
        return load_json(out_path)

    topics = load_json(TOPICS_PATH, [])
    posts = load_json(POSTS_PATH, {"posts": []}).get("posts") or []
    used = " ".join(json.dumps(p, ensure_ascii=False) for p in posts).lower()

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
    topic = {
        "id": base["id"],
        "category": synth.get("category") or base["category"],
        "areas": synth.get("primary_towns") or base.get("areas") or ["valdosta"],
        "angleEs": base["angleEs"],
        "angleEn": base["angleEn"],
        "headline_angle": synth.get("headline_angle") or base["angleEs"],
        "why_now": synth.get("why_now") or research.get("season"),
        "keywords_es": synth.get("keywords_es") or base.get("mustInclude") or [],
        "keywords_en": synth.get("keywords_en") or [],
        "image_queries": synth.get("image_queries")
        or [
            f"{(base.get('areas') or ['Valdosta'])[0]} Georgia house exterior",
            "South Georgia porch home",
            "brick ranch house yard Georgia",
        ],
        "researchDate": day,
    }
    # normalize areas to slugs-ish
    topic["areas"] = [
        re.sub(r"[^a-z0-9]+", "-", str(a).lower()).strip("-") for a in topic["areas"]
    ][:4]
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


def download_image(url: str, dest: Path) -> bool:
    try:
        data = http_get(url, timeout=45)
        if len(data) < 4000:
            return False
        # basic magic
        if not (data[:3] == b"\xff\xd8\xff" or data[:8] == b"\x89PNG\r\n\x1a\n" or data[:4] == b"RIFF"):
            # allow jpeg/png/webp anyway if large enough
            if len(data) < 20000:
                return False
        dest.write_bytes(data)
        return True
    except Exception as e:
        log(f"[assets] download fail {url[:80]}: {e}")
        return False


def stage_assets(day: str, topic: dict, force: bool = False) -> dict:
    wd = workdir(day)
    out_path = wd / "assets.json"
    if out_path.exists() and not force:
        log("[assets] reuse existing")
        return load_json(out_path)

    queries = topic.get("image_queries") or ["South Georgia house exterior"]
    # expand with towns
    for a in topic.get("areas") or []:
        queries.append(f"{a.replace('-', ' ')} Georgia residential house")
    queries = list(dict.fromkeys(queries))[:5]

    candidates: list[dict] = []
    for q in queries:
        try:
            candidates.extend(wikimedia_search(q, limit=5))
        except Exception as e:
            log(f"[assets] wiki fail {q}: {e}")
        try:
            candidates.extend(openverse_search(q, limit=4))
        except Exception as e:
            log(f"[assets] openverse fail {q}: {e}")
        time.sleep(0.4)

    # dedupe by url
    seen = set()
    uniq = []
    for c in candidates:
        u = c.get("url") or ""
        if not u or u in seen:
            continue
        seen.add(u)
        uniq.append(c)

    saved = []
    img_dir = wd / "images"
    pub_dir = ASSETS_PUB / day.replace("-", "")
    pub_dir.mkdir(parents=True, exist_ok=True)

    for i, c in enumerate(uniq[:8]):
        ext = ".jpg"
        u = c.get("url") or ""
        if ".png" in u.lower():
            ext = ".png"
        elif ".webp" in u.lower():
            ext = ".webp"
        name = f"{topic['id']}-{i+1}{ext}"
        dest_work = img_dir / name
        dest_pub = pub_dir / name
        if download_image(u, dest_work):
            shutil.copy2(dest_work, dest_pub)
            rel = f"/assets/blog/{day.replace('-', '')}/{name}"
            saved.append(
                {
                    **c,
                    "local": rel,
                    "file": name,
                }
            )
            log(f"[assets] saved {rel} ({c.get('license')})")
        if len(saved) >= 4:
            break

    # Always ensure at least one SVG fallback cover if no photos
    svg_rel = None
    if not saved:
        svg_name = f"{topic['id']}-cover.svg"
        svg_path = pub_dir / svg_name
        title = topic.get("headline_angle") or topic.get("angleEs") or "Nota"
        svg_path.write_text(
            f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
  <rect width="1200" height="720" fill="#f7f1e8"/>
  <rect x="48" y="48" width="1104" height="624" rx="28" fill="#fffdf9" stroke="#e2d4bc"/>
  <rect x="96" y="120" width="120" height="8" rx="4" fill="#c45c26"/>
  <text x="96" y="300" font-family="Georgia, serif" font-size="40" fill="#1c1612">{_xml(title[:48])}</text>
  <text x="96" y="520" font-family="system-ui,sans-serif" font-size="20" fill="#6b5a4c">Sur de Georgia · Leey Hernandez</text>
  <text x="96" y="600" font-family="system-ui,sans-serif" font-size="16" fill="#8a7664">Lock &amp; Key Realty · leeyrealty.com</text>
</svg>
''',
            encoding="utf-8",
        )
        svg_rel = f"/assets/blog/{day.replace('-', '')}/{svg_name}"
        saved.append(
            {
                "local": svg_rel,
                "license": "original",
                "artist": "Leey Realty",
                "source": "generated",
                "title": title,
            }
        )

    assets = {
        "date": day,
        "queries": queries,
        "images": saved,
        "cover": saved[0]["local"] if saved else svg_rel,
        "createdAt": utc_now(),
    }
    save_json(out_path, assets)
    # attribution sidecar
    (wd / "ATTRIBUTION.md").write_text(
        "# Image attribution\n\n"
        + "\n".join(
            f"- {i.get('local')}: {i.get('artist')} · {i.get('license')} · {i.get('page') or i.get('source')}"
            for i in saved
        )
        + "\n",
        encoding="utf-8",
    )
    log(f"[assets] {len(saved)} image(s)")
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

    llm = try_llm(prompt)
    if llm:
        (wd / "write.llm.txt").write_text(llm, encoding="utf-8")
    core = extract_json_obj(llm or "")
    if not core:
        log("[write] LLM draft missing — human template fallback")
        core = _fallback_draft(day, topic, research)

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
            "model": "free-then-local-or-template",
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

    prompt = f"""
Eres editor senior (SEO + humanizer anti-detección IA). Reescribe SOLO para mejorar naturalidad y SEO local sin inventar datos.
Entrada JSON del draft:
{json.dumps({k: draft.get(k) for k in ['slug','titleEs','titleEn','seoTitleEs','seoTitleEn','seoDescriptionEs','seoDescriptionEn','excerptEs','excerptEn','bodyEs','bodyEn','tags','primaryKeywordEs','primaryKeywordEn','category']}, ensure_ascii=False)[:9000]}

Devuelve el MISMO shape JSON (mismos campos de texto), con:
- Títulos naturales con keyword local si cabe
- Meta descriptions 140-160 chars
- Cuerpo con ritmo humano (frases cortas y largas), sin clichés IA
- Conserva {{{{figure:N}}}} y el cierre — Leey
- No agregues estadísticas nuevas
Solo JSON.
"""
    llm = try_llm(prompt)
    polished = extract_json_obj(llm or "")
    final = dict(draft)
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
                final[k] = scrub_ai(str(polished[k]).replace("\\n", "\n")) if isinstance(polished[k], str) else polished[k]

    # deterministic SEO guards
    for lang, title_k, desc_k, body_k, kw_k in (
        ("es", "seoTitleEs", "seoDescriptionEs", "bodyEs", "primaryKeywordEs"),
        ("en", "seoTitleEn", "seoDescriptionEn", "bodyEn", "primaryKeywordEn"),
    ):
        if len(final.get(desc_k) or "") > 165:
            final[desc_k] = (final[desc_k][:157]).rsplit(" ", 1)[0] + "…"
        if len(final.get(title_k) or "") > 65:
            final[title_k] = (final[title_k][:62]).rsplit(" ", 1)[0] + "…"
        # ensure figure markers
        if "{{figure:0}}" not in (final.get(body_k) or ""):
            final[body_k] = (final.get(body_k) or "") + "\n\n{{figure:0}}"

    final["updatedAt"] = utc_now()
    final["pipeline"] = {
        **(draft.get("pipeline") or {}),
        "polishedAt": utc_now(),
    }
    # validation checklist
    checks = {
        "has_cover": bool(final.get("cover", {}).get("src")),
        "has_body_es": len(final.get("bodyEs") or "") > 400,
        "has_body_en": len(final.get("bodyEn") or "") > 400,
        "has_meta_es": 80 <= len(final.get("seoDescriptionEs") or "") <= 180,
        "has_meta_en": 80 <= len(final.get("seoDescriptionEn") or "") <= 180,
        "no_em_dash_spam": (final.get("bodyEs") or "").count("—") < 3,
    }
    final["validation"] = checks
    if not all(checks.values()):
        log(f"[polish] WARN validation {checks}")
    else:
        log("[polish] validation OK")

    save_json(out_path, final)
    save_json(wd / "READY.json", {"date": day, "slug": final.get("slug"), "ready": True, "at": utc_now()})
    return final


# ── Stage 6: Publish ───────────────────────────────────────────────────────

def stage_publish(day: str, final: dict | None = None, dry: bool = False) -> int:
    wd = workdir(day)
    final = final or load_json(wd / "final.json")
    if not final:
        log("[publish] no final.json — nothing to publish")
        return 2

    posts_data = load_json(POSTS_PATH, {"version": 1, "posts": []})
    posts = posts_data.get("posts") or []
    # skip if date exists
    if any(p.get("date") == day for p in posts):
        log(f"[publish] already published for {day}")
        return 0
    # unique slug
    slug = final["slug"]
    existing = {p.get("slug") for p in posts}
    if slug in existing:
        slug = f"{slug}-{day[5:].replace('-', '')}"
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
        return 0

    save_json(POSTS_PATH, posts_data)
    log(f"[publish] wrote posts.json (+{slug})")

    # git + ship
    env = os.environ.copy()
    env.pop("CLOUDFLARE_API_TOKEN", None)
    subprocess.run(["git", "add", "public/data/blog", "public/assets/blog"], cwd=str(ROOT), check=False)
    st = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=str(ROOT))
    if st.returncode == 0:
        log("[publish] nothing staged after write?")
    else:
        subprocess.run(
            ["git", "commit", "-m", f"content(blog): multi-agent daily note {slug}"],
            cwd=str(ROOT),
            check=False,
        )
        subprocess.run(["git", "push", "origin", "HEAD"], cwd=str(ROOT), check=False)
        log("[publish] shipping…")
        r = subprocess.run(
            ["npm", "run", "ship"],
            cwd=str(ROOT),
            env=env,
            check=False,
        )
        if r.returncode != 0:
            log("[publish] ship failed")
            return 3
    save_json(wd / "PUBLISHED.json", {"slug": slug, "at": utc_now()})
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
    args = ap.parse_args()
    day = args.date
    os.chdir(ROOT)
    log(f"=== leey blog pipeline {day} stage={args.stage} ===")

    if args.stage in ("all", "prep", "research"):
        research = stage_research(day, force=args.force)
    else:
        research = load_json(workdir(day) / "research.json") or stage_research(day)

    if args.stage in ("all", "prep", "topic"):
        topic = stage_topic(day, research, force=args.force)
    else:
        topic = load_json(workdir(day) / "topic.json") or stage_topic(day, research)

    if args.stage in ("all", "prep", "assets"):
        assets = stage_assets(day, topic, force=args.force)
    else:
        assets = load_json(workdir(day) / "assets.json") or stage_assets(day, topic)

    if args.stage in ("all", "prep", "write"):
        draft = stage_write(day, research, topic, assets, force=args.force)
    else:
        draft = load_json(workdir(day) / "draft.json") or stage_write(day, research, topic, assets)

    if args.stage in ("all", "prep", "polish"):
        final = stage_polish(day, draft, force=args.force)
    else:
        final = load_json(workdir(day) / "final.json") or stage_polish(day, draft)

    if args.stage in ("all", "publish"):
        return stage_publish(day, final, dry=args.dry_publish)

    log(f"[prep] ready for publish: {(workdir(day) / 'READY.json').exists()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
