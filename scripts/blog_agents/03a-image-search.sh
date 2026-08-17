#!/usr/bin/env bash
# Agent: leey-blog-image-search
# Phase: 3a — Solo busqueda de candidatas (NO descarga pesada)
# Inputs:  topic.json (areas, category, image_queries)
# Sources: 1) fotos live de public/data/listings.json (preferidas)
#          2) Wikimedia/Openverse color modernas (sin HABS/archivo/B&W)
# Outputs: data/blog/pipeline/DATE/image_candidates.json
# Fail:    sin topic o pool vacio
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/common.sh"

DAY="$(resolve_day tomorrow "${1:-}")"
WD="$(work_dir "$DAY")"
report_header "leey-blog-image-search" "$DAY"

require_file "$WD/topic.json" "topic.json (run topic agent first)" || exit_fail "dependency topic"

run_stage "$DAY" image-search --force || exit_fail "image-search stage exited non-zero"

require_file "$WD/image_candidates.json" "image_candidates.json" || exit_fail "candidates gate"
TOTAL="$(json_get "$WD/image_candidates.json" counts.total 0)"
LISTING="$(json_get "$WD/image_candidates.json" counts.listing 0)"
WEB="$(json_get "$WD/image_candidates.json" counts.web 0)"
echo "pool total=$TOTAL listing=$LISTING web=$WEB"

if [[ "${TOTAL:-0}" -lt 1 ]]; then
  exit_fail "empty candidate pool"
fi

echo "artifact=$WD/image_candidates.json"
exit_ok
