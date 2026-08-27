#!/usr/bin/env bash
# Health check for the Leey blog + listings multi-agent system.
# Exit 0 when healthy, non-zero when any critical check fails.
#
# Usage:
#   bash scripts/blog-health.sh
#   bash scripts/blog-health.sh --notify   # print compact report for cron delivery

set -uo pipefail

ROOT="${LEEY_ROOT:-/home/terrerov/Projects/leey}"
cd "$ROOT"

# Load project secrets when available.
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ROOT/.env"
  set +a
fi

NOTIFY=0
if [[ "${1:-}" == "--notify" ]]; then
  NOTIFY=1
fi

ERRORS=0
WARNINGS=0

log() {
  if [[ "$NOTIFY" == "0" ]]; then
    echo "$*"
  fi
}

warn() {
  WARNINGS=$((WARNINGS + 1))
  if [[ "$NOTIFY" == "0" ]]; then
    echo "WARN: $*"
  fi
}

fail() {
  ERRORS=$((ERRORS + 1))
  if [[ "$NOTIFY" == "0" ]]; then
    echo "FAIL: $*"
  fi
}

ok() {
  if [[ "$NOTIFY" == "0" ]]; then
    echo "OK:   $*"
  fi
}

# 1) Hermes crons present and active
EXPECTED_CRONS=(
  leey-daily-listings
  leey-blog-research
  leey-blog-topic
  leey-blog-image-search
  leey-blog-image-download
  leey-blog-writer
  leey-blog-editor
  leey-blog-publish
  leey-blog-health
)
CRON_LIST=$(hermes cron list 2>/dev/null || true)
MISSING_CRONS=()
for name in "${EXPECTED_CRONS[@]}"; do
  if ! echo "$CRON_LIST" | grep -q "Name:.*$name"; then
    MISSING_CRONS+=("$name")
  fi
done
if [[ ${#MISSING_CRONS[@]} -eq 0 ]]; then
  ok "Hermes crons: all ${#EXPECTED_CRONS[@]} jobs present"
else
  fail "Hermes crons missing: ${MISSING_CRONS[*]}"
fi

# 2) Latest published post not older than 48h
TODAY=$(date +%F)
YESTERDAY=$(date -d 'yesterday' +%F 2>/dev/null || date -v-1d +%F)
LATEST_POST_DATE=$(python3 - <<'PY'
import json, sys
from pathlib import Path
try:
    d = json.loads(Path("public/data/blog/posts.json").read_text(encoding="utf-8"))
    posts = sorted((d.get("posts") or []), key=lambda p: p.get("date", ""), reverse=True)
    print(posts[0].get("date", "") if posts else "")
except Exception as e:
    print("")
PY
)
if [[ -n "$LATEST_POST_DATE" && ( "$LATEST_POST_DATE" == "$TODAY" || "$LATEST_POST_DATE" == "$YESTERDAY" ) ]]; then
  ok "latest post date=$LATEST_POST_DATE"
else
  fail "latest post is stale (date=$LATEST_POST_DATE, expected $YESTERDAY or $TODAY)"
fi

# 3) Latest pipeline workdir has READY.json and PUBLISHED.json for latest post date
if [[ -n "$LATEST_POST_DATE" ]]; then
  WD="$ROOT/data/blog/pipeline/$LATEST_POST_DATE"
  if [[ -f "$WD/PUBLISHED.json" ]]; then
    ok "pipeline PUBLISHED.json exists for $LATEST_POST_DATE"
  else
    fail "pipeline PUBLISHED.json missing for $LATEST_POST_DATE"
  fi
fi

# 4) Listings feed fresh (< 48h)
LISTINGS_AGE_HOURS=$(python3 - <<'PY'
import json
from datetime import datetime, timezone
from pathlib import Path

try:
    d = json.loads(Path("public/data/listings.json").read_text(encoding="utf-8"))
    synced = d.get("syncedAt")
    if not synced:
        print("9999")
        raise SystemExit
    dt = datetime.fromisoformat(synced.replace("Z", "+00:00"))
    hours = (datetime.now(timezone.utc) - dt).total_seconds() / 3600
    print(int(hours))
except Exception:
    print("9999")
PY
)
if [[ "$LISTINGS_AGE_HOURS" -lt 48 ]]; then
  ok "listings synced ${LISTINGS_AGE_HOURS}h ago"
else
  fail "listings stale (${LISTINGS_AGE_HOURS}h ago)"
fi

# 5) CMS agent status (soft check, only if token configured)
AGENT_TOKEN="${LEEY_BLOG_AGENT_TOKEN:-}"
CMS_URL="${LEEY_BLOG_CMS_URL:-https://leeyrealty.com}"
if [[ -n "$AGENT_TOKEN" ]]; then
  CMS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "x-agent-token: $AGENT_TOKEN" \
    "$CMS_URL/api/blog/agent/status" 2>/dev/null || echo "000")
  if [[ "$CMS_STATUS" == "200" ]]; then
    ok "CMS agent status HTTP 200"
  else
    warn "CMS agent status HTTP $CMS_STATUS"
  fi
else
  warn "LEEY_BLOG_AGENT_TOKEN not set, skipping CMS check"
fi

# Summary
if [[ "$NOTIFY" == "1" ]]; then
  if [[ "$ERRORS" -eq 0 ]]; then
    echo "leey health: OK ($WARNINGS warnings)"
  else
    echo "leey health: FAIL ($ERRORS errors, $WARNINGS warnings)"
  fi
else
  echo ""
  echo "=== summary ==="
  if [[ "$ERRORS" -eq 0 && "$WARNINGS" -eq 0 ]]; then
    echo "STATUS: OK"
  elif [[ "$ERRORS" -eq 0 ]]; then
    echo "STATUS: OK with warnings"
  else
    echo "STATUS: FAIL"
  fi
  echo "errors=$ERRORS warnings=$WARNINGS"
fi

exit "$ERRORS"
