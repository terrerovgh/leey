#!/usr/bin/env bash
# Overnight prep chain: research → topic → assets → write → editor (TOMORROW)
set -euo pipefail
ROOT="${LEEY_ROOT:-/home/terrerov/Projects/leey}"
export LEEY_ROOT="$ROOT"
export LEEY_BLOG_TARGET=tomorrow
DAY="${1:-}"
fail=0
for s in 01-research 02-topic 03-assets 04-write 05-editor; do
  echo ">>>> prep chain: $s"
  if ! bash "$ROOT/scripts/blog_agents/${s}.sh" ${DAY:+$DAY}; then
    echo "prep chain FAIL at $s"
    exit 1
  fi
done
echo "DONE prep chain"
