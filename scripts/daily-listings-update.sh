#!/usr/bin/env bash
# Daily Lock & Key inventory bot for leeyrealty.com
# Free public GAMLS only (no RapidAPI / Apify required).
#
# Pipeline:
#   1) Refresh Active MLS ids from office LKEY01 agent pages
#   2) SYNC_MODE=brokerage → public/data/listings.json
#   3) Validate coverage (prices, brokerage, vs roster)
#   4) Commit + push + ship only when inventory content changes
#
# Hermes cron: no-agent (zero LLM tokens). Exit 0 on quiet no-op.
# Hard fail (non-zero) only when the feed is unsafe to publish.
#
# Manual:
#   npm run sync:daily
#   bash scripts/daily-listings-update.sh

set -euo pipefail

ROOT="${LEEY_ROOT:-/home/terrerov/Projects/leey}"
cd "$ROOT"

export PATH="${HOME}/.local/bin:${HOME}/.npm-global/bin:/usr/local/bin:${PATH}"
export SYNC_MODE="${SYNC_MODE:-brokerage}"
export GAMLS_ENABLED="${GAMLS_ENABLED:-1}"
export KEEP_LAST_GOOD="${KEEP_LAST_GOOD:-1}"

# Free daily path — do NOT set ZILLOW_MAX_LISTINGS=0.
# Older sync builds did Math.max(1, 0) and collapsed the feed to 1 row.
export REALTOR_ENABLED="${REALTOR_ENABLED:-0}"
export ZILLOW_ENABLED="${ZILLOW_ENABLED:-0}"
export APIFY_ENABLED="${APIFY_ENABLED:-0}"
if [[ -n "${ZILLOW_MAX_LISTINGS:-}" ]]; then
  case "${ZILLOW_MAX_LISTINGS}" in
    ''|*[!0-9]*|0) unset ZILLOW_MAX_LISTINGS ;;
  esac
fi

LOG_DIR="${LEEY_LISTINGS_LOG_DIR:-$ROOT/data/listings-bot}"
export LEEY_LISTINGS_LOG_DIR="$LOG_DIR"
mkdir -p "$LOG_DIR"
STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
RUN_LOG="$LOG_DIR/run-$STAMP.log"
LATEST_LOG="$LOG_DIR/latest.log"
exec > >(tee -a "$RUN_LOG" | tee "$LATEST_LOG") 2>&1

log() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

command -v node >/dev/null || die "node not found"
command -v npm >/dev/null || die "npm not found"
command -v git >/dev/null || die "git not found"
command -v python3 >/dev/null || die "python3 not found"

log "=== leey daily listings bot ==="
log "root: $ROOT"
log "when: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
log "mode: $SYNC_MODE"
log "paid: zillow=$ZILLOW_ENABLED realtor=$REALTOR_ENABLED apify=$APIFY_ENABLED"
log "log:  $RUN_LOG"

# Snapshot previous roster for delta reporting
if [[ -f data/mls-ids.txt ]]; then
  grep -E '^[0-9]+$' data/mls-ids.txt | sort -u >"$LOG_DIR/prev-mls-ids.txt" || true
else
  : >"$LOG_DIR/prev-mls-ids.txt"
fi

# 1) Refresh active MLS ids from public GAMLS office roster (free)
python3 - <<'PY'
from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(".").resolve()
OUT = ROOT / "data" / "mls-ids.txt"
LOG_DIR = Path(os.environ.get("LEEY_LISTINGS_LOG_DIR", ROOT / "data" / "listings-bot"))
LOG_DIR.mkdir(parents=True, exist_ok=True)

UA = "Mozilla/5.0 (compatible; LeeyRealtyDaily/1.1; +https://leeyrealty.com)"
OFFICE = "https://www.georgiamls.com/real-estate-offices/LKEY01"
SKIP_CODES = {"directory", "why-use-a-realtor", "why-use"}

