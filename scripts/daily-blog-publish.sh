#!/usr/bin/env bash
# Daily blog publisher for leeyrealty.com
# Prefer free OmniRoute / local model via Hermes when available; otherwise
# uses a deterministic human-voice template so the site still publishes.
#
# Hermes cron can call this with --no-agent (script path) or with a free model
# prompt that runs the same script after a light rewrite pass.
set -euo pipefail

ROOT="${LEEY_ROOT:-/home/terrerov/Projects/leey}"
cd "$ROOT"
export PATH="${HOME}/.local/bin:${HOME}/.npm-global/bin:/usr/local/bin:${PATH}"

log() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

command -v node >/dev/null || die "node missing"
command -v python3 >/dev/null || die "python3 missing"
command -v git >/dev/null || die "git missing"

log "=== leey daily blog ==="
log "when: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# 1) Generate or skip if already published today
python3 - <<'PY'
from __future__ import annotations

import hashlib
import json
import random
import re
import subprocess
import textwrap
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(".").resolve()
POSTS_PATH = ROOT / "public/data/blog/posts.json"
TOPICS_PATH = ROOT / "data/blog/topics.json"
ASSETS = ROOT / "public/assets/blog"
ASSETS.mkdir(parents=True, exist_ok=True)

today = date.today().isoformat()

def load_posts():
    if POSTS_PATH.exists():
        data = json.loads(POSTS_PATH.read_text(encoding="utf-8"))
    else:
        data = {"version": 1, "updatedAt": None, "posts": []}
    data.setdefault("posts", [])
    return data

data = load_posts()
existing_dates = {p.get("date") for p in data["posts"]}
existing_slugs = {p.get("slug") for p in data["posts"]}
if today in existing_dates:
    print(f"[blog] already have a post for {today} — no-op")
    raise SystemExit(0)

topics = json.loads(TOPICS_PATH.read_text(encoding="utf-8"))
# pick least-used topic by hashing against existing titles
used = " ".join((p.get("titleEs") or "") + (p.get("id") or "") for p in data["posts"]).lower()
candidates = []
for t in topics:
    score = sum(1 for p in data["posts"] if t["id"] in json.dumps(p, ensure_ascii=False))
    # also avoid repeating angle keywords heavily
    key = t["angleEs"].split(":")[0].lower()
    if key in used:
        score += 2
    candidates.append((score, t))
candidates.sort(key=lambda x: (x[0], x[1]["id"]))
topic = candidates[0][1]
print(f"[blog] topic={topic['id']} category={topic['category']}")

# optional free LLM via hermes chat if available
def try_llm(prompt: str) -> str | None:
    # Prefer free-then-local alias if hermes is configured
    for model in ("free-then-local", "free", "local"):
        try:
            r = subprocess.run(
                [
                    "hermes",
                    "chat",
                    "-q",
                    prompt,
                    "--model",
                    model,
                ],
                capture_output=True,
                text=True,
                timeout=180,
                cwd=str(ROOT),
            )
            out = (r.stdout or "").strip()
            if r.returncode == 0 and len(out) > 400 and "{" in out:
                print(f"[blog] llm ok via model={model}")
                return out
            print(f"[blog] llm skip model={model} code={r.returncode} len={len(out)}")
        except Exception as e:
            print(f"[blog] llm unavailable ({model}): {e}")
    return None

llm_prompt = f"""
Eres Leey Hernandez, realtor bilingüe de Lock & Key Realty en el sur de Georgia.
Escribe UN post de blog en JSON estricto (sin markdown fuera del JSON) con esta forma:
{{
  "slug": "kebab-case-unico",
  "titleEs": "...",
  "titleEn": "...",
  "excerptEs": "2 frases max",
  "excerptEn": "2 sentences max",
  "bodyEs": "parrafos separados por \\n\\n, con 1-2 subtítulos en **así**, incluye {{{{figure:0}}}} una vez, cierra con — Leey",
  "bodyEn": "same structure in natural English",
  "tags": ["3-6 tags"],
  "readMinutes": 6
}}
Tema/ángulo: {topic['angleEs']} / {topic['angleEn']}
Categoría: {topic['category']}
Zonas: {', '.join(topic.get('areas') or [])}
Reglas de voz (obligatorias):
- Primera persona, concreta, sin hype, sin 'delve/landscape/testament/seamless'.
- Sin emojis. Sin listas numeradas largas de marketing. Frases de largo variado.
- No inventes métricas ni años de experiencia.
- Menciona pueblos reales del sur de Georgia cuando encaje.
- Español natural de quien vive en EE.UU. (no traducción rígida).
Solo JSON.
""".strip()

