#!/usr/bin/env bash
# Agent: leey-blog-publish
# Phase: 6 — Publicación (posts.json → git → Cloudflare ship)
# Inputs:  READY.json + final.json for TODAY (morning job)
# Behavior:
#   - If READY exists → publish only
#   - Else catch-up: run full pipeline for today then publish
#   - Skip silently-ish if already published for day (pipeline returns 0)
# Models:  none for ship; may invoke free/local if catch-up needed
# Fail:    non-zero if hard validation / ship fails
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/common.sh"

DAY="$(resolve_day today "${1:-}")"
WD="$(work_dir "$DAY")"
report_header "leey-blog-publish" "$DAY"

READY="$WD/READY.json"
FINAL="$WD/final.json"

if [[ -f "$READY" && -f "$FINAL" ]]; then
  echo "mode=publish-only (prep ready)"
  run_stage "$DAY" publish || exit_fail "publish failed"
else
  echo "mode=catch-up (missing READY/final — full pipeline)"
  # Overnight agents prepare TOMORROW; if morning has nothing, build today now.
  python3 "$PIPELINE" --date "$DAY" --stage all || exit_fail "catch-up pipeline failed"
fi

# Verify feed has the day
python3 - <<PY
import json, sys
from pathlib import Path
day="$DAY"
posts=json.loads(Path("public/data/blog/posts.json").read_text(encoding="utf-8")).get("posts") or []
hit=[p for p in posts if p.get("date")==day]
if not hit:
    print(f"GATE FAIL: no post with date={day} in posts.json")
    sys.exit(2)
p=hit[0]
src=(p.get("cover") or {}).get("src") or ""
print(f"published slug={p.get('slug')} cover={src}")
if src.endswith(".svg") and "chart-en" not in src:
    print("WARN published with non-photo cover", src)
figs=p.get("figures") or []
print(f"figures={len(figs)}")
print("GATE OK: feed contains day post")
PY

echo "live_check: https://leeyrealty.com/blog/"
echo "feed: https://leeyrealty.com/data/blog/posts.json"
exit_ok
