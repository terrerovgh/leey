#!/usr/bin/env bash
# Overnight prep for TOMORROW's 07:00 publish (or DATE if provided).
set -euo pipefail
ROOT="${LEEY_ROOT:-/home/terrerov/Projects/leey}"
cd "$ROOT"
export PATH="${HOME}/.local/bin:${HOME}/.npm-global/bin:/usr/local/bin:${PATH}"
if [[ -n "${1:-}" ]]; then
  DAY="$1"
else
  DAY="$(date -d 'tomorrow' +%F 2>/dev/null || date -v+1d +%F)"
fi
echo "=== blog PREP for $DAY ==="
python3 scripts/blog_pipeline/run.py --date "$DAY" --stage prep
echo "DONE prep $DAY"
