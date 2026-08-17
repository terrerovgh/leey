#!/usr/bin/env bash
# Agent: leey-blog-image-download
# Phase: 3b — Descarga + filtros de calidad de imagen
# Inputs:  image_candidates.json (o lo genera si falta) + topic.json
# Policy:
#   - Preferir fotos de listings activos (GAMLS/Lock & Key)
#   - Si internet no trae algo mejor/mas relevante, USAR listing
#   - Rechazar B&W / baja croma (PIL)
#   - Rechazar archival/HABS/vintage/pre-2015 por metadata
#   - No reutilizar hashes de otros posts
# Outputs: public/assets/blog/YYYYMMDD/*.jpg, assets.json, ATTRIBUTION.md
# Fail:    sin cover usable
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/common.sh"

DAY="$(resolve_day tomorrow "${1:-}")"
WD="$(work_dir "$DAY")"
report_header "leey-blog-image-download" "$DAY"

require_file "$WD/topic.json" "topic.json (run topic agent first)" || exit_fail "dependency topic"

if [[ ! -f "$WD/image_candidates.json" ]]; then
  echo "NOTE: image_candidates.json missing — running image-search first"
  run_stage "$DAY" image-search --force || exit_fail "image-search prerequisite"
fi

run_stage "$DAY" image-download --force || exit_fail "image-download stage exited non-zero"

require_file "$WD/assets.json" "assets.json" || exit_fail "assets gate"
COVER="$(json_get "$WD/assets.json" cover '')"
PHOTO_N="$(json_get "$WD/assets.json" photo_count 0)"
LISTING_N="$(json_get "$WD/assets.json" listing_photo_count 0)"
echo "cover=$COVER photo_count=$PHOTO_N listing_photo_count=$LISTING_N"

if [[ -z "$COVER" ]]; then
  exit_fail "no cover produced"
fi
if [[ "$COVER" == *.svg ]]; then
  echo "WARN: cover is EN chart fallback only — prefer listings/web photos next run"
fi
if [[ "$COVER" == *porch-refresh* || "$COVER" == *offer-steps* || "$COVER" == *valdosta-areas* || "$COVER" == *kitchen-budget* ]]; then
  exit_fail "decorative SVG cover forbidden"
fi
if [[ "${PHOTO_N:-0}" -lt 1 ]]; then
  exit_fail "photo_count < 1"
fi

python3 - "$WD/assets.json" <<'PY'
import json
import sys
from pathlib import Path

from PIL import Image

assets = json.loads(Path(sys.argv[1]).read_text())
root = Path("/home/terrerov/Projects/leey")
checked = 0
ok = 0
for im in assets.get("images") or []:
    src = im.get("local") or ""
    if not src or src.endswith(".svg"):
        continue
    p = root / "public" / src.lstrip("/")
    if not p.exists():
        print(f"MISSING {src}")
        continue
    checked += 1
    with Image.open(p) as img:
        img = img.convert("RGB")
        img.thumbnail((48, 48))
        pixels = list(img.getdata())
    chroma = sum(max(r, g, b) - min(r, g, b) for r, g, b in pixels) / max(1, len(pixels))
    print(f"color_check {p.name} chroma={chroma:.1f} src={im.get('source')}")
    if chroma >= 12:
        ok += 1
if checked == 0:
    raise SystemExit("no raster images to color-check")
if ok == 0:
    raise SystemExit("all images failed color check")
print(f"color_ok {ok}/{checked}")
PY

echo "artifact=$WD/assets.json"
exit_ok
