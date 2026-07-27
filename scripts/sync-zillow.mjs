#!/usr/bin/env node
/**
 * sync-zillow.mjs — pull agent listings into public/data/listings.json
 *
 * Zillow has no public bulk API. Supported providers (first that has credentials wins):
 *
 *   1. APIFY_TOKEN          → actor run (default: maxcopell/zillow-agent-scraper or search)
 *   2. RAPIDAPI_KEY         → RapidAPI Zillow working API (by agent name / profile)
 *   3. MANUAL_LISTINGS_PATH → path to a hand-exported JSON array of properties
 *   4. none                 → keep/write demo seed and exit 0 with warning
 *
 * Env (see .env.example):
 *   ZILLOW_PROFILE_URL   e.g. https://www.zillow.com/profile/Leyanis-Hernandez/
 *   ZILLOW_AGENT_NAME    default: Leyanis Hernandez
 *   ZILLOW_AGENT_LOCATION default: Valdosta GA
 *   APIFY_TOKEN
 *   APIFY_ACTOR_ID       default: maxcopell/zillow-agent-scraper
 *   RAPIDAPI_KEY
 *   RAPIDAPI_HOST        default: zillow-com1.p.rapidapi.com
 *   OUT_PATH             default: public/data/listings.json
 *
 * Usage:
 *   node scripts/sync-zillow.mjs
 *   node scripts/sync-zillow.mjs --dry-run
 *   node scripts/sync-zillow.mjs --force-demo
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// load .env if present (simple, no dotenv dep)
function loadEnv() {
  for (const p of [resolve(ROOT, ".env"), resolve(ROOT, ".env.local")]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const k = m[1];
      let v = m[2].replace(/^["']|["']$/g, "");
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
}
loadEnv();

const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry-run");
const FORCE_DEMO = args.has("--force-demo");

const OUT =
  process.env.OUT_PATH ||
  resolve(ROOT, "public/data/listings.json");

const AGENT_NAME = process.env.ZILLOW_AGENT_NAME || "Leyanis Hernandez";
const AGENT_LOCATION = process.env.ZILLOW_AGENT_LOCATION || "Valdosta, GA";
const PROFILE_URL = process.env.ZILLOW_PROFILE_URL || null;

// ── helpers ──────────────────────────────────────────────────────────────

function slug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function mapHomeType(t) {
  const s = String(t || "").toLowerCase();
  if (s.includes("condo") || s.includes("apartment")) return "condo";
  if (s.includes("town")) return "townhouse";
  if (s.includes("multi") || s.includes("duplex") || s.includes("triplex"))
    return "multifamily";
  if (s.includes("land") || s.includes("lot")) return "land";
  if (s.includes("commercial")) return "commercial";
  return "house";
}

function mapStatus(s) {
  const x = String(s || "").toLowerCase().replace(/\s+/g, "_");
  if (x.includes("pending") || x.includes("contingent")) return "pending";
  if (x.includes("sold")) return "sold";
  if (x.includes("coming")) return "coming_soon";
  if (x.includes("off") || x.includes("withdrawn") || x.includes("expired"))
    return "off_market";
  if (x.includes("sale") || x.includes("active") || x.includes("for_sale"))
    return "for_sale";
  return "unknown";
}

function badgeFrom(p) {
  if (p.status === "pending") return undefined;
  if (p.daysOnMarket != null && p.daysOnMarket <= 7) return "new";
  if (p.priceReduced) return "reduced";
  if (p.daysOnMarket != null && p.daysOnMarket <= 21) return "hot";
  return undefined;
}

function normalizeListing(raw, i = 0) {
  const zpid = raw.zpid || raw.zpId || raw.zillowId || raw.id;
  const address =
    raw.address ||
    raw.streetAddress ||
    raw.unparsedAddress ||
    [raw.streetAddress, raw.city, raw.state].filter(Boolean).join(", ");
  const city = raw.city || raw.addressCity || AGENT_LOCATION.split(",")[0].trim();
  const state = raw.state || raw.addressState || "GA";
  const zip = String(raw.zipcode || raw.zip || raw.addressZipcode || "");
  const price = num(
    raw.price ?? raw.unformattedPrice ?? raw.listPrice ?? raw.priceValue,
    0
  );
  const beds = num(raw.bedrooms ?? raw.beds ?? raw.bed, 0);
  const baths = num(raw.bathrooms ?? raw.baths ?? raw.bath, 0);
  const sqft = num(raw.livingArea ?? raw.sqft ?? raw.area ?? raw.finishedSqFt, 0);
  const yearBuilt = num(raw.yearBuilt ?? raw.year_built, 0);
  const images = [];
  if (Array.isArray(raw.photos)) {
    for (const ph of raw.photos) {
      const u = typeof ph === "string" ? ph : ph?.url || ph?.mixedSources?.jpeg?.[0]?.url;
      if (u) images.push(u);
    }
  }
  if (Array.isArray(raw.imgSrcs)) images.push(...raw.imgSrcs.filter(Boolean));
  if (raw.imgSrc) images.unshift(raw.imgSrc);
  if (raw.image) images.unshift(raw.image);
  if (raw.hiResImageLink) images.unshift(raw.hiResImageLink);
  const uniqImages = [...new Set(images.filter(Boolean))];
  const image = uniqImages[0] || "";
  const status = mapStatus(
    raw.homeStatus || raw.status || raw.listingStatus || raw.homeStatusForHDP
  );
  const zillowUrl =
    raw.detailUrl ||
    raw.url ||
    raw.hdpUrl ||
    (zpid ? `https://www.zillow.com/homedetails/${zpid}_zpid/` : undefined);
  const title =
    raw.title ||
    (address ? address.split(",")[0] : null) ||
    `${city} home`;
  const description =
    raw.description ||
    raw.listingDescription ||
    raw.remarks ||
    `${beds || "—"} bed · ${baths || "—"} bath · ${sqft ? sqft.toLocaleString() + " sqft" : "—"} in ${city}, ${state}.`;
  const tagline =
    raw.tagline ||
    [beds && `${beds} bd`, baths && `${baths} ba`, sqft && `${sqft.toLocaleString()} sqft`]
      .filter(Boolean)
      .join(" · ") ||
    city;
  const daysOnMarket = num(raw.daysOnZillow ?? raw.daysOnMarket ?? raw.dom, NaN);
  const p = {
    id: zpid ? `zpid-${zpid}` : `lst-${slug(city)}-${i + 1}`,
    zpid: zpid ? String(zpid) : undefined,
    mlsId: raw.mlsid || raw.mlsId || raw.mlsNumber || undefined,
    status,
    title: String(title).slice(0, 120),
    address: address || undefined,
    city,
    neighborhood: raw.neighborhood || raw.subdivision || city,
    state,
    zip,
    type: mapHomeType(raw.homeType || raw.propertyType || raw.home_type),
    beds,
    baths,
    sqft,
    lotSizeSqft: num(raw.lotSize || raw.lotAreaValue, NaN) || undefined,
    yearBuilt: yearBuilt || 0,
    hoaMonthly: num(raw.monthlyHoaFee ?? raw.hoaFee, NaN) || undefined,
    priceUsd: price,
    image,
    images: uniqImages.length ? uniqImages : image ? [image] : [],
    tagline: String(tagline).slice(0, 160),
    description: String(description).slice(0, 4000),
    zillowUrl,
    daysOnMarket: Number.isFinite(daysOnMarket) ? daysOnMarket : undefined,
    lat: num(raw.latitude ?? raw.lat, NaN) || undefined,
    lng: num(raw.longitude ?? raw.lng ?? raw.lon, NaN) || undefined,
    listedAt: raw.datePosted || raw.listDate || undefined,
    updatedAt: raw.datePriceChanged || raw.lastUpdated || new Date().toISOString(),
  };
  const badge = badgeFrom({
    status: p.status,
    daysOnMarket: p.daysOnMarket,
    priceReduced: Boolean(raw.priceChange || raw.priceReduction),
  });
  if (badge) p.badge = badge;
  // drop empties
  for (const k of Object.keys(p)) {
    if (p[k] === undefined) delete p[k];
  }
  return p;
}

function demoFeed() {
  // import demo from existing JSON if any, else minimal
  const demoPath = resolve(ROOT, "public/data/listings.demo.json");
  if (existsSync(demoPath)) {
    return JSON.parse(readFileSync(demoPath, "utf8"));
  }
  return {
    version: 1,
    source: "demo",
    syncedAt: null,
    agent: {
      name: AGENT_NAME,
      zillowProfileUrl: PROFILE_URL,
      phone: "(229) 890-8062",
    },
    listings: [],
  };
}

// ── providers ────────────────────────────────────────────────────────────

async function fromApify() {
  const token = process.env.APIFY_TOKEN;
  if (!token) return null;
  const actor = process.env.APIFY_ACTOR_ID || "maxcopell/zillow-agent-scraper";
  console.log(`[apify] running actor ${actor}…`);

  // Start run
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/runs?token=${token}&waitForFinish=120`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startUrls: PROFILE_URL ? [{ url: PROFILE_URL }] : undefined,
        agentName: AGENT_NAME,
        location: AGENT_LOCATION,
        // common alternate keys used by various actors
        searchQuery: AGENT_NAME,
        profileUrls: PROFILE_URL ? [PROFILE_URL] : undefined,
        maxItems: 100,
      }),
    }
  );
  if (!startRes.ok) {
    const t = await startRes.text();
    throw new Error(`Apify start failed ${startRes.status}: ${t.slice(0, 400)}`);
  }
  const run = await startRes.json();
  const datasetId = run?.data?.defaultDatasetId;
  if (!datasetId) throw new Error("Apify run missing dataset id");

  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true&format=json`
  );
  if (!itemsRes.ok) throw new Error(`Apify dataset ${itemsRes.status}`);
  const items = await itemsRes.json();
  console.log(`[apify] ${items.length} raw items`);
  return items;
}

async function fromRapidApi() {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return null;
  const host = process.env.RAPIDAPI_HOST || "zillow-com1.p.rapidapi.com";
  console.log(`[rapidapi] host=${host} agent=${AGENT_NAME}`);

  // Try agent/search then property extended search by location + agent filter
  const headers = {
    "X-RapidAPI-Key": key,
    "X-RapidAPI-Host": host,
  };

  // Endpoint shapes vary by product — try a few common ones.
  const tries = [
    `https://${host}/propertyExtendedSearch?location=${encodeURIComponent(AGENT_LOCATION)}&status_type=ForSale&home_type=Houses`,
    `https://${host}/searchByUrl?url=${encodeURIComponent(PROFILE_URL || `https://www.zillow.com/homes/for_sale/${encodeURIComponent(AGENT_LOCATION)}_rb/`)}`,
  ];

  let items = [];
  for (const url of tries) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        console.warn(`[rapidapi] ${res.status} ${url}`);
        continue;
      }
      const data = await res.json();
      const arr =
        data?.props ||
        data?.results ||
        data?.listings ||
        data?.searchResults ||
        (Array.isArray(data) ? data : null);
      if (arr?.length) {
        items = arr;
        console.log(`[rapidapi] got ${items.length} from ${url.split("?")[0]}`);
        break;
      }
    } catch (e) {
      console.warn(`[rapidapi] error`, e.message);
    }
  }

  // Optional: filter by agent name if field present
  const nameLc = AGENT_NAME.toLowerCase();
  const filtered = items.filter((it) => {
    const blob = JSON.stringify(it).toLowerCase();
    // keep all if we can't detect agent; prefer matches when field exists
    if (blob.includes("agent") || blob.includes("broker")) {
      return blob.includes(nameLc.split(" ")[0]) || blob.includes("hernandez");
    }
    return true;
  });
  return filtered.length ? filtered : items;
}

async function fromManual() {
  const p = process.env.MANUAL_LISTINGS_PATH;
  if (!p) return null;
  const abs = resolve(ROOT, p);
  if (!existsSync(abs)) throw new Error(`MANUAL_LISTINGS_PATH not found: ${abs}`);
  const data = JSON.parse(readFileSync(abs, "utf8"));
  return Array.isArray(data) ? data : data.listings || [];
}

// ── main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("═".repeat(56));
  console.log(" Leey · Zillow listings sync");
  console.log("═".repeat(56));
  console.log(` agent:   ${AGENT_NAME}`);
  console.log(` area:    ${AGENT_LOCATION}`);
  console.log(` profile: ${PROFILE_URL || "(not set — set ZILLOW_PROFILE_URL)"}`);
  console.log(` out:     ${OUT}`);

  let raw = null;
  let source = "demo";

  if (!FORCE_DEMO) {
    try {
      raw = await fromManual();
      if (raw) source = "manual";
    } catch (e) {
      console.error("[manual]", e.message);
    }
    if (!raw) {
      try {
        raw = await fromApify();
        if (raw) source = "zillow";
      } catch (e) {
        console.error("[apify]", e.message);
      }
    }
    if (!raw) {
      try {
        raw = await fromRapidApi();
        if (raw) source = "zillow";
      } catch (e) {
        console.error("[rapidapi]", e.message);
      }
    }
  }

  let listings = [];
  if (raw?.length) {
    listings = raw
      .map((r, i) => normalizeListing(r, i))
      .filter((p) => p.priceUsd > 0 || p.image || p.zpid);
    // de-dupe by zpid/id
    const seen = new Set();
    listings = listings.filter((p) => {
      const k = p.zpid || p.id;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  if (!listings.length) {
    console.warn(
      "\n⚠  No live listings pulled. Writing demo feed.\n" +
        "   To connect Zillow for real:\n" +
        "   1) Set ZILLOW_PROFILE_URL to Leey’s public Zillow agent profile\n" +
        "   2) Add APIFY_TOKEN  (recommended)  OR  RAPIDAPI_KEY\n" +
        "   3) Re-run: npm run sync:zillow\n"
    );
    const demo = demoFeed();
    // If demo listings empty, leave as-is — frontend has TS fallback
    listings = demo.listings || [];
    source = "demo";
  }

  const feed = {
    version: 1,
    source,
    syncedAt: new Date().toISOString(),
    agent: {
      name: AGENT_NAME,
      zillowProfileUrl: PROFILE_URL,
      phone: "(229) 890-8062",
    },
    listings,
  };

  console.log(`\n→ ${listings.length} listings · source=${source}`);
  if (DRY) {
    console.log(JSON.stringify(feed, null, 2).slice(0, 2000));
    console.log("\n(dry-run — not written)");
    return;
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(feed, null, 2) + "\n");
  console.log(`✓ wrote ${OUT}`);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
