#!/usr/bin/env bash
# Agent: leey-blog-writer
# Phase: 4 — Redacción bilingüe (copy SEO + voz Leey)
# Inputs:  research.json, topic.json, assets.json
# Outputs: draft.json
# Models:  free-then-local with JSON correction rounds; human template fallback
# Fail:    aborts if draft missing or body too short
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/common.sh"

DAY="$(resolve_day tomorrow "${1:-}")"
WD="$(work_dir "$DAY")"
report_header "leey-blog-writer" "$DAY"

require_file "$WD/research.json" "research.json" || exit_fail "dependency research"
require_file "$WD/topic.json" "topic.json" || exit_fail "dependency topic"
require_file "$WD/assets.json" "assets.json" || exit_fail "dependency assets"

run_stage "$DAY" write --force || exit_fail "write stage exited non-zero"

require_file "$WD/draft.json" "draft.json" || exit_fail "write gate"

python3 - <<PY
import json, sys
from pathlib import Path
d=json.loads(Path("$WD/draft.json").read_text(encoding="utf-8"))
bes=len(d.get("bodyEs") or "")
ben=len(d.get("bodyEn") or "")
title=d.get("titleEs") or ""
cover=(d.get("cover") or {}).get("src") or ""
print(f"titleEs={title[:80]}")
print(f"bodyEs_chars={bes} bodyEn_chars={ben}")
print(f"cover={cover}")
print(f"writeFallback={((d.get('pipeline') or {}).get('writeFallback'))}")
ok = bes >= 350 and ben >= 350 and bool(title) and bool(cover)
if not ok:
    print("GATE FAIL: draft too thin or missing cover/title")
    sys.exit(2)
print("GATE OK: draft body/title/cover")
PY

echo "artifact=$WD/draft.json"
exit_ok
