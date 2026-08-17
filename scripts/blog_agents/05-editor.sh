#!/usr/bin/env bash
# Agent: leey-blog-editor
# Phase: 5 — Edición / SEO / anti-detección IA / validación
# Inputs:  draft.json
# Outputs: final.json, READY.json, validation checklist
# Models:  free/local polish + repair rounds; deterministic SEO guards always
# Fail:    aborts if hard validation fails (cover, titles, bodies)
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/common.sh"

DAY="$(resolve_day tomorrow "${1:-}")"
WD="$(work_dir "$DAY")"
report_header "leey-blog-editor" "$DAY"

require_file "$WD/draft.json" "draft.json (run writer first)" || exit_fail "dependency write"

run_stage "$DAY" polish --force || exit_fail "polish stage exited non-zero"

require_file "$WD/final.json" "final.json" || exit_fail "editor gate"
require_file "$WD/READY.json" "READY.json" || exit_fail "READY gate"

python3 - <<PY
import json, sys
from pathlib import Path
final=json.loads(Path("$WD/final.json").read_text(encoding="utf-8"))
ready=json.loads(Path("$WD/READY.json").read_text(encoding="utf-8"))
checks=final.get("validation") or {}
print("validation=", json.dumps(checks, ensure_ascii=False))
print("ready=", ready.get("ready"), "slug=", ready.get("slug") or final.get("slug"))
hard=["has_cover","has_body_es","has_body_en","has_title_es","has_title_en"]
missing=[k for k in hard if not checks.get(k)]
# if validation empty, compute minimal
if not checks:
    cover=bool((final.get("cover") or {}).get("src"))
    ok = cover and len(final.get("bodyEs") or "")>400 and len(final.get("bodyEn") or "")>400
    if not ok:
        print("GATE FAIL: incomplete final without validation map")
        sys.exit(2)
else:
    if missing:
        print("GATE FAIL hard:", missing)
        sys.exit(2)
soft=[k for k,v in checks.items() if not v and k not in hard]
if soft:
    print("WARN soft validation:", soft)
# ban decorative svg
src=(final.get("cover") or {}).get("src") or ""
if src.endswith(".svg") and "chart-en" not in src:
    # allow only EN chart fallback naming
    print("WARN cover is svg:", src)
print("GATE OK: editor hard validation")
PY

echo "artifact=$WD/final.json"
echo "ready=$WD/READY.json"
exit_ok
