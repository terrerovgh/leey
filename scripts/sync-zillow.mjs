#!/usr/bin/env node
/**
 * sync-zillow.mjs — pull listings → public/data/listings.json
 *
 * RapidAPI product (wired):
 *   host: zillow-com-live-data-scraper-api.p.rapidapi.com
 *   endpoints:
 *     GET /bylocation?location=&page=
 *     GET /byurl?url=
 *     GET /bymlsid?mlsid=&page=
 *     GET /autocomplete?q=
 *
 * This API has NO agent-profile endpoint. Modes:
 *   market     — all for-sale homes in ZILLOW_LOCATIONS (default)
 *   brokerage  — same, keep only listings whose brokerage matches filter
 *   mls        — only ZILLOW_MLS_IDS via /bymlsid
 *
 * Env: see .env.example
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
const MODE = (process.env.ZILLOW_SYNC_MODE || "market").toLowerCase();
const BROKERAGE_FILTER = (
  process.env.ZILLOW_BROKERAGE_FILTER || "lock & key,lock and key"
)
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const LOCATIONS = (
  process.env.ZILLOW_LOCATIONS ||
  "Valdosta, GA;Hahira, GA;Adel, GA;Moultrie, GA;Thomasville, GA;Tifton, GA;Nashville, GA;Ray City, GA"
)
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);
const MLS_IDS = loadMlsIds();

function loadMlsIds() {
  const fromEnv = (process.env.ZILLOW_MLS_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const file = process.env.ZILLOW_MLS_FILE || "data/mls-ids.txt";
  const abs = resolve(ROOT, file);
  let fromFile = [];
  if (existsSync(abs)) {
    fromFile = readFileSync(abs, "utf8")
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("#"));
  }
  return [...new Set([...fromEnv, ...fromFile])];
}
const MAX_PAGES = Math.max(1, num(process.env.ZILLOW_MAX_PAGES, 3));
const MAX_LISTINGS = Math.max(1, num(process.env.ZILLOW_MAX_LISTINGS, 60));
const ENRICH_LIMIT = Math.max(0, num(process.env.ZILLOW_ENRICH_LIMIT, 0));
const REQUEST_GAP_MS = Math.max(800, num(process.env.RAPIDAPI_GAP_MS, 1200));

const HOST =
  process.env.RAPIDAPI_HOST ||
  "zillow-com-live-data-scraper-api.p.rapidapi.com";
const KEY = process.env.RAPIDAPI_KEY || "";

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function slug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function mapHomeType(t) {
  const s = String(t || "").toLowerCase();
  if (s.includes("condo") || s.includes("apartment")) return "condo";
  if (s.includes("town")) return "townhouse";
  if (s.includes("multi") || s.includes("duplex")) return "multifamily";
  if (s.includes("land") || s.includes("lot")) return "land";
  if (s.includes("commercial")) return "commercial";
  return "house";
}
function mapStatus(s) {
  const x = String(s || "").toLowerCase().replace(/\s+/g, "_");
  if (x.includes("pending") || x.includes("contingent")) return "pending";
  if (x.includes("sold")) return "sold";
  if (x.includes("coming")) return "coming_soon";
  if (x.includes("off") || x.includes("withdrawn")) return "off_market";
  if (x.includes("sale") || x.includes("active") || x.includes("for_sale"))
    return "for_sale";
  return "unknown";
}
function badgeFrom(p) {
  if (p.status === "pending") return undefined;
  if (p.daysOnMarket != null && p.daysOnMarket <= 7) return "new";
  if (p.daysOnMarket != null && p.daysOnMarket <= 21) return "hot";
  return undefined;
}

function parseAddress(address) {
  // "4067 Gramercy Dr, Valdosta, GA 31605" or with extra comma before zip
  const parts = String(address || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  let street = parts[0] || "";
  let city = "";
  let state = "GA";
  let zip = "";
  if (parts.length >= 2) city = parts[1];
  if (parts.length >= 3) {
    const m = parts[2].match(/([A-Z]{2})\s*(\d{5})?/i);
    if (m) {
      state = m[1].toUpperCase();
      zip = m[2] || "";
    } else {
      state = parts[2];
    }
  }
  // "GA 31605" sometimes split as last part only
  if (!zip && parts.length >= 3) {
    const m = String(parts[parts.length - 1]).match(/(\d{5})(?:-\d{4})?/);
    if (m) zip = m[1];
  }
  if (!city && AGENT_LOCATION) city = AGENT_LOCATION.split(",")[0].trim();
  return { street, city, state, zip };
}

function normalizeListing(raw, i = 0) {
  const zpid = raw.zpid || raw.zpId || raw.id;
  const address = raw.address || raw.streetAddress || "";
  const parsed = parseAddress(address);
  const city = raw.city || parsed.city;
  const state = raw.state || parsed.state || "GA";
  const zip = String(raw.zipcode || raw.zip || parsed.zip || "");
  const price = num(raw.price ?? raw.unformattedPrice ?? raw.listPrice, 0);
  const beds = num(raw.beds ?? raw.bedrooms, 0);
  const baths = num(raw.baths ?? raw.bathrooms, 0);
  const sqft = num(raw.sqft ?? raw.livingArea, 0);
  const image =
    raw.photo_url || raw.imgSrc || raw.image || raw.hiResImageLink || "";
  const images = [];
  if (image) images.push(image);
  if (Array.isArray(raw.photos)) {
    for (const ph of raw.photos) {
      const u = typeof ph === "string" ? ph : ph?.url;
      if (u && !images.includes(u)) images.push(u);
    }
  }
  const status = mapStatus(raw.status || raw.homeStatus || raw.listingStatus);
  const zillowUrl =
    raw.url ||
    raw.detailUrl ||
    (zpid ? `https://www.zillow.com/homedetails/${zpid}_zpid/` : undefined);
  const title = parsed.street || address || `${city} home`;
  const brokerage = raw.brokerage || raw.brokerName || "";
  const description =
    raw.description ||
    raw.listingDescription ||
    [
      beds && `${beds} bed`,
      baths && `${baths} bath`,
      sqft && `${sqft.toLocaleString()} sqft`,
      city && `${city}, ${state}`,
      brokerage && `Listed with ${brokerage}`,
    ]
      .filter(Boolean)
      .join(" · ") + ".";
  const tagline = [
    beds && `${beds} bd`,
    baths && `${baths} ba`,
    sqft && `${sqft.toLocaleString()} sqft`,
  ]
    .filter(Boolean)
    .join(" · ");

  const p = {
    id: zpid ? `zpid-${zpid}` : `lst-${slug(city)}-${i + 1}`,
    zpid: zpid ? String(zpid) : undefined,
    mlsId: raw.mlsid || raw.mlsId || raw.mlsNumber || undefined,
    status,
    title: String(title).slice(0, 120),
    address: address || undefined,
    city,
    neighborhood: raw.neighborhood || city,
    state,
    zip,
    type: mapHomeType(raw.property_type || raw.homeType || raw.propertyType),
    beds,
    baths,
    sqft,
    yearBuilt: num(raw.yearBuilt, 0) || 0,
    priceUsd: price,
    image: images[0] || "",
    images: images.length ? images : images[0] ? [images[0]] : [],
    tagline: tagline || city,
    description: String(description).slice(0, 4000),
    zillowUrl,
    lat: num(raw.latitude ?? raw.lat, NaN) || undefined,
    lng: num(raw.longitude ?? raw.lng, NaN) || undefined,
    updatedAt: new Date().toISOString(),
    brokerage: brokerage || undefined,
  };
  const badge = badgeFrom({ status: p.status, daysOnMarket: raw.daysOnZillow });
  if (badge) p.badge = badge;
  for (const k of Object.keys(p)) if (p[k] === undefined) delete p[k];
  return p;
}

function matchesBrokerage(rawOrListing) {
  if (!BROKERAGE_FILTER.length) return true;
  const bro = String(
    rawOrListing.brokerage || rawOrListing.brokerName || ""
  ).toLowerCase();
  if (!bro) return false;
  return BROKERAGE_FILTER.some((f) => bro.includes(f.replace(/\s+/g, " ")));
}

function demoFeed() {
  const demoPath = resolve(ROOT, "public/data/listings.demo.json");
  if (existsSync(demoPath)) return JSON.parse(readFileSync(demoPath, "utf8"));
  return {
    version: 1,
    source: "demo",
    syncedAt: null,
    agent: { name: AGENT_NAME, zillowProfileUrl: PROFILE_URL, phone: "(229) 890-8062" },
    listings: [],
  };
}

// ── RapidAPI client ──────────────────────────────────────────────────────

async function rapidGet(pathAndQuery, attempt = 0) {
  if (!KEY) throw new Error("RAPIDAPI_KEY missing");
  const url = pathAndQuery.startsWith("http")
    ? pathAndQuery
    : `https://${HOST}${pathAndQuery.startsWith("/") ? "" : "/"}${pathAndQuery}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-host": HOST,
      "x-rapidapi-key": KEY,
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (res.status === 429 && attempt < 5) {
    const wait = 2000 * (attempt + 1);
    console.warn(`[rapidapi] 429 — wait ${wait}ms (attempt ${attempt + 1})`);
    await sleep(wait);
    return rapidGet(pathAndQuery, attempt + 1);
  }
  if (res.status === 403) {
    const msg = body?.message || "Forbidden";
    throw new Error(`RapidAPI 403: ${msg}`);
  }
  return { ok: res.ok, status: res.status, body, url };
}

async function fetchByLocation(location, maxPages = MAX_PAGES) {
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    await sleep(REQUEST_GAP_MS);
    const q = `/bylocation?location=${encodeURIComponent(location)}&page=${page}`;
    const { ok, status, body } = await rapidGet(q);
    if (!ok) {
      console.warn(`[bylocation] ${status} ${location} p${page}`, body?.message);
      break;
    }
    const results = body?.results || [];
    const pag = body?.pagination || {};
    console.log(
      `[bylocation] ${location} p${page}/${pag.total_pages || "?"} → ${results.length} (total≈${pag.total_results ?? "?"})`
    );
    all.push(...results);
    if (!pag.has_next || !results.length) break;
    if (all.length >= MAX_LISTINGS) break;
  }
  return all;
}

async function fetchByMls(mlsid) {
  const all = [];
  for (let page = 1; page <= 5; page++) {
    await sleep(REQUEST_GAP_MS);
    const { ok, status, body } = await rapidGet(
      `/bymlsid?mlsid=${encodeURIComponent(mlsid)}&page=${page}`
    );
    if (!ok) {
      console.warn(`[bymlsid] ${status} ${mlsid}`, body?.message);
      break;
    }
    const results = body?.results || (body?.zpid ? [body] : []);
    console.log(`[bymlsid] ${mlsid} p${page} → ${results.length}`);
    if (!results.length) break;
    all.push(...results);
    if (!body?.pagination?.has_next) break;
  }
  return all;
}

async function enrichByUrl(item) {
  const url = item.url || item.detailUrl || item.zillowUrl;
  if (!url) return item;
  await sleep(REQUEST_GAP_MS);
  try {
    const { ok, body } = await rapidGet(
      `/byurl?url=${encodeURIComponent(url)}`
    );
    if (!ok || !body || body.message) return item;
    // merge detail over list item
    return { ...item, ...body, url: body.url || url };
  } catch (e) {
    console.warn(`[byurl] ${e.message}`);
    return item;
  }
}

async function fromRapidApi() {
  if (!KEY) return null;
  console.log(`[rapidapi] host=${HOST} mode=${MODE}`);

  let raw = [];

  if (MODE === "mls" || MLS_IDS.length) {
    for (const id of MLS_IDS) {
      const items = await fetchByMls(id);
      raw.push(...items);
    }
  }

  if (MODE !== "mls") {
    for (const loc of LOCATIONS) {
      if (raw.length >= MAX_LISTINGS) break;
      const items = await fetchByLocation(loc, MAX_PAGES);
      raw.push(...items);
    }
  }

  // de-dupe by zpid
  const seen = new Set();
  raw = raw.filter((r) => {
    const k = String(r.zpid || r.url || JSON.stringify(r));
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // optional enrich
  if (ENRICH_LIMIT > 0 && raw.length) {
    console.log(`[enrich] byurl for up to ${ENRICH_LIMIT} listings…`);
    const head = raw.slice(0, ENRICH_LIMIT);
    const tail = raw.slice(ENRICH_LIMIT);
    const enriched = [];
    for (const item of head) enriched.push(await enrichByUrl(item));
    raw = [...enriched, ...tail];
  }

  if (MODE === "brokerage") {
    const before = raw.length;
    raw = raw.filter(matchesBrokerage);
    console.log(
      `[filter] brokerage ${BROKERAGE_FILTER.join(" | ")}: ${before} → ${raw.length}`
    );
  }

  return raw.slice(0, MAX_LISTINGS);
}

async function fromApify() {
  const token = process.env.APIFY_TOKEN;
  if (!token) return null;
  const actor = process.env.APIFY_ACTOR_ID || "maxcopell/zillow-agent-scraper";
  console.log(`[apify] ${actor}`);
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/runs?token=${token}&waitForFinish=120`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startUrls: PROFILE_URL ? [{ url: PROFILE_URL }] : undefined,
        agentName: AGENT_NAME,
        location: AGENT_LOCATION,
        maxItems: 100,
      }),
    }
  );
  if (!startRes.ok) throw new Error(`Apify ${startRes.status}`);
  const run = await startRes.json();
  const datasetId = run?.data?.defaultDatasetId;
  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true&format=json`
  );
  if (!itemsRes.ok) throw new Error(`Apify dataset ${itemsRes.status}`);
  return itemsRes.json();
}

async function fromManual() {
  const p = process.env.MANUAL_LISTINGS_PATH;
  if (!p) return null;
  const abs = resolve(ROOT, p);
  if (!existsSync(abs)) throw new Error(`missing ${abs}`);
  const data = JSON.parse(readFileSync(abs, "utf8"));
  return Array.isArray(data) ? data : data.listings || [];
}

// ── main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("═".repeat(56));
  console.log(" Leey · Zillow listings sync");
  console.log("═".repeat(56));
  console.log(` agent:   ${AGENT_NAME}`);
  console.log(` mode:    ${MODE}`);
  console.log(` mls:     ${MLS_IDS.length ? MLS_IDS.join(", ") : "(none — fill data/mls-ids.txt or ZILLOW_MLS_IDS)"}`);
  console.log(` locs:    ${LOCATIONS.join(" · ")}`);
  console.log(` rapid:   ${HOST} · key=${KEY ? "yes" : "no"}`);
  console.log(` gap:     ${REQUEST_GAP_MS}ms · maxPages=${MAX_PAGES} · max=${MAX_LISTINGS}`);
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
        if (raw?.length) source = "zillow";
        else if (raw) {
          console.warn("[rapidapi] 0 listings");
          raw = null;
        }
      } catch (e) {
        console.error("[rapidapi]", e.message);
      }
    }
    if (!raw) {
      try {
        raw = await fromApify();
        if (raw?.length) source = "zillow";
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
  }

  if (!listings.length) {
    console.warn("\n⚠  No live listings — writing demo feed.");
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
    meta: {
      mode: MODE,
      host: HOST,
      locations: LOCATIONS,
    },
    listings,
  };

  console.log(`\n→ ${listings.length} listings · source=${source}`);
  if (listings[0]) {
    console.log(
      `  e.g. ${listings[0].title} · ${listings[0].city} · $${listings[0].priceUsd}`
    );
  }

  if (DRY) {
    console.log(JSON.stringify(feed, null, 2).slice(0, 2500));
    console.log("\n(dry-run)");
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
