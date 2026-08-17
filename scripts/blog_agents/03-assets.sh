#!/usr/bin/env bash
# Agent: leey-blog-assets (compat umbrella)
# Runs image-search + image-download (or combined --stage assets).
# Prefer the dedicated agents 03a/03b in cron; this remains for manual/prep.
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/common.sh"

DAY="$(resolve_day tomorrow "${1:-}")"
WD="$(work_dir "$DAY")"
report_header "leey-blog-assets" "$DAY"

require_file "$WD/topic.json" "topic.json (run topic agent first)" || exit_fail "dependency topic"

run_stage "$DAY" assets --force || exit_fail "assets stage exited non-zero"

require_file "$WD/assets.json" "assets.json" || exit_fail "assets gate"
COVER="$(json_get "$WD/assets.json" cover '')"
PHOTO_N="$(json_get "$WD/assets.json" photo_count 0)"
LISTING_N="$(json_get "$WD/assets.json" listing_photo_count 0)"
echo "cover=$COVER photo_count=$PHOTO_N listing_photo_count=$LISTING_N"

if [[ -z "$COVER" ]]; then
  exit_fail "no cover produced"
fi
if [[ "$COVER" == *.svg ]]; then
  echo "WARN: cover is chart/SVG fallback (EN only allowed). Prefer real photos next run."
fi
if [[ "$COVER" == *porch-refresh* || "$COVER" == *offer-steps* || "$COVER" == *valdosta-areas* || "$COVER" == *kitchen-budget* ]]; then
  exit_fail "decorative SVG cover forbidden"
fi
if [[ "${PHOTO_N:-0}" -lt 1 ]]; then
  exit_fail "photo_count < 1"
fi

echo "artifact=$WD/assets.json"
exit_ok