STATUS_WORDS = {
    "active": "Active",
    "sold": "Sold",
    "pending": "Pending",
    "contingent": "Contingent",
    "under contract": "Pending",
}


def fetch(url: str, attempt: int = 0) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            return r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        if e.code in (429, 500, 502, 503, 504) and attempt < 2:
            wait = 1.5 * (attempt + 1)
            print(f"[roster] retry {url} after HTTP {e.code} ({wait:.1f}s)")
            time.sleep(wait)
            return fetch(url, attempt + 1)
        raise


html = fetch(OFFICE)
agents = sorted(set(re.findall(r"/real-estate-agents/([A-Z0-9]+)", html, flags=re.I)))
agents = [
    a.upper()
    for a in agents
    if a.lower() not in SKIP_CODES and not a.lower().endswith(".cfm")
]
print(f"[roster] office agents: {len(agents)}")

by_status = {
    "Active": 0,
    "Sold": 0,
    "Pending": 0,
    "Contingent": 0,
    "other": 0,
    "missing": 0,
}
active: list[str] = []
seen: set[str] = set()

for code in agents:
    try:
        page = fetch(f"https://www.georgiamls.com/real-estate-agents/{code}")
    except Exception as e:
        print(f"[roster] skip agent {code}: {e}")
        time.sleep(0.5)
        continue

    text = re.sub(r"<script[\s\S]*?</script>", " ", page, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "\n", text)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&").replace("&#160;", " ")
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

    for i, ln in enumerate(lines):
        m = re.match(r"MLS\s*#\s*:?\s*(\d+)", ln, flags=re.I)
        if not m:
            continue
        mls = m.group(1)
        status = None
        window = " ".join(lines[i + 1 : min(i + 8, len(lines))]).lower()
        for key, label in STATUS_WORDS.items():
            if re.search(rf"\b{re.escape(key)}\b", window):
                status = label
                break
        if status is None:
            by_status["missing"] += 1
            continue
        by_status[status] = by_status.get(status, 0) + 1
        if status != "Active":
            continue
        if mls in seen:
            continue
        seen.add(mls)
        active.append(mls)
    time.sleep(0.35)

print(f"[roster] status tallies: {by_status}")
print(f"[roster] active MLS ids: {len(active)}")

prev_path = LOG_DIR / "prev-mls-ids.txt"
prev = set()
if prev_path.exists():
    prev = {ln.strip() for ln in prev_path.read_text().splitlines() if ln.strip().isdigit()}
cur = set(active)
added = sorted(cur - prev)
removed = sorted(prev - cur)
print(f"[roster] delta vs previous: +{len(added)} / -{len(removed)} (prev={len(prev)})")
if added:
    print(f"[roster] added: {', '.join(added[:20])}{'…' if len(added) > 20 else ''}")
if removed:
    print(f"[roster] removed: {', '.join(removed[:20])}{'…' if len(removed) > 20 else ''}")

