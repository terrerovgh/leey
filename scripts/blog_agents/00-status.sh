#!/usr/bin/env bash
# Agent helper: print pipeline status for a day (default tomorrow)
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/common.sh"
DAY="$(resolve_day tomorrow "${1:-}")"
WD="$(work_dir "$DAY")"
report_header "leey-blog-status" "$DAY"
echo "workdir=$WD"
for f in research.json topic.json assets.json draft.json final.json READY.json PUBLISHED.json; do
  if [[ -f "$WD/$f" ]]; then
    sz=$(wc -c <"$WD/$f" | tr -d ' ')
    echo "  [x] $f (${sz}b)"
  else
    echo "  [ ] $f"
  fi
done
if [[ -f "$WD/pipeline.log.jsonl" ]]; then
  echo "--- last log lines ---"
  tail -n 8 "$WD/pipeline.log.jsonl" || true
fi
exit 0
