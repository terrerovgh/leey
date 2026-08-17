#!/usr/bin/env bash
# Agent: leey-blog-research
# Phase: 1 — Investigación de mercado / temporada / inventario / snippets web
# Inputs:  public/data/listings.json, free web HTML snippets
# Outputs: data/blog/pipeline/DATE/research.json (+ research.round*.txt)
# Models:  free-then-local → free → local → background (via pipeline)
# Fail:    deterministic season fallback still writes research.json
set -euo pipefail
# shellcheck source=common.sh
source "$(cd "$(dirname "$0")" && pwd)/common.sh"

DAY="$(resolve_day tomorrow "${1:-}")"
WD="$(work_dir "$DAY")"
report_header "leey-blog-research" "$DAY"

run_stage "$DAY" research --force || exit_fail "research stage exited non-zero"

require_file "$WD/research.json" "research.json" || exit_fail "research gate"
SEASON="$(json_get "$WD/research.json" season unknown)"
WEB_OK="$(json_get "$WD/research.json" web_ok 0)"
echo "season=$SEASON web_ok=$WEB_OK"
echo "artifact=$WD/research.json"
exit_ok
