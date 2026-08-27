#!/usr/bin/env bash
# Shared helpers for Leey blog phase agents.
# shellcheck disable=SC2034
set -euo pipefail

LEEY_ROOT="${LEEY_ROOT:-/home/terrerov/Projects/leey}"
export LEEY_ROOT
cd "$LEEY_ROOT"
export PATH="${HOME}/.local/bin:${HOME}/.npm-global/bin:/usr/local/bin:${PATH}"

# Load project secrets (CMS agent token, API keys) when available.
if [[ -f "$LEEY_ROOT/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$LEEY_ROOT/.env"
  set +a
fi

PIPELINE="${LEEY_ROOT}/scripts/blog_pipeline/run.py"

# Target day:
#   LEEY_BLOG_DAY=YYYY-MM-DD  explicit
#   LEEY_BLOG_TARGET=tomorrow|today  (default per agent)
#   $1 optional date override
resolve_day() {
  local default_target="${1:-tomorrow}"
  if [[ -n "${LEEY_BLOG_DAY:-}" ]]; then
    echo "$LEEY_BLOG_DAY"
    return
  fi
  if [[ -n "${2:-}" && "$2" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    echo "$2"
    return
  fi
  case "${LEEY_BLOG_TARGET:-$default_target}" in
    today) date +%F ;;
    tomorrow) date -d 'tomorrow' +%F 2>/dev/null || date -v+1d +%F ;;
    *) date -d 'tomorrow' +%F 2>/dev/null || date -v+1d +%F ;;
  esac
}

work_dir() {
  echo "${LEEY_ROOT}/data/blog/pipeline/$1"
}

require_file() {
  local f="$1"
  local label="${2:-$f}"
  if [[ ! -f "$f" ]]; then
    echo "GATE FAIL: missing $label"
    echo "  path: $f"
    return 1
  fi
  echo "GATE OK: $label"
  return 0
}

json_get() {
  # json_get FILE KEY [default]
  python3 - "$1" "$2" "${3:-}" <<'PY'
import json, sys
path, key, default = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    d = json.loads(open(path, encoding="utf-8").read())
except Exception:
    print(default)
    raise SystemExit(0)
cur = d
for part in key.split("."):
    if isinstance(cur, dict) and part in cur:
        cur = cur[part]
    else:
        print(default)
        raise SystemExit(0)
if isinstance(cur, (dict, list)):
    print(json.dumps(cur, ensure_ascii=False)[:200])
else:
    print(cur if cur is not None else default)
PY
}

run_stage() {
  local day="$1"
  local stage="$2"
  shift 2
  echo "=== agent stage=$stage day=$day ==="
  echo "cwd=$LEEY_ROOT"
  echo "pipeline=$PIPELINE"
  python3 "$PIPELINE" --date "$day" --stage "$stage" "$@"
}

report_header() {
  local name="$1"
  local day="$2"
  echo "============================================================"
  echo "AGENT: $name"
  echo "DAY:   $day"
  echo "WHEN:  $(date -Is)"
  echo "HOST:  $(hostname 2>/dev/null || echo unknown)"
  echo "============================================================"
}

exit_ok() {
  echo "STATUS: OK"
  exit 0
}

exit_fail() {
  echo "STATUS: FAIL — $*"
  exit 1
}
