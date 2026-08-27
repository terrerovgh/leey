#!/usr/bin/env bash
# Agent: leey-blog-review
# Phase: 5.5 — Revisión final de calidad antes de publicar
# Inputs:  posts ready in data/blog/queue.json (status=ready)
# Outputs: REVIEWED.json / DISCARDED.json, queue status updated
# Models:  strong decision models (claude/gpt-4o) with free fallback
# Fail:    non-zero only if the review runner itself crashes; discards are OK.
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/common.sh"

report_header "leey-blog-review" "queue"

# Run reviewer over all ready posts in the pool
run_stage "$(date +%F)" review-queue --force || exit_fail "review-queue failed"

python3 - <<PY
import json, sys
from pathlib import Path
q = json.loads(Path("data/blog/queue.json").read_text(encoding="utf-8"))
reviewed = [p for p in q.get("posts", []) if p.get("status") == "reviewed"]
ready = [p for p in q.get("posts", []) if p.get("status") == "ready"]
discarded = [p for p in q.get("posts", []) if p.get("status") == "discarded"]
print(f"pool reviewed={len(reviewed)} ready={len(ready)} discarded={len(discarded)} target={q.get('target')}")
if not reviewed and not ready:
    print("WARN: no reviewed or ready posts available for future publish")
print("GATE OK: review pass complete")
PY

exit_ok