(LOG_DIR / "last-roster-delta.json").write_text(
    json.dumps(
        {
            "at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "activeCount": len(active),
            "prevCount": len(prev),
            "added": added,
            "removed": removed,
            "byStatus": by_status,
            "agents": len(agents),
        },
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)

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
log "[sync] running SYNC_MODE=$SYNC_MODE ZILLOW_ENABLED=$ZILLOW_ENABLED npm run sync:zillow"
SYNC_MODE="$SYNC_MODE" \
  REALTOR_ENABLED="$REALTOR_ENABLED" \
  ZILLOW_ENABLED="$ZILLOW_ENABLED" \
  APIFY_ENABLED="$APIFY_ENABLED" \
  npm run sync:zillow

FEED="public/data/listings.json"
[[ -f "$FEED" ]] || die "missing $FEED after sync"

# 3) Validate coverage (hard gates keep bad feeds off production)
python3 - <<'PY'
import json
import sys
from collections import Counter
from pathlib import Path

feed_path = Path("public/data/listings.json")
ids_path = Path("data/mls-ids.txt")
d = json.loads(feed_path.read_text())
rows = d.get("listings") or []
n = len(rows)

roster = {
    ln.strip()
    for ln in ids_path.read_text().splitlines()
    if ln.strip().isdigit()
}
roster_n = len(roster)


def ok(x):
    return x not in (None, "", [], 0)


with_agent = sum(1 for x in rows if ok(x.get("listedBy")))
with_phone = sum(1 for x in rows if ok(x.get("listedByPhone")))
with_multi = sum(1 for x in rows if len(x.get("images") or []) >= 3)
with_img = sum(1 for x in rows if ok(x.get("image")) or (x.get("images") or []))
with_desc = sum(1 for x in rows if len(str(x.get("description") or "")) >= 80)
with_price = sum(1 for x in rows if (x.get("priceUsd") or 0) > 0)
resolved_mls = {str(x.get("mlsId") or "").strip() for x in rows if x.get("mlsId")}
resolved_mls.discard("")
coverage = (len(resolved_mls & roster) / roster_n) if roster_n else 1.0
brokers = Counter((x.get("brokerage") or "?").lower() for x in rows)
non_lk = [b for b in brokers if "lock" not in b]
unknown_status = sum(1 for x in rows if (x.get("status") or "unknown") == "unknown")

print(
    f"[validate] listings={n} roster={roster_n} coverage={coverage:.0%} "
    f"agent={with_agent}/{n} phone={with_phone}/{n} "
    f"img={with_img}/{n} multiPhoto={with_multi}/{n} "
    f"desc={with_desc}/{n} priced={with_price}/{n} unknownStatus={unknown_status}"
)
print(f"[validate] agents: {dict(Counter(x.get('listedBy') or '?' for x in rows))}")
print(f"[validate] cities: {dict(Counter(x.get('city') or '?' for x in rows))}")
print(
    f"[validate] syncedAt={d.get('syncedAt')} sources={d.get('meta', {}).get('sourcesUsed')} "
    f"mode={d.get('meta', {}).get('mode')} inventoryKind={d.get('meta', {}).get('inventoryKind')}"
)

hard = []
if n == 0:
    hard.append("0 listings")
if with_price == 0:
    hard.append("all prices are 0")
if with_price < n:
    hard.append(f"{n - with_price}/{n} listings missing priceUsd")
if with_img < n:
    hard.append(f"{n - with_img}/{n} listings missing images")
if non_lk:
    hard.append(f"non Lock & Key brokerages present: {non_lk}")
# Collapse guard: a previous daily bug published 1/25 via MAX_LISTINGS=0.
if roster_n >= 4 and n < max(2, int(roster_n * 0.5)):
    hard.append(f"feed collapsed vs roster ({n}/{roster_n} < 50%) — refusing to ship")
if hard:
    print("[validate] FAIL: " + "; ".join(hard))
    sys.exit(2)

if with_phone < n:
    print(f"[validate] WARN: {n - with_phone} listings missing listedByPhone")
if with_multi < max(1, n // 2):
    print(f"[validate] WARN: only {with_multi}/{n} listings have 3+ photos")
if unknown_status:
    print(f"[validate] WARN: {unknown_status} listings with status=unknown")
if coverage < 0.85 and roster_n:
    missing = sorted(roster - resolved_mls)
    print(
        f"[validate] WARN: roster coverage {coverage:.0%}; "
        f"unresolved sample: {', '.join(missing[:12])}"
    )

print("[validate] OK")
PY

# 4) Content-hash compare (ignore syncedAt noise)
python3 - <<'PY' >"$LOG_DIR/content-changed.flag"
import hashlib
import json
import sys
from pathlib import Path


def canon_listings(path: Path):
    if not path.exists():
        return None
    d = json.loads(path.read_text())
    rows = d.get("listings") or []
    cleaned = []
    for r in rows:
        c = {k: v for k, v in r.items() if k not in {"syncedAt", "_enriched"}}
        cleaned.append(c)
    cleaned.sort(key=lambda x: str(x.get("id") or x.get("mlsId") or ""))
    payload = {
        "listings": cleaned,
        "mlsIds": sorted(
            {
                ln.strip()
                for ln in Path("data/mls-ids.txt").read_text().splitlines()
                if ln.strip().isdigit()
            }
        ),
        "source": d.get("source"),
        "inventoryKind": (d.get("meta") or {}).get("inventoryKind"),
        "mode": (d.get("meta") or {}).get("mode"),
    }
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(blob).hexdigest()


cur = canon_listings(Path("public/data/listings.json"))
prev_hash_path = Path("data/listings-bot/content.sha256")
prev = prev_hash_path.read_text().strip() if prev_hash_path.exists() else ""
changed = "1" if cur != prev else "0"
print(changed)
print(
    f"[hash] prev={prev[:12] or '—'} cur={(cur or '')[:12]} changed={changed}",
    file=sys.stderr,
)
prev_hash_path.parent.mkdir(parents=True, exist_ok=True)
Path("data/listings-bot/content.sha256.next").write_text((cur or "") + "\n")
PY

CHANGED="$(tr -d '[:space:]' <"$LOG_DIR/content-changed.flag" || echo 1)"

advance_state() {
  if [[ -f data/listings-bot/content.sha256.next ]]; then
    mv -f data/listings-bot/content.sha256.next data/listings-bot/content.sha256
  fi
  grep -E '^[0-9]+$' data/mls-ids.txt | sort -u >"$LOG_DIR/prev-mls-ids.txt" || true
}

# Quiet no-op when content hash and git both say unchanged
if git diff --quiet HEAD -- public/data/listings.json data/mls-ids.txt 2>/dev/null \
  && [[ "$CHANGED" == "0" ]]; then
  log "[git] no inventory content changes — skip commit/ship"
  advance_state
  log "DONE: no-op"
  exit 0
fi

log "[git] staging inventory files"
git add data/mls-ids.txt public/data/listings.json

if git diff --cached --quiet; then
  log "[git] nothing staged — skip commit/ship"
  advance_state
  log "DONE: no-op"
  exit 0
fi

COUNT=$(python3 -c 'import json;print(len(json.load(open("public/data/listings.json")).get("listings") or []))')
DELTA_NOTE=""
if [[ -f data/listings-bot/last-roster-delta.json ]]; then
  DELTA_NOTE=$(python3 - <<'PY'
import json
d = json.load(open("data/listings-bot/last-roster-delta.json"))
a = len(d.get("added") or [])
r = len(d.get("removed") or [])
print(f" roster +{a}/-{r}")
PY
)
fi
MSG="chore(sync): daily Lock & Key inventory refresh (${COUNT} listings)${DELTA_NOTE}"

git commit -m "$MSG" || die "commit failed"
if git remote get-url origin >/dev/null 2>&1; then
  git push origin HEAD || die "push failed"
  log "[git] pushed"
else
  log "[git] no origin remote — commit local only"
fi

log "[ship] deploying"
env -u CLOUDFLARE_API_TOKEN npm run ship
advance_state

# 5) Live apex verify (best-effort)
python3 - <<'PY' || true
import json
import urllib.request

url = "https://leeyrealty.com/data/listings.json"
req = urllib.request.Request(
    url,
    headers={"User-Agent": "LeeyDailyBot/1.1", "Cache-Control": "no-cache"},
)
try:
    with urllib.request.urlopen(req, timeout=25) as r:
        d = json.loads(r.read().decode())
    print(
        f"[live] apex listings={len(d.get('listings') or [])} "
        f"syncedAt={d.get('syncedAt')} source={d.get('source')}"
    )
except Exception as e:
    print(f"[live] WARN apex check failed: {e}")
PY

log "DONE: shipped ${COUNT} listings"
