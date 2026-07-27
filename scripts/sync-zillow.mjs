#!/usr/bin/env node
/**
 * sync-zillow.mjs — pull agent listings into public/data/listings.json
 *
 * Providers (first with credentials wins):
 *   1. MANUAL_LISTINGS_PATH
 *   2. RAPIDAPI_KEY + RAPIDAPI_HOST  (default: zillow-com-live-data-scraper-api)
 *   3. APIFY_TOKEN
 *   4. demo seed
 *
 * Env — see .env.example
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

const OUT = process.env.OUT_PATH || resolve(ROOT, "public/data/listings.json");
const AGENT_NAME = process.env.ZILLOW_AGENT_NAME || "Leyanis Hernandez";
const AGENT_LOCATION = process.env.ZILLOW_AGENT_LOCATION || "Valdosta, GA";
const PROFILE_URL = process.env.ZILLOW_PROFILE_URL || null;
const MLS_IDS = (process.env.ZILLOW_MLS_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

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

function collectImages(raw) {
  const images = [];
  const push = (u) => {
    if (u && typeof u === "string" && !images.includes(u)) images.push(u);
  };
  if (Array.isArray(raw.photos)) {
    for (const ph of raw.photos) {
      if (typeof ph === "string") push(ph);
      else {
        push(ph?.url);
        push(ph?.mixedSources?.jpeg?.[0]?.url);
        push(ph?.href);
      }
    }
  }
  if (Array.isArray(raw.images)) raw.images.forEach(push);
  if (Array.isArray(raw.imgSrcs)) raw.imgSrcs.forEach(push);
  push(raw.imgSrc);
  push(raw.image);
  push(raw.hiResImageLink);
  push(raw.primary_photo);
  push(raw.photo);
  return images;
}

function normalizeListing(raw, i = 0) {
  const zpid = raw.zpid || raw.zpId || raw.zillowId || raw.id;
  const address =
    raw.address ||
    raw.streetAddress ||
    raw.unparsedAddress ||
    [raw.streetAddress, raw.city, raw.state].filter(Boolean).join(", ");
  const city =
    raw.city || raw.addressCity || AGENT_LOCATION.split(",")[0].trim();
  const state = raw.state || raw.addressState || "GA";
  const zip = String(raw.zipcode || raw.zip || raw.addressZipcode || "");
  const price = num(
    raw.price ?? raw.unformattedPrice ?? raw.listPrice ?? raw.priceValue,
    0
  );
  const beds = num(raw.bedrooms ?? raw.beds ?? raw.bed, 0);
  const baths = num(raw.bathrooms ?? raw.baths ?? raw.bath, 0);
  const sqft = num(
    raw.livingArea ?? raw.sqft ?? raw.area ?? raw.finishedSqFt,
    0
  );
  const yearBuilt = num(raw.yearBuilt ?? raw.year_built, 0);
  const uniqImages = collectImages(raw);
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
    (address ? String(address).split(",")[0] : null) ||
    `${city} home`;
  const description =
    raw.description ||
    raw.listingDescription ||
    raw.remarks ||
    `${beds || "—"} bed · ${baths || "—"} bath · ${
      sqft ? sqft.toLocaleString() + " sqft" : "—"
    } in ${city}, ${state}.`;
  const tagline =
    raw.tagline ||
    [beds && `${beds} bd`, baths && `${baths} ba`, sqft && `${sqft.toLocaleString()} sqft`]
      .filter(Boolean)
      .join(" · ") ||
    city;
  const daysOnMarket = num(
    raw.daysOnZillow ?? raw.daysOnMarket ?? raw.dom,
    NaN
  );
  const p = {
    id: zpid ? `zpid-${zpid}` : `lst-${slug(city)}-${i + 1}`,
    zpid: zpid ? String(zpid) : undefined,
    mlsId: raw.mlsid || raw.mlsId || raw.mlsNumber || raw.mls || undefined,
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
    updatedAt:
      raw.datePriceChanged || raw.lastUpdated || new Date().toISOString(),
  };
  const badge = badgeFrom({
    status: p.status,
    daysOnMarket: p.daysOnMarket,
    priceReduced: Boolean(raw.priceChange || raw.priceReduction),
  });
  if (badge) p.badge = badge;
  for (const k of Object.keys(p)) {
    if (p[k] === undefined) delete p[k];
  }
  return p;
}

function demoFeed() {
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

function extractArray(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  for (const k of [
    "props",
    "results",
    "listings",
    "searchResults",
    "properties",
    "homes",
    "data",
    "items",
    "records",
  ]) {
    const v = data[k];
    if (Array.isArray(v)) return v;
    if (v && Array.isArray(v.results)) return v.results;
    if (v && Array.isArray(v.listings)) return v.listings;
    if (v && Array.isArray(v.props)) return v.props;
  }
  // single property object
  if (data.zpid || data.address || data.price || data.mlsid || data.mlsId) {
    return [data];
  }
  return [];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── providers ────────────────────────────────────────────────────────────

async function fromApify() {
  const token = process.env.APIFY_TOKEN;
  if (!token) return null;
  const actor = process.env.APIFY_ACTOR_ID || "maxcopell/zillow-agent-scraper";
  console.log(`[apify] running actor ${actor}…`);

  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/runs?token=${token}&waitForFinish=120`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startUrls: PROFILE_URL ? [{ url: PROFILE_URL }] : undefined,
        agentName: AGENT_NAME,
        location: AGENT_LOCATION,
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

/**
 * RapidAPI — zillow-com-live-data-scraper-api (and compatible hosts)
 *
 * Documented/user endpoint:
 *   GET /bymlsid?mlsid=…&page=1
 *
 * Also tries location/search/byurl paths used by similar Zillow scrapers.
 */
