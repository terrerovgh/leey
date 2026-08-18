#!/usr/bin/env bash
# Push public/data/blog/posts.json into Blog Studio KV (full replace seed via agent upserts).
# Usage:
#   LEEY_BLOG_AGENT_TOKEN=… bash scripts/blog-cms-sync.sh
#   bash scripts/blog-cms-sync.sh --status
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Load .env if present (does not override existing env)
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

BASE="${LEEY_BLOG_CMS_URL:-${LEEY_SITE_URL:-https://leeyrealty.com}}"
BASE="${BASE%/}"
TOKEN="${LEEY_BLOG_AGENT_TOKEN:-${BLOG_AGENT_TOKEN:-}}"

if [[ "${1:-}" == "--status" ]]; then
  if [[ -z "$TOKEN" ]]; then
    echo "missing LEEY_BLOG_AGENT_TOKEN" >&2
    exit 2
  fi
  curl -fsS -H "x-agent-token: $TOKEN" "$BASE/api/blog/agent/status"
  echo
  exit 0
fi

if [[ -z "$TOKEN" ]]; then
  echo "Set LEEY_BLOG_AGENT_TOKEN (same as wrangler secret AGENT_TOKEN)" >&2
  exit 2
fi

python3 - <<'PY' "$BASE" "$TOKEN"
import json, sys, urllib.request
base, token = sys.argv[1], sys.argv[2]
posts = json.loads(open("public/data/blog/posts.json", encoding="utf-8").read()).get("posts") or []
ok = 0
for p in posts:
    payload = json.dumps({"post": p, "replaceByDate": False}).encode()
    req = urllib.request.Request(
        f"{base}/api/blog/agent/upsert",
        data=payload,
        method="POST",
        headers={"content-type": "application/json", "x-agent-token": token, "user-agent": "LeeyBlogCmsSync/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(p.get("slug"), r.status)
            ok += 1
    except Exception as e:
        print("FAIL", p.get("slug"), e)
print(f"done {ok}/{len(posts)}")
PY
