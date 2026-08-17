#!/usr/bin/env bash
# Agent: leey-blog-topic
# Phase: 2 — Elección de tema (banco + research + temporada + zonas)
# Inputs:  research.json, data/blog/topics.json, posts.json (anti-repeat)
# Outputs: data/blog/pipeline/DATE/topic.json
# Models:  none required (deterministic scoring); research.synth may seed angle
# Fail:    aborts if research.json missing
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/common.sh"

DAY="$(resolve_day tomorrow "${1:-}")"
WD="$(work_dir "$DAY")"
report_header "leey-blog-topic" "$DAY"

require_file "$WD/research.json" "research.json (run research agent first)" || exit_fail "dependency research"

run_stage "$DAY" topic --force || exit_fail "topic stage exited non-zero"

require_file "$WD/topic.json" "topic.json" || exit_fail "topic gate"
TID="$(json_get "$WD/topic.json" id unknown)"
CAT="$(json_get "$WD/topic.json" category unknown)"
ANGLE="$(json_get "$WD/topic.json" headline_angle '')"
echo "topic_id=$TID category=$CAT"
echo "angle=$ANGLE"
echo "artifact=$WD/topic.json"
exit_ok
