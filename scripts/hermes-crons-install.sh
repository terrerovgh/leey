#!/usr/bin/env bash
# Install / restore all Hermes crons for leeyrealty.com.
# Idempotent: removes previous leey-* crons before recreating them.
#
# Usage:
#   bash scripts/hermes-crons-install.sh
#   bash scripts/hermes-crons-install.sh --dry-run

set -euo pipefail

ROOT="${LEEY_ROOT:-/home/terrerov/Projects/leey}"
cd "$ROOT"

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

HERMES_SCRIPTS="${HOME}/.hermes/scripts"

# Hermes cron schedule is interpreted in the host's local timezone (ET on this machine).
# Keep the ET hours documented in BLOG.md.
SCHED_POOL="0 21 * * *"
SCHED_REVIEW="0 23 * * *"
SCHED_PUBLISH="0 7 * * *"
SCHED_LISTINGS="0 7 * * *"
SCHED_HEALTH="30 7 * * *"

remove_all_leey_crons() {
  local ids
  ids=$(hermes cron list 2>/dev/null | python3 -c '
import sys, re
text = sys.stdin.read()
current_id = None
for line in text.splitlines():
    m = re.match(r"\s*([a-f0-9]+)\s+\[active\]", line)
    if m:
        current_id = m.group(1)
        continue
    m = re.match(r"\s*Name:\s*(.+)", line)
    if m and current_id:
        if m.group(1).strip().startswith("leey-"):
            print(current_id)
        current_id = None
')
  for cid in $ids; do
    if [[ -n "$cid" ]]; then
      echo "[cron] removing previous leey job ($cid)"
      if [[ "$DRY_RUN" == "0" ]]; then
        hermes cron delete "$cid" || true
      fi
    fi
  done
}

create_agent_cron() {
  local name="$1"
  local schedule="$2"
  local script="$3"
  local prompt="$4"
  echo "[cron] creating $name -> $schedule ($script)"
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "  dry-run: hermes cron create \"$schedule\" ... --name $name --script $script --skill leey-blog-pipeline --model openrouter/free --workdir $ROOT --deliver local"
    return
  fi
  hermes cron create "$schedule" "$prompt" \
    --name "$name" \
    --script "$script" \
    --skill leey-blog-pipeline \
    --model openrouter/free \
    --workdir "$ROOT" \
    --deliver local
}

create_noagent_cron() {
  local name="$1"
  local schedule="$2"
  local script="$3"
  echo "[cron] creating $name -> $schedule ($script) --no-agent"
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "  dry-run: hermes cron create \"$schedule\" --no-agent --name $name --script $script --workdir $ROOT --deliver local"
    return
  fi
  hermes cron create "$schedule" \
    --no-agent \
    --name "$name" \
    --script "$script" \
    --workdir "$ROOT" \
    --deliver local
}

command -v hermes >/dev/null || { echo "ERROR: hermes not found"; exit 1; }

remove_all_leey_crons

# Daily listings update (no LLM)
create_noagent_cron \
  "leey-daily-listings" \
  "$SCHED_LISTINGS" \
  "leey-daily-listings-update.sh"

# Blog phase agents
# Pool + review maintain a rolling queue of >=10 ready/reviewed posts.
create_agent_cron \
  "leey-blog-pool" \
  "$SCHED_POOL" \
  "leey-blog-08-pool.sh" \
  "You are the leey-blog-pool specialized bot. Generate up to 3 new blog posts to keep the Leey Realty ready-post pool near 10 items. Do not publish. Report STATUS OK/FAIL and the final pool count."

create_agent_cron \
  "leey-blog-review" \
  "$SCHED_REVIEW" \
  "leey-blog-07-review.sh" \
  "You are the leey-blog-review specialized bot. Review all ready posts in the Leey Realty blog queue. Approve quality posts (REVIEWED.json) and discard posts that do not meet Leey's standards. Report STATUS OK/FAIL."

create_agent_cron \
  "leey-blog-publish" \
  "$SCHED_PUBLISH" \
  "leey-blog-06-publish.sh" \
  "You are the leey-blog-publish specialized bot. Publish the oldest reviewed post from the Leey Realty blog queue. If the queue is empty you may run catch-up, otherwise publish only. Report STATUS OK/FAIL."

# Daily health report (no LLM)
create_noagent_cron \
  "leey-blog-health" \
  "$SCHED_HEALTH" \
  "leey-blog-health.sh"

echo "[cron] installation complete"
if [[ "$DRY_RUN" == "0" ]]; then
  hermes cron list
fi
