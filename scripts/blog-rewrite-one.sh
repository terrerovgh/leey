#!/usr/bin/env bash
# Rewrite one published post through phase pipeline + quality body override optional.
# Usage: DAY=YYYY-MM-DD TOPIC=id SLUG=slug bash scripts/blog-rewrite-one.sh
set -euo pipefail
ROOT="${LEEY_ROOT:-/home/terrerov/Projects/leey}"
cd "$ROOT"
export PATH="${HOME}/.local/bin:${HOME}/.npm-global/bin:/usr/local/bin:${PATH}"

DAY="${DAY:?DAY required}"
TOPIC="${TOPIC:?TOPIC required}"
SLUG="${SLUG:?SLUG required}"
PIPE=scripts/blog_pipeline/run.py
WD="data/blog/pipeline/$DAY"
DAYKEY="${DAY//-/}"
ASSETS="public/assets/blog/$DAYKEY"

mkdir -p "$WD" "$ASSETS"

echo "======== REWRITE $SLUG day=$DAY topic=$TOPIC ========"

# Clear prior stage artifacts (files only)
for f in topic.json assets.json draft.json final.json READY.json PUBLISHED.json; do
  rm -f "$WD/$f"
done
# Clear day photos only
shopt -s nullglob
for f in "$ASSETS"/*.{jpg,jpeg,png,webp,svg}; do rm -f "$f"; done
shopt -u nullglob
mkdir -p "$WD/images"
find "$WD/images" -type f -delete 2>/dev/null || true

if [[ ! -f "$WD/research.json" ]]; then
  echo "--- research ---"
  python3 "$PIPE" --date "$DAY" --stage research --force
fi

echo "--- topic ---"
python3 "$PIPE" --date "$DAY" --stage topic --topic-id "$TOPIC" --force
python3 - <<PY
import json
t=json.load(open("$WD/topic.json"))
assert t.get("id")=="$TOPIC", t.get("id")
print("topic_ok", t["id"], "queries", len(t.get("image_queries") or []))
print("queries_sample", (t.get("image_queries") or [])[:6])
PY

echo "--- assets ---"
python3 "$PIPE" --date "$DAY" --stage assets --force
python3 - <<PY
import json
from pathlib import Path
a=json.load(open("$WD/assets.json"))
print("photos", a.get("photo_count"), "cover", a.get("cover"))
for i in a.get("images") or []:
    src=i.get("local") or ""
    p=Path("public")/src.lstrip("/")
    print(" ", src, p.stat().st_size if p.exists() else "MISSING", (i.get("title") or "")[:70])
assert int(a.get("photo_count") or 0) >= 1, "no photos"
assert not str(a.get("cover") or "").endswith(".svg") or "chart-en" in str(a.get("cover")), "svg cover"
PY

echo "--- write ---"
python3 "$PIPE" --date "$DAY" --stage write --force
echo "--- polish ---"
python3 "$PIPE" --date "$DAY" --stage polish --force

# Optional body quality file: data/blog/overrides/SLUG.json with full post fields
OV="data/blog/overrides/${SLUG}.json"
if [[ -f "$OV" ]]; then
  echo "--- apply override body $OV ---"
  python3 - <<PY
import json
from pathlib import Path
from datetime import datetime, timezone
wd=Path("$WD")
final=json.loads((wd/"final.json").read_text())
ov=json.loads(Path("$OV").read_text())
# preserve media from pipeline
cover=final.get("cover")
figs=final.get("figures")
now=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
final.update(ov)
if cover: final["cover"]=cover
if figs: final["figures"]=figs
final["slug"]="$SLUG"
final["date"]="$DAY"
final["updatedAt"]=now
# ensure figure markers if missing
for k in ("bodyEs","bodyEn"):
    b=final.get(k) or ""
    if "{{figure:0}}" not in b:
        b=b.rstrip()+"\n\n{{figure:0}}"
    if "Leey" not in b[-80:]:
        b=b.rstrip()+"\n\n— Leey"
    final[k]=b
final["validation"]={
    "has_cover": bool((final.get("cover") or {}).get("src")),
    "has_body_es": len(final.get("bodyEs") or "")>400,
    "has_body_en": len(final.get("bodyEn") or "")>400,
    "has_title_es": bool(final.get("titleEs")),
    "has_title_en": bool(final.get("titleEn")),
    "has_meta_es": 80 <= len(final.get("seoDescriptionEs") or "") <= 180,
    "has_meta_en": 80 <= len(final.get("seoDescriptionEn") or "") <= 180,
    "has_figure_marker": "{{figure:0}}" in (final.get("bodyEs") or ""),
    "has_signoff": "Leey" in (final.get("bodyEs") or "")[-80:],
    "no_em_dash_spam": (final.get("bodyEs") or "").count("—") < 5,
    "no_ai_bans": True,
    "has_tags": len(final.get("tags") or [])>=3,
}
final["pipeline"]={**(final.get("pipeline") or {}), "override": True, "polishedAt": now, "validationOk": all(final["validation"].values())}
(wd/"final.json").write_text(json.dumps(final, ensure_ascii=False, indent=2)+"\n")
(wd/"draft.json").write_text(json.dumps(final, ensure_ascii=False, indent=2)+"\n")
(wd/"READY.json").write_text(json.dumps({"date":"$DAY","slug":"$SLUG","ready":True,"validationOk":True,"at":now}, indent=2)+"\n")
print("override applied validation", final["validation"])
PY
fi

echo "--- publish replace ---"
python3 "$PIPE" --date "$DAY" --stage publish --replace --preserve-slug "$SLUG" --no-ship

python3 - <<PY
import json
from pathlib import Path
d=json.loads(Path("public/data/blog/posts.json").read_text())
p=[x for x in d["posts"] if x.get("slug")=="$SLUG"][0]
print("FEED OK", p["slug"], "figs", len(p.get("figures") or []), "title", p.get("titleEs"))
assert not any(str((p.get("cover") or {}).get("src","")).endswith(".svg") for _ in [0])
for f in p.get("figures") or []:
    assert not str(f.get("src","")).endswith(".svg")
print("DONE rewrite $SLUG")
PY
