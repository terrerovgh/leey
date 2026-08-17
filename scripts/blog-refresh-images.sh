#!/usr/bin/env bash
# Refresh blog post images with listing-first color policy (image-search + image-download).
# Usage: DAY=YYYY-MM-DD TOPIC=id SLUG=slug bash scripts/blog-refresh-images.sh
set -euo pipefail
ROOT="${LEEY_ROOT:-/home/terrerov/Projects/leey}"
cd "$ROOT"
export PATH="${HOME}/.local/bin:${HOME}/.npm-global/bin:/usr/local/bin:${PATH}"

DAY="${DAY:?DAY required}"
TOPIC="${TOPIC:?TOPIC required}"
SLUG="${SLUG:?SLUG required}"
PIPE=scripts/blog_pipeline/run.py
WD="data/blog/pipeline/$DAY"
mkdir -p "$WD"

echo "======== REFRESH IMAGES $SLUG day=$DAY topic=$TOPIC ========"

# Ensure topic pinned
python3 "$PIPE" --date "$DAY" --stage topic --topic-id "$TOPIC" --force
python3 - <<PY
import json
t=json.load(open("$WD/topic.json"))
assert t.get("id")=="$TOPIC", t.get("id")
print("topic_ok", t["id"], "areas", t.get("areas"))
PY

rm -f "$WD/image_candidates.json" "$WD/assets.json"
LEEY_BLOG_DAY="$DAY" bash scripts/blog_agents/03a-image-search.sh
LEEY_BLOG_DAY="$DAY" bash scripts/blog_agents/03b-image-download.sh

python3 - <<PY
import json
from pathlib import Path
from datetime import datetime, timezone
from PIL import Image

day = "$DAY"
slug = "$SLUG"
wd = Path(f"data/blog/pipeline/{day}")
assets = json.loads((wd / "assets.json").read_text())
imgs = assets.get("images") or []
assert len(imgs) >= 1, "no images"
assert int(assets.get("photo_count") or 0) >= 1

# color gate
for im in imgs:
    src = im.get("local") or ""
    if src.endswith(".svg"):
        raise SystemExit(f"svg not allowed: {src}")
    p = Path("public") / src.lstrip("/")
    assert p.exists(), src
    with Image.open(p) as img:
        img = img.convert("RGB")
        img.thumbnail((48, 48))
        px = list(img.getdata())
    chroma = sum(max(r, g, b) - min(r, g, b) for r, g, b in px) / max(1, len(px))
    print(f"ok {p.name} src={im.get('source')} chroma={chroma:.1f} {(im.get('title') or '')[:60]}")
    assert chroma >= 12, f"B&W {src}"

# merge into posts.json preserving body/text
feed_path = Path("public/data/blog/posts.json")
feed = json.loads(feed_path.read_text())
now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
found = False
for post in feed.get("posts") or []:
    if post.get("slug") != slug:
        continue
    found = True
    figs = []
    for im in imgs:
        addr = im.get("address") or im.get("city") or "South Georgia"
        artist = im.get("artist") or ("Lock & Key Realty" if im.get("source") == "listing" else "Photo")
        if im.get("source") == "listing":
            cap_es = f"Foto listing · {artist} · {im.get('city') or ''}".strip(" ·")
            cap_en = f"Listing photo · {artist} · {im.get('city') or ''}".strip(" ·")
            alt_es = f"Casa en inventario · {addr}"
            alt_en = f"Inventory home · {addr}"
        else:
            lic = im.get("license") or ""
            cap_es = f"Foto: {artist} · {lic}".strip(" ·")
            cap_en = f"Photo: {artist} · {lic}".strip(" ·")
            alt_es = f"Foto relacionada · {artist}"
            alt_en = f"Related photo · {artist}"
        figs.append({
            "src": im["local"],
            "altEs": alt_es,
            "altEn": alt_en,
            "captionEs": cap_es,
            "captionEn": cap_en,
        })
    post["cover"] = {"src": imgs[0]["local"], "altEs": figs[0]["altEs"], "altEn": figs[0]["altEn"]}
    post["figures"] = figs
    post["updatedAt"] = now
    # keep body markers if missing
    for k in ("bodyEs", "bodyEn"):
        b = post.get(k) or ""
        if "{{figure:0}}" not in b:
            post[k] = b.rstrip() + "\n\n{{figure:0}}"
    print("updated post", slug, "listing_photos", assets.get("listing_photo_count"), "total", len(figs))
    break
assert found, f"slug not in feed: {slug}"
feed["updatedAt"] = now
feed_path.write_text(json.dumps(feed, ensure_ascii=False, indent=2) + "\n")

# also sync final.json for pipeline continuity
final_path = wd / "final.json"
if final_path.exists():
    final = json.loads(final_path.read_text())
else:
    final = next(p for p in feed["posts"] if p["slug"] == slug)
final["cover"] = next(p for p in feed["posts"] if p["slug"] == slug)["cover"]
final["figures"] = next(p for p in feed["posts"] if p["slug"] == slug)["figures"]
final["slug"] = slug
final["date"] = day
final["updatedAt"] = now
final_path.write_text(json.dumps(final, ensure_ascii=False, indent=2) + "\n")
(wd / "READY.json").write_text(json.dumps({"date": day, "slug": slug, "ready": True, "validationOk": True, "at": now}, indent=2) + "\n")
print("DONE", slug)
PY