llm_raw = try_llm(llm_prompt)
post_core = None
if llm_raw:
    m = re.search(r"\{[\s\S]*\}", llm_raw)
    if m:
        try:
            post_core = json.loads(m.group(0))
        except Exception as e:
            print("[blog] llm json parse fail", e)

# Deterministic human-voice fallback (always available, free)
def fallback_post(topic: dict) -> dict:
    seed = int(hashlib.sha1(f"{today}:{topic['id']}".encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)
    area = (topic.get("areas") or ["valdosta"])[0].replace("-", " ").title()
    openings_es = [
        f"Hoy anduve pensando en {area} otra vez.",
        f"Me preguntaron esta semana por {area}, y la respuesta no cabe en un anuncio.",
        f"No todo el mundo quiere el mismo tipo de casa cerca de {area}.",
    ]
    openings_en = [
        f"I kept thinking about {area} again today.",
        f"Someone asked about {area} this week, and the answer does not fit in an ad.",
        f"Not everyone wants the same kind of home near {area}.",
    ]
    angle_es = topic["angleEs"]
    angle_en = topic["angleEn"]
    slug_base = re.sub(r"[^a-z0-9]+", "-", (topic["id"] + "-" + today).lower()).strip("-")
    title_es = angle_es.split(":")[0].strip()
    if len(title_es) < 28:
        title_es = angle_es.strip().rstrip(".")
    title_en = angle_en.split(":")[0].strip()
    if len(title_en) < 28:
        title_en = angle_en.strip().rstrip(".")

    body_es = "\n\n".join(
        [
            rng.choice(openings_es),
            angle_es + " Eso es lo que quiero dejar escrito hoy, sin adorno.",
            "**Lo que miro primero**",
            "No empiezo por la foto bonita. Empiezo por cómo se siente llegar, qué se oye, y si la casa pide pelea el primer año. En el sur de Georgia eso importa: humedad, trayectos, y un patio que o se disfruta o se sufre los sábados.",
            "{{figure:0}}",
            "**Qué haría yo**",
            "Una lista corta. Cosas que caben en un fin de semana o en una conversación honesta de precio. Si algo es caro de verdad, lo digo. Si es cosmético, también.",
            "Si te suena a tu búsqueda o a tu casa, escríbeme. Mejor cinco minutos claros que una semana de tabs abiertos.",
            "— Leey",
        ]
    )
    body_en = "\n\n".join(
        [
            rng.choice(openings_en),
            angle_en + " That is what I want on the page today, without decoration.",
            "**What I look at first**",
            "I do not start with the pretty photo. I start with how it feels to arrive, what you hear, and whether the house will fight you in year one. In South Georgia that matters: moisture, drives, and a yard you either enjoy or suffer every Saturday.",
            "{{figure:0}}",
            "**What I would do**",
            "A short list. Things that fit a weekend or an honest price talk. If something is truly expensive, I say so. If it is cosmetic, I say that too.",
            "If this sounds like your search or your house, message me. Better five clear minutes than a week of open tabs.",
            "— Leey",
        ]
    )
    return {
        "slug": slug_base[:80],
        "titleEs": title_es[:120],
        "titleEn": title_en[:120],
        "excerptEs": f"{angle_es} Notas claras, sin prisa.",
        "excerptEn": f"{angle_en} Clear notes, no rush.",
        "bodyEs": body_es,
        "bodyEn": body_en,
        "tags": list(
            dict.fromkeys(
                [topic["category"], area, "sur de Georgia", "Lock & Key", "Leey"]
            )
        )[:6],
        "readMinutes": 6,
    }

if not post_core:
    print("[blog] using deterministic human-voice template")
    post_core = fallback_post(topic)

# Validate core fields
for k in ("slug", "titleEs", "titleEn", "excerptEs", "excerptEn", "bodyEs", "bodyEn"):
    if not str(post_core.get(k) or "").strip():
        die_msg = f"missing {k}"
        raise SystemExit(f"[blog] invalid post: {die_msg}")

slug = re.sub(r"[^a-z0-9-]+", "-", str(post_core["slug"]).lower()).strip("-")
if not slug or slug in existing_slugs:
    slug = f"{topic['id']}-{today}"
if "{{figure:0}}" not in post_core["bodyEs"]:
    post_core["bodyEs"] += "\n\n{{figure:0}}"
if "{{figure:0}}" not in post_core["bodyEn"]:
    post_core["bodyEn"] += "\n\n{{figure:0}}"

# Generate a simple on-brand SVG cover unique to today
def write_cover(slug: str, title: str) -> str:
    safe = re.sub(r"[^a-z0-9-]+", "-", slug)[:60]
    path = ASSETS / f"{safe}.svg"
    # wrap title
    words = title.split()
    lines = []
    cur = []
    for w in words:
        cur.append(w)
        if len(" ".join(cur)) > 28:
            lines.append(" ".join(cur[:-1]) or w)
            cur = [w]
    if cur:
        lines.append(" ".join(cur))
    lines = lines[:3]
    text_svg = ""
    y = 280
    for ln in lines:
        text_svg += f'<text x="96" y="{y}" font-family="Georgia, serif" font-size="40" fill="#1c1612">{xml_escape(ln)}</text>\n'
        y += 52
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720" role="img">
  <rect width="1200" height="720" fill="#f7f1e8"/>
  <rect x="48" y="48" width="1104" height="624" rx="28" fill="#fffdf9" stroke="#e2d4bc"/>
  <rect x="96" y="120" width="120" height="8" rx="4" fill="#c45c26"/>
  {text_svg}
  <text x="96" y="520" font-family="system-ui,sans-serif" font-size="20" fill="#6b5a4c">{xml_escape(topic['category'])} · Sur de Georgia</text>
  <text x="96" y="600" font-family="system-ui,sans-serif" font-size="16" fill="#8a7664">Leey Hernandez · Lock &amp; Key Realty · leeyrealty.com</text>
</svg>
'''
    path.write_text(svg, encoding="utf-8")
    return f"/assets/blog/{path.name}"

def xml_escape(s: str) -> str:
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )

cover_src = write_cover(slug, post_core["titleEs"])
fig = {
    "src": cover_src,
    "altEs": post_core["titleEs"],
    "altEn": post_core["titleEn"],
    "kind": "infographic",
    "captionEs": "Nota del día · leeyrealty.com/blog",
    "captionEn": "Note of the day · leeyrealty.com/blog",
}

post = {
    "slug": slug,
    "date": today,
    "updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
    "category": topic.get("category") or "market",
    "readMinutes": int(post_core.get("readMinutes") or 6),
    "tags": post_core.get("tags") or [topic.get("category", "market")],
    "areas": topic.get("areas") or [],
    "cover": fig,
    "figures": [fig],
    "titleEs": post_core["titleEs"],
    "titleEn": post_core["titleEn"],
    "excerptEs": post_core["excerptEs"],
    "excerptEn": post_core["excerptEn"],
    "bodyEs": post_core["bodyEs"],
    "bodyEn": post_core["bodyEn"],
}

# light anti-slop scrub
def scrub(s: str) -> str:
    bad = [
        "delve",
        "landscape",
        "testament",
        "seamless",
        "cutting-edge",
        "elevate your",
        "unlock",
        "game-changer",
        "in today's world",
        "it's important to note",
    ]
    out = s
    for b in bad:
        out = re.sub(b, "", out, flags=re.I)
    out = out.replace("—", " - ")  # humanizer prefers fewer em dashes
    out = re.sub(r"\s{2,}", " ", out)
    out = out.replace(" \n", "\n")
    return out

for k in ("titleEs", "titleEn", "excerptEs", "excerptEn", "bodyEs", "bodyEn"):
    post[k] = scrub(post[k]) if k.startswith("title") or k.startswith("excerpt") else post[k]
    if k.startswith("body"):
        # keep paragraph breaks
        post[k] = post[k].replace("—", " - ")

data["posts"].append(post)
data["posts"].sort(key=lambda p: p.get("date") or "", reverse=True)
data["updatedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
data["version"] = 1
POSTS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"[blog] wrote {slug} → {POSTS_PATH}")
print(f"[blog] total posts={len(data['posts'])}")
PY

# 2) Ship if blog files changed
if git diff --quiet HEAD -- public/data/blog public/assets/blog 2>/dev/null; then
  log "[git] no blog changes — done"
  exit 0
fi

git add public/data/blog public/assets/blog
if git diff --cached --quiet; then
  log "[git] nothing staged"
  exit 0
fi

SLUG=$(python3 -c 'import json;d=json.load(open("public/data/blog/posts.json"));print(d["posts"][0]["slug"])')
git commit -m "content(blog): daily note ${SLUG}"
git push origin HEAD || die "push failed"
log "[ship] deploying blog"
env -u CLOUDFLARE_API_TOKEN npm run ship
log "DONE: blog published ${SLUG}"
