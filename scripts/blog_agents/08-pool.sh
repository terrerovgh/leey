#!/usr/bin/env bash
# Agent: leey-blog-pool
# Phase: 8 — Mantener un pool de posts listos para publicar
# Behavior:
#   - Generate up to 3 new posts if the active pool has fewer than 10 ready/reviewed posts.
#   - Does NOT publish; leaves posts ready for the review agent.
# Inputs:  data/blog/topics.json, listings, data/blog/queue.json
# Outputs: new workdirs, updated queue.json
# Models:  decision models for topic/research, creative for write/polish
# Fail:    non-zero if no post could be generated and pool is below target.
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/common.sh"

DAY="$(resolve_day tomorrow "${1:-}")"
report_header "leey-blog-pool" "$DAY"

# Generate posts to fill the pool (target 10, up to 3 per run)
run_stage "$DAY" pool --target 3 || exit_fail "pool stage failed"

python3 - <<PY
import json, sys
from pathlib import Path
q = json.loads(Path("data/blog/queue.json").read_text(encoding="utf-8"))
active = [p for p in q.get("posts", []) if p.get("status") in ("ready", "reviewed")]
target = q.get("target", 10)
print(f"pool active={len(active)} target={target}")
if len(active) >= target:
    print("GATE OK: pool at target")
elif len(active) >= target // 2:
    print(f"WARN: pool below target ({len(active)}/{target})")
else:
    print(f"GATE FAIL: pool critically low ({len(active)}/{target})")
    sys.exit(2)
PY

exit_ok
