#!/usr/bin/env bash
# Daily Lock & Key inventory update for leeyrealty.com
# - free public GAMLS only (no RapidAPI required)
# - refreshes active MLS ids from office LKEY01 agent pages
# - syncs public/data/listings.json
# - validates agent / phone / multi-photo coverage
# - commits + pushes + ships only when feed content changes
#
# Designed for Hermes cron --no-agent (zero LLM tokens).
# Exit 0 always on "no change" so cron stays quiet; non-zero only on hard fail.

set -euo pipefail

ROOT="${LEEY_ROOT:-/home/terrerov/Projects/leey}"
cd "$ROOT"

export PATH="${HOME}/.local/bin:${HOME}/.npm-global/bin:/usr/local/bin:${PATH}"
export SYNC_MODE="${SYNC_MODE:-brokerage}"
export GAMLS_ENABLED="${GAMLS_ENABLED:-1}"
export KEEP_LAST_GOOD="${KEEP_LAST_GOOD:-1}"
# Skip paid APIs by default so free daily runs stay free.
export REALTOR_ENABLED="${REALTOR_ENABLED:-0}"
export ZILLOW_MAX_LISTINGS="${ZILLOW_MAX_LISTINGS:-0}"

log() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

command -v node >/dev/null || die "node not found"
command -v npm >/dev/null || die "npm not found"
command -v git >/dev/null || die "git not found"
command -v python3 >/dev/null || die "python3 not found"

log "=== leey daily listings update ==="
log "root: $ROOT"
log "when: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
log "mode: $SYNC_MODE"

# 1) Refresh active MLS ids from public GAMLS office roster (free)
python3 - <<'PY'
from pathlib import Path
import re, time, urllib.request

ROOT = Path(".").resolve()
OUT = ROOT / "data" / "mls-ids.txt"
UA = "Mozilla/5.0 (compatible; LeeyRealtyDaily/1.0; +https://leeyrealty.com)"
OFFICE = "https://www.georgiamls.com/real-estate-offices/LKEY01"

def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read().decode("utf-8", "replace")

html = fetch(OFFICE)
agents = sorted(set(re.findall(r"/real-estate-agents/([A-Z0-9]+)", html)))
agents = [a for a in agents if a not in {"directory"} and not a.lower().endswith(".cfm")]
print(f"[roster] office agents: {len(agents)}")

active = []
seen = set()
for code in agents:
    try:
        page = fetch(f"https://www.georgiamls.com/real-estate-agents/{code}")
    except Exception as e:
        print(f"[roster] skip agent {code}: {e}")
        time.sleep(0.4)
        continue
    text = re.sub(r"<script[\s\S]*?</script>", " ", page, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "\n", text)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&")
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    for i, ln in enumerate(lines):
        m = re.match(r"MLS#:\s*(\d+)", ln)
        if not m:
            continue
        mls = m.group(1)
        status = None
        for j in range(i + 1, min(i + 5, len(lines))):
            if lines[j] in ("Active", "Sold", "Pending", "Contingent"):
                status = lines[j]
                break
            if lines[j].upper().startswith("SOLD"):
                status = "Sold"
                break
        if status != "Active":
            continue
        if mls in seen:
            continue
        seen.add(mls)
        active.append(mls)
    time.sleep(0.35)

print(f"[roster] active MLS ids: {len(active)}")
if not active:
    print("[roster] no active ids discovered — keeping existing mls-ids.txt")
    raise SystemExit(0)

header = """# Lock and Key / Leey — one GAMLS number per line
# Resolved via public Georgia MLS (no RapidAPI needed).
# Sold are skipped unless GAMLS_INCLUDE_SOLD=1.
#
# Source: GAMLS office LKEY01 agent pages (Active only), auto-refreshed.
# Verify: https://www.georgiamls.com/listing/{MLS}
#
# Paste ACTIVE ids below:
"""
OUT.write_text(header + "\n".join(active) + "\n", encoding="utf-8")
print(f"[roster] wrote {OUT} ({len(active)} ids)")
PY

# 2) Sync feed (GAMLS public + optional manual seed)
log "[sync] running SYNC_MODE=$SYNC_MODE npm run sync:zillow"
SYNC_MODE="$SYNC_MODE" REALTOR_ENABLED=0 npm run sync:zillow

FEED="public/data/listings.json"
[[ -f "$FEED" ]] || die "missing $FEED after sync"

# 3) Validate coverage
python3 - <<'PY'
import json, sys
from pathlib import Path
from collections import Counter
p = Path("public/data/listings.json")
d = json.loads(p.read_text())
rows = d.get("listings") or []
n = len(rows)
if n == 0:
    print("[validate] FAIL: 0 listings")
    sys.exit(2)

def ok(x):
    return x not in (None, "", [], 0)

with_agent = sum(1 for x in rows if ok(x.get("listedBy")))
with_phone = sum(1 for x in rows if ok(x.get("listedByPhone")))
with_multi = sum(1 for x in rows if len(x.get("images") or []) >= 3)
with_desc = sum(1 for x in rows if len(str(x.get("description") or "")) >= 80)
with_price = sum(1 for x in rows if (x.get("priceUsd") or 0) > 0)
brokers = Counter((x.get("brokerage") or "?").lower() for x in rows)
non_lk = [b for b in brokers if "lock" not in b]

print(f"[validate] listings={n} agent={with_agent}/{n} phone={with_phone}/{n} multiPhoto={with_multi}/{n} desc={with_desc}/{n} priced={with_price}/{n}")
print(f"[validate] agents: {dict(Counter(x.get('listedBy') or '?' for x in rows))}")
print(f"[validate] cities: {dict(Counter(x.get('city') or '?' for x in rows))}")
print(f"[validate] syncedAt={d.get('syncedAt')} sources={d.get('meta',{}).get('sourcesUsed')}")

if with_price == 0:
    print("[validate] FAIL: all prices are 0")
    sys.exit(3)
if non_lk:
    print(f"[validate] FAIL: non Lock & Key brokerages present: {non_lk}")
    sys.exit(4)
if with_phone < n:
    print(f"[validate] WARN: {n - with_phone} listings missing listedByPhone")
if with_multi < max(1, n // 2):
    print(f"[validate] WARN: only {with_multi}/{n} listings have 3+ photos")
print("[validate] OK")
PY

# 4) Commit / ship only if inventory files changed
if git diff --quiet HEAD -- public/data/listings.json data/mls-ids.txt 2>/dev/null; then
  log "[git] no inventory changes — skip commit/ship"
  log "DONE: no-op"
  exit 0
fi

log "[git] staging inventory files"
git add data/mls-ids.txt public/data/listings.json

if git diff --cached --quiet; then
  log "[git] nothing staged — skip commit/ship"
  log "DONE: no-op"
  exit 0
fi

COUNT=$(python3 -c 'import json;print(len(json.load(open("public/data/listings.json")).get("listings") or []))')
MSG="chore(sync): daily Lock & Key inventory refresh (${COUNT} listings)"

git commit -m "$MSG" || die "commit failed"
if git remote get-url origin >/dev/null 2>&1; then
  git push origin HEAD || die "push failed"
  log "[git] pushed"
else
  log "[git] no origin remote — commit local only"
fi

log "[ship] deploying"
env -u CLOUDFLARE_API_TOKEN npm run ship
log "DONE: shipped ${COUNT} listings"
