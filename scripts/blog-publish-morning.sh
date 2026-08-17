#!/usr/bin/env bash
# 07:00 publisher: if prep is ready, publish; else run full pipeline then publish.
set -euo pipefail
ROOT="${LEEY_ROOT:-/home/terrerov/Projects/leey}"
cd "$ROOT"
export PATH="${HOME}/.local/bin:${HOME}/.npm-global/bin:/usr/local/bin:${PATH}"
DAY="${1:-$(date +%F)}"
READY="data/blog/pipeline/$DAY/READY.json"
echo "=== blog PUBLISH $DAY ==="
if [[ -f "$READY" ]]; then
  echo "[morning] prep ready — publish only"
  python3 scripts/blog_pipeline/run.py --date "$DAY" --stage publish
else
  echo "[morning] no prep — full pipeline + publish"
  python3 scripts/blog_pipeline/run.py --date "$DAY" --stage all
fi
echo "DONE publish $DAY"