async function fromRapidApi() {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return null;
  const host =
    process.env.RAPIDAPI_HOST ||
    "zillow-com-live-data-scraper-api.p.rapidapi.com";
  console.log(`[rapidapi] host=${host}`);

  const headers = {
    "Content-Type": "application/json",
    "x-rapidapi-host": host,
    "x-rapidapi-key": key,
    "X-RapidAPI-Host": host,
    "X-RapidAPI-Key": key,
  };

  async function get(pathAndQuery) {
    const url = pathAndQuery.startsWith("http")
      ? pathAndQuery
      : `https://${host}${pathAndQuery.startsWith("/") ? "" : "/"}${pathAndQuery}`;
    const res = await fetch(url, { headers });
    const text = await res.text();
    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text };
    }
    return { ok: res.ok, status: res.status, body, url };
  }

  // 1) Explicit MLS IDs (best for known inventory)
  const collected = [];
  if (MLS_IDS.length) {
    console.log(`[rapidapi] fetching ${MLS_IDS.length} MLS id(s) via /bymlsid`);
    for (const mlsid of MLS_IDS) {
      let page = 1;
      for (;;) {
        const { ok, status, body, url } = await get(
          `/bymlsid?mlsid=${encodeURIComponent(mlsid)}&page=${page}`
        );
        if (!ok) {
          console.warn(`[rapidapi] ${status} ${url} →`, JSON.stringify(body)?.slice(0, 200));
          break;
        }
        const arr = extractArray(body);
        console.log(`[rapidapi] mlsid=${mlsid} page=${page} → ${arr.length}`);
        if (!arr.length) break;
        collected.push(...arr);
        // stop if single object or short page
        if (arr.length < 5 || page >= 10) break;
        page += 1;
        await sleep(400);
      }
      await sleep(350);
    }
    if (collected.length) return collected;
  }

  // 2) Probe search-style endpoints for agent market (Valdosta area)
  const locationQ = encodeURIComponent(AGENT_LOCATION);
  const agentQ = encodeURIComponent(AGENT_NAME);
  const profileQ = PROFILE_URL ? encodeURIComponent(PROFILE_URL) : null;

  const tries = [
    // live-data-scraper style
    `/search?location=${locationQ}&status=forSale&page=1`,
    `/search?location=${locationQ}&page=1`,
    `/property/search?location=${locationQ}&page=1`,
    `/properties?location=${locationQ}&page=1`,
    `/bylocation?location=${locationQ}&page=1`,
    `/bycity?city=${locationQ}&page=1`,
    // agent oriented
    `/agent?name=${agentQ}`,
    `/agent/search?name=${agentQ}&location=${locationQ}`,
    `/agents?name=${agentQ}`,
    `/byagent?name=${agentQ}`,
    `/agentListings?name=${agentQ}`,
    // byurl profile
    profileQ ? `/byurl?url=${profileQ}` : null,
    profileQ ? `/searchByUrl?url=${profileQ}` : null,
    profileQ ? `/property/byurl?url=${profileQ}` : null,
    // zillow-com1 style (if same key is multi-sub — usually not)
    `/propertyExtendedSearch?location=${locationQ}&status_type=ForSale&home_type=Houses`,
  ].filter(Boolean);

  let lastErr = null;
  for (const path of tries) {
    await sleep(450);
    const { ok, status, body, url } = await get(path);
    if (status === 429) {
      console.warn("[rapidapi] rate limited — waiting 3s");
      await sleep(3000);
      continue;
    }
    if (status === 403) {
      lastErr = body?.message || "not subscribed";
      console.warn(`[rapidapi] 403 ${path} → ${lastErr}`);
      // if not subscribed, no point hammering
      if (String(lastErr).toLowerCase().includes("not subscribed")) {
        throw new Error(
          `RapidAPI 403: not subscribed to ${host}. Open RapidAPI → subscribe to “Zillow Com Live Data Scraper API”, then re-run.`
        );
      }
      continue;
    }
    if (!ok) {
      console.warn(`[rapidapi] ${status} ${path}`);
      continue;
    }
    const arr = extractArray(body);
    if (arr.length) {
      console.log(`[rapidapi] got ${arr.length} from ${url.split("?")[0]}`);
      // Prefer listings that mention the agent when the field exists
      const nameLc = AGENT_NAME.toLowerCase();
      const first = nameLc.split(/\s+/)[0];
      const filtered = arr.filter((it) => {
        const blob = JSON.stringify(it).toLowerCase();
        if (
          blob.includes("agent") ||
          blob.includes("broker") ||
          blob.includes("listing_provided")
        ) {
          return (
            blob.includes(first) ||
            blob.includes("hernandez") ||
            blob.includes("leyanis")
          );
        }
        return true;
      });
      return filtered.length ? filtered : arr;
    }
    console.log(`[rapidapi] empty ${path}`);
  }

  if (lastErr) throw new Error(`RapidAPI failed: ${lastErr}`);
  return [];
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
  console.log(` profile: ${PROFILE_URL || "(not set)"}`);
  console.log(
    ` rapid:   ${process.env.RAPIDAPI_HOST || "zillow-com-live-data-scraper-api.p.rapidapi.com"} · key=${process.env.RAPIDAPI_KEY ? "yes" : "no"}`
  );
  console.log(` mls ids: ${MLS_IDS.length ? MLS_IDS.join(", ") : "(none)"}`);
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
        raw = await fromRapidApi();
        if (raw && raw.length) source = "zillow";
        else if (raw && !raw.length) {
          console.warn("[rapidapi] 0 listings returned");
          raw = null;
        }
      } catch (e) {
        console.error("[rapidapi]", e.message);
      }
    }
    if (!raw) {
      try {
        raw = await fromApify();
        if (raw) source = "zillow";
      } catch (e) {
        console.error("[apify]", e.message);
      }
    }
  }

  let listings = [];
  if (raw?.length) {
    listings = raw
      .map((r, i) => normalizeListing(r, i))
      .filter((p) => p.priceUsd > 0 || p.image || p.zpid);
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
        "   Checklist:\n" +
        "   1) Subscribe to the RapidAPI product for host\n" +
        "      zillow-com-live-data-scraper-api.p.rapidapi.com\n" +
        "   2) RAPIDAPI_KEY + RAPIDAPI_HOST in .env\n" +
        "   3) Optional: ZILLOW_MLS_IDS=111,222 for /bymlsid\n" +
        "   4) Optional: ZILLOW_PROFILE_URL=https://www.zillow.com/profile/…\n" +
        "   5) npm run sync:zillow\n"
    );
    const demo = demoFeed();
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
    console.log(JSON.stringify(feed, null, 2).slice(0, 2500));
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
