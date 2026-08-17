#!/usr/bin/env bash
set -euo pipefail
export LEEY_BLOG_TARGET=today
exec bash "$(cd "$(dirname "$0")" && pwd)/blog_agents/06-publish.sh" "$@"
