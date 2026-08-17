#!/usr/bin/env bash
# Backward-compatible entry: full multi-agent pipeline + publish.
set -euo pipefail
ROOT="${LEEY_ROOT:-/home/terrerov/Projects/leey}"
cd "$ROOT"
export PATH="${HOME}/.local/bin:${HOME}/.npm-global/bin:/usr/local/bin:${PATH}"
exec python3 scripts/blog_pipeline/run.py --stage all "$@"
