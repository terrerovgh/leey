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
SCHED_RESEARCH="0 21 * * *"
SCHED_TOPIC="20 21 * * *"
SCHED_IMG_SEARCH="30 21 * * *"
SCHED_IMG_DOWNLOAD="45 21 * * *"
SCHED_WRITE="10 22 * * *"
SCHED_EDITOR="40 22 * * *"
SCHED_PUBLISH="0 7 * * *"
SCHED_LISTINGS="0 7 * * *"

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
create_agent_cron \
  "leey-blog-research" \
  "$SCHED_RESEARCH" \
  "leey-blog-01-research.sh" \
  "You are the leey-blog-research specialized bot. Run only the research phase for tomorrow's Leey Realty blog post. Do not cascade into other phases. Report STATUS OK/FAIL."

create_agent_cron \
  "leey-blog-topic" \
  "$SCHED_TOPIC" \
  "leey-blog-02-topic.sh" \
  "You are the leey-blog-topic specialized bot. Run only the topic selection phase for tomorrow's Leey Realty blog post. Do not cascade into other phases. Report STATUS OK/FAIL."

create_agent_cron \
  "leey-blog-image-search" \
  "$SCHED_IMG_SEARCH" \
  "leey-blog-03a-image-search.sh" \
  "You are the leey-blog-image-search specialized bot. Run only the image-search phase for tomorrow's Leey Realty blog post. Do not cascade into other phases. Report STATUS OK/FAIL."

create_agent_cron \
  "leey-blog-image-download" \
  "$SCHED_IMG_DOWNLOAD" \
  "leey-blog-03b-image-download.sh" \
  "You are the leey-blog-image-download specialized bot. Run only the image-download phase for tomorrow's Leey Realty blog post. Do not cascade into other phases. Report STATUS OK/FAIL."

create_agent_cron \
  "leey-blog-writer" \
  "$SCHED_WRITE" \
  "leey-blog-04-write.sh" \
  "You are the leey-blog-writer specialized bot. Run only the write phase for tomorrow's Leey Realty blog post. Do not cascade into other phases. Report STATUS OK/FAIL."

create_agent_cron \
  "leey-blog-editor" \
  "$SCHED_EDITOR" \
  "leey-blog-05-editor.sh" \
  "You are the leey-blog-editor specialized bot. Run only the editor/polish phase for tomorrow's Leey Realty blog post. Do not cascade into other phases. Report STATUS OK/FAIL."

create_agent_cron \
  "leey-blog-publish" \
  "$SCHED_PUBLISH" \
  "leey-blog-06-publish.sh" \
  "You are the leey-blog-publish specialized bot. Publish today's ready Leey Realty blog post. If READY.json is missing you may run catch-up, otherwise publish only. Report STATUS OK/FAIL."

echo "[cron] installation complete"
if [[ "$DRY_RUN" == "0" ]]; then
  hermes cron list
fi
