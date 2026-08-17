#!/usr/bin/env node
/**
 * sync-zillow.mjs — multi-source inventory → public/data/listings.json
 *
 * Sources (merged, first wins on id collision after normalize):
 *   1. Manual JSON     — data/manual-listings.json (or MANUAL_LISTINGS_PATH)
 *   2. Zillow RapidAPI — host RAPIDAPI_HOST (bylocation / bymlsid / byurl)
 *   3. Realtor RapidAPI— host REALTOR_RAPIDAPI_HOST (when subscribed)
 *   4. Apify           — optional agent scraper
 *
 * Modes (ZILLOW_SYNC_MODE / SYNC_MODE):
 *   market     — area search (Zillow locations)
 *   brokerage  — area search filtered to Lock & Key (needs brokerage field)
 *   mls        — only MLS ids (file/env), via Zillow /bymlsid when API works
 *   hybrid     — manual + mls + market/brokerage APIs (default recommended)
 *
 * Safety:
 *   - Never invent listings
 *   - KEEP_LAST_GOOD=1 (default): if all sources empty, keep previous feed
 *
 * Env: see .env.example
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
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
const MANUAL_ONLY = args.has("--manual-only");

const OUT = process.env.OUT_PATH || resolve(ROOT, "public/data/listings.json");
const AGENT_NAME = process.env.ZILLOW_AGENT_NAME || "Leyanis Hernandez";
const AGENT_LOCATION = process.env.ZILLOW_AGENT_LOCATION || "Valdosta, GA";
const PROFILE_URL =
  process.env.ZILLOW_PROFILE_URL || "https://www.zillow.com/profile/leey63/";
const MODE = (
  process.env.SYNC_MODE ||
  process.env.ZILLOW_SYNC_MODE ||
  "hybrid"
).toLowerCase();
const BROKERAGE_FILTER = (
  process.env.ZILLOW_BROKERAGE_FILTER || "lock & key,lock and key,lockandkey"
)
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const LOCATIONS = (
  process.env.ZILLOW_LOCATIONS ||
  "Valdosta, GA;Hahira, GA;Adel, GA;Moultrie, GA;Thomasville, GA;Tifton, GA;Nashville, GA;Ray City, GA;Lake Park, GA;Sparks, GA;Lenox, GA"
)
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);
const MLS_IDS = loadMlsIds();
const MANUAL_PATH =
  process.env.MANUAL_LISTINGS_PATH || "data/manual-listings.json";
const KEEP_LAST_GOOD = String(process.env.KEEP_LAST_GOOD ?? "1") !== "0";

const MAX_PAGES = Math.max(1, num(process.env.ZILLOW_MAX_PAGES, 2));
const MAX_LISTINGS = Math.max(1, num(process.env.ZILLOW_MAX_LISTINGS, 80));
const ENRICH_LIMIT = Math.max(0, num(process.env.ZILLOW_ENRICH_LIMIT, 0));
const REQUEST_GAP_MS = Math.max(800, num(process.env.RAPIDAPI_GAP_MS, 1200));

const ZILLOW_HOST =
  process.env.RAPIDAPI_HOST ||
  "zillow-com-live-data-scraper-api.p.rapidapi.com";
const REALTOR_HOST =
  process.env.REALTOR_RAPIDAPI_HOST || "realty-in-us.p.rapidapi.com";
const KEY = process.env.RAPIDAPI_KEY || "";

/** Set when a provider reports hard quota / not subscribed — skip further calls */
const providerBlock = {
  zillow: null, // string reason
  realtor: null,
};

const DEFAULT_AGENT = {
  name: AGENT_NAME,
  zillowProfileUrl: PROFILE_URL,
  phone: "(404) " + "403" + "-" + "8306",
  email: "leey@lockandkeyrealty.com",
  brokerage: "Lock & Key Realty",
};

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

function loadMlsIds() {
  const fromEnv = (process.env.ZILLOW_MLS_IDS || process.env.MLS_IDS || "")
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
  const x = String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "_");
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
  if (!zip && parts.length >= 3) {
    const m = String(parts[parts.length - 1]).match(/(\d{5})(?:-\d{4})?/);
    if (m) zip = m[1];
  }
  if (!city && AGENT_LOCATION) city = AGENT_LOCATION.split(",")[0].trim();
  return { street, city, state, zip };
}

function firstImage(raw) {
  const candidates = [
    raw.photo_url,
    raw.imgSrc,
    raw.image,
    raw.hiResImageLink,
    raw.primary_photo?.href,
    raw.primary_photo,
    raw.thumbnail,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c) return c;
    if (c?.href) return c.href;
  }
  if (Array.isArray(raw.photos) && raw.photos[0]) {
    const ph = raw.photos[0];
    if (typeof ph === "string") return ph;
    return ph?.url || ph?.href || "";
  }
  if (Array.isArray(raw.images) && raw.images[0]) {
    const im = raw.images[0];
    return typeof im === "string" ? im : im?.url || "";
  }
  return "";
}

function collectImages(raw, primary) {
  const images = [];
  if (primary) images.push(primary);
  const push = (u) => {
    if (u && !images.includes(u)) images.push(u);
  };
  if (Array.isArray(raw.photos)) {
    for (const ph of raw.photos) {
      push(typeof ph === "string" ? ph : ph?.url || ph?.href);
    }
  }
  if (Array.isArray(raw.images)) {
    for (const im of raw.images) {
      push(typeof im === "string" ? im : im?.url);
    }
  }
  return images;
}

/** Normalize any source row → Property-shaped object */
function normalizeListing(raw, i = 0, sourcePortal = "other") {
  // Already-shaped manual property (pass-through with defaults)
  if (raw && raw.id && raw.priceUsd != null && raw.city && (raw.image || raw.images)) {
    const images = Array.isArray(raw.images) && raw.images.length
      ? raw.images
      : raw.image
        ? [raw.image]
        : [];
    return {
      id: String(raw.id),
      zpid: raw.zpid ? String(raw.zpid) : undefined,
      mlsId: raw.mlsId || raw.mlsid || undefined,
      status: mapStatus(raw.status || "for_sale"),
      title: String(raw.title || raw.address || raw.city).slice(0, 120),
      address: raw.address || undefined,
      city: raw.city,
      neighborhood: raw.neighborhood || raw.city,
      state: raw.state || "GA",
      zip: String(raw.zip || ""),
      type: mapHomeType(raw.type || raw.homeType || raw.property_type),
      beds: num(raw.beds, 0),
      baths: num(raw.baths, 0),
      sqft: num(raw.sqft, 0),
      yearBuilt: num(raw.yearBuilt, 0) || 0,
      priceUsd: num(raw.priceUsd ?? raw.price, 0),
      image: images[0] || raw.image || "",
      images,
      tagline: raw.tagline || "",
      description: String(raw.description || "").slice(0, 4000),
      zillowUrl: raw.zillowUrl,
      sourceUrl: raw.sourceUrl || raw.url,
      sourcePortal: raw.sourcePortal || sourcePortal,
      lat: raw.lat,
      lng: raw.lng,
      listedAt: raw.listedAt,
      updatedAt: raw.updatedAt || new Date().toISOString(),
      brokerage: raw.brokerage || DEFAULT_AGENT.brokerage,
      listedBy: raw.listedBy || DEFAULT_AGENT.name,
      badge: raw.badge,
    };
  }

  const zpid = raw.zpid || raw.zpId || raw.id;
  const address =
    raw.address ||
    raw.streetAddress ||
    raw.location?.address?.line ||
    [
      raw.location?.address?.line,
      raw.location?.address?.city,
      raw.location?.address?.state_code,
      raw.location?.address?.postal_code,
    ]
      .filter(Boolean)
      .join(", ") ||
    "";
  const parsed = parseAddress(address);
  const city =
    raw.city ||
    raw.location?.address?.city ||
    parsed.city;
  const state =
    raw.state ||
    raw.state_code ||
    raw.location?.address?.state_code ||
    parsed.state ||
    "GA";
  const zip = String(
    raw.zipcode ||
      raw.zip ||
      raw.postal_code ||
      raw.location?.address?.postal_code ||
      parsed.zip ||
      ""
  );
  const price = num(
    raw.price ??
      raw.unformattedPrice ??
      raw.listPrice ??
      raw.list_price ??
      raw.price_raw,
    0
  );
  const beds = num(
    raw.beds ?? raw.bedrooms ?? raw.description?.beds ?? raw.bed_count,
    0
  );
  const baths = num(
    raw.baths ??
      raw.bathrooms ??
      raw.description?.baths ??
      raw.bath_count ??
      raw.baths_consolidated,
    0
  );
  const sqft = num(
    raw.sqft ??
      raw.livingArea ??
      raw.description?.sqft ??
      raw.building_size?.size ??
      raw.lot_size?.size,
    0
  );
  const image = firstImage(raw);
  const images = collectImages(raw, image);
  const status = mapStatus(
    raw.status || raw.homeStatus || raw.listingStatus || raw.status_text
  );
  const zillowUrl =
    raw.zillowUrl ||
    raw.url ||
    raw.detailUrl ||
    (zpid && String(zpid).match(/^\d+$/)
      ? `https://www.zillow.com/homedetails/${zpid}_zpid/`
      : undefined);
  const sourceUrl =
    raw.sourceUrl ||
    raw.permalink ||
    raw.rdc_web_url ||
    raw.href ||
    (raw.property_id
      ? `https://www.realtor.com/realestateandhomes-detail/M${raw.property_id}`
      : undefined);
  const title = parsed.street || address || `${city} home`;
  const brokerage =
    raw.brokerage ||
    raw.brokerName ||
    raw.branding?.[0]?.name ||
    raw.list_office?.name ||
    raw.office?.name ||
    "";
  const listedBy =
    raw.listedBy ||
    raw.agentName ||
    raw.listingAgent ||
    raw.list_agent?.name ||
    raw.agents?.[0]?.name ||
    (typeof raw.agent === "string" ? raw.agent : raw.agent?.name) ||
    "";
  const description =
    raw.description ||
    raw.listingDescription ||
    (typeof raw.description === "object" ? raw.description?.text : "") ||
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

  const mlsId =
    raw.mlsId ||
    raw.mlsid ||
    raw.mlsNumber ||
    raw.mls?.id ||
    raw.mls_number ||
    undefined;

  const id = mlsId
    ? `mls-${slug(mlsId)}`
    : zpid
      ? `zpid-${zpid}`
      : `lst-${slug(city)}-${i + 1}`;

  const p = {
    id,
    zpid: zpid && String(zpid).match(/^\d+$/) ? String(zpid) : undefined,
    mlsId: mlsId ? String(mlsId) : undefined,
    status,
    title: String(title).slice(0, 120),
    address: address || undefined,
    city,
    neighborhood: raw.neighborhood || city,
    state,
    zip,
    type: mapHomeType(
      raw.property_type ||
        raw.homeType ||
        raw.propertyType ||
        raw.description?.type ||
        raw.prop_type
    ),
    beds,
    baths,
    sqft,
    yearBuilt: num(raw.yearBuilt ?? raw.year_built ?? raw.description?.year_built, 0) || 0,
    priceUsd: price,
    image: images[0] || "",
    images: images.length ? images : [],
    tagline: tagline || city,
    description: String(description).slice(0, 4000),
    zillowUrl,
    sourceUrl,
    sourcePortal,
    lat: num(raw.latitude ?? raw.lat ?? raw.location?.address?.coordinate?.lat, NaN) || undefined,
    lng: num(raw.longitude ?? raw.lng ?? raw.location?.address?.coordinate?.lon, NaN) || undefined,
    listedAt: deriveListedAt(raw),
    daysOnMarket: num(raw.daysOnZillow ?? raw.days_on_market ?? raw.daysOnMarket, NaN) || undefined,
    updatedAt: new Date().toISOString(),
    brokerage: brokerage || undefined,
    listedBy: listedBy || undefined,
  };
  const badge = badgeFrom({
    status: p.status,
    daysOnMarket: raw.daysOnZillow ?? raw.days_on_market ?? raw.list_date,
  });
  if (badge) p.badge = badge;
  if (raw._enriched) p._enriched = true;
  for (const k of Object.keys(p)) if (p[k] === undefined) delete p[k];
  return p;
}


function deriveListedAt(raw) {
  const candidates = [
    raw.listedAt,
    raw.listDate,
    raw.list_date,
    raw.datePosted,
    raw.timeOnZillow,
  ];
  for (const c of candidates) {
    if (!c) continue;
    const d = new Date(c);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const dom = num(raw.daysOnZillow ?? raw.days_on_market ?? raw.daysOnMarket, NaN);
  if (Number.isFinite(dom) && dom >= 0) {
    return new Date(Date.now() - dom * 86400000).toISOString();
  }
  return undefined;
}

function matchesBrokerage(rawOrListing) {
  if (!BROKERAGE_FILTER.length) return true;
  const bro = String(
    rawOrListing.brokerage ||
      rawOrListing.brokerName ||
      rawOrListing.list_office?.name ||
      rawOrListing.branding?.[0]?.name ||
      rawOrListing.office?.name ||
      ""
  ).toLowerCase();
  if (!bro) return false;
  return BROKERAGE_FILTER.some((f) => bro.includes(f.replace(/\s+/g, " ")));
}

function listingKey(p) {
  if (p.mlsId) return `mls:${String(p.mlsId).toLowerCase()}`;
  if (p.zpid) return `zpid:${p.zpid}`;
  const addr = `${p.address || p.title}|${p.zip || p.city}`.toLowerCase();
  return `addr:${addr}`;
}

function mergeListings(groups) {
  const map = new Map();
  const order = [];
  for (const { items, portal } of groups) {
    items.forEach((raw, i) => {
      const p = normalizeListing(raw, i, portal);
      if (!(p.priceUsd > 0 || p.image || p.zpid || p.mlsId)) return;
      // Honesty: do not invent listing agent/office for market inventory.
      // Manual / MLS agent inventory may keep explicit fields from source.
      const k = listingKey(p);
      if (map.has(k)) {
        // fill gaps from newer source without clobbering
        const prev = map.get(k);
        for (const key of Object.keys(p)) {
          if (prev[key] == null || prev[key] === "" || prev[key] === 0) {
            if (p[key] != null && p[key] !== "") prev[key] = p[key];
          }
        }
        if ((!prev.images || !prev.images.length) && p.images?.length) {
          prev.images = p.images;
          prev.image = p.image;
        }
      } else {
        map.set(k, p);
        order.push(k);
      }
    });
  }
  return order.map((k) => map.get(k)).slice(0, MAX_LISTINGS);
}

function demoFeed() {
  const demoPath = resolve(ROOT, "public/data/listings.demo.json");
  if (existsSync(demoPath)) return JSON.parse(readFileSync(demoPath, "utf8"));
  return {
    version: 1,
    source: "demo",
    syncedAt: null,
    agent: DEFAULT_AGENT,
    listings: [],
  };
}

function readLastGood() {
  if (!existsSync(OUT)) return null;
  try {
    const data = JSON.parse(readFileSync(OUT, "utf8"));
    if (data?.listings?.length) return data;
  } catch {
    /* ignore */
  }
  return null;
}

// ── RapidAPI client ──────────────────────────────────────────────────────

async function rapidGet(host, pathAndQuery, attempt = 0) {
  if (!KEY) throw new Error("RAPIDAPI_KEY missing");
  const url = pathAndQuery.startsWith("http")
    ? pathAndQuery
    : `https://${host}${pathAndQuery.startsWith("/") ? "" : "/"}${pathAndQuery}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-host": host,
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

  const msg = String(body?.message || body?.raw || "");
  const monthly =
    /monthly quota|exceeded the MONTHLY|upgrade your plan/i.test(msg);
  const notSub = /not subscribed/i.test(msg);

  // Hard stop — do not burn retries across locations
  if (monthly || (res.status === 403 && notSub) || res.status === 401) {
    return {
      ok: false,
      status: res.status,
      body,
      url,
      fatal: monthly ? "monthly_quota" : notSub ? "not_subscribed" : "auth",
    };
  }

  // Transient 429 — few retries only
  if (res.status === 429 && attempt < 2 && !monthly) {
    const wait = 1500 * (attempt + 1);
    console.warn(`[rapidapi] 429 ${host} — wait ${wait}ms`);
    await sleep(wait);
    return rapidGet(host, pathAndQuery, attempt + 1);
  }
  return { ok: res.ok, status: res.status, body, url, fatal: null };
}

// ── Zillow ───────────────────────────────────────────────────────────────

async function zillowByLocation(location, maxPages = MAX_PAGES) {
  if (providerBlock.zillow) return [];
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    await sleep(REQUEST_GAP_MS);
    const q = `/bylocation?location=${encodeURIComponent(location)}&page=${page}`;
    const { ok, status, body, fatal } = await rapidGet(ZILLOW_HOST, q);
    if (fatal) {
      providerBlock.zillow = fatal;
      console.warn(`[zillow] blocked (${fatal}):`, body?.message || status);
      break;
    }
    if (!ok) {
      console.warn(`[zillow/bylocation] ${status} ${location} p${page}`, body?.message);
      break;
    }
    const results = body?.results || [];
    const pag = body?.pagination || {};
    console.log(
      `[zillow/bylocation] ${location} p${page} → ${results.length} (total≈${pag.total_results ?? "?"})`
    );
    all.push(...results);
    if (!pag.has_next || !results.length) break;
    if (all.length >= MAX_LISTINGS) break;
  }
  return all;
}

async function zillowByMls(mlsid) {
  if (providerBlock.zillow) return [];
  const all = [];
  for (let page = 1; page <= 3; page++) {
    await sleep(REQUEST_GAP_MS);
    const { ok, status, body, fatal } = await rapidGet(
      ZILLOW_HOST,
      `/bymlsid?mlsid=${encodeURIComponent(mlsid)}&page=${page}`
    );
    if (fatal) {
      providerBlock.zillow = fatal;
      console.warn(`[zillow] blocked (${fatal}):`, body?.message || status);
      break;
    }
    if (!ok) {
      console.warn(`[zillow/bymlsid] ${status} ${mlsid}`, body?.message);
      break;
    }
    const results = body?.results || (body?.zpid ? [body] : []);
    console.log(`[zillow/bymlsid] ${mlsid} p${page} → ${results.length}`);
    if (!results.length) break;
    all.push(...results);
    if (!body?.pagination?.has_next) break;
  }
  return all;
}


async function zillowByUrl(url) {
  if (providerBlock.zillow || !url) return null;
  await sleep(REQUEST_GAP_MS);
  const { ok, status, body, fatal } = await rapidGet(
    ZILLOW_HOST,
    `/byurl?url=${encodeURIComponent(url)}`
  );
  if (fatal) {
    providerBlock.zillow = fatal;
    console.warn(`[zillow] blocked (${fatal}):`, body?.message || status);
    return null;
  }
  if (!ok) {
    console.warn(`[zillow/byurl] ${status}`, body?.message || "");
    return null;
  }
  // API may return {results:[...]} or a single property object
  if (Array.isArray(body?.results) && body.results[0]) return body.results[0];
  if (body?.zpid || body?.address || body?.price) return body;
  return null;
}

async function enrichListings(rawItems) {
  const limit = ENRICH_LIMIT;
  if (!limit || !rawItems.length || providerBlock.zillow) return rawItems;
  console.log(`[zillow/enrich] up to ${limit} via /byurl`);
  let enriched = 0;
  const out = [...rawItems];
  for (let i = 0; i < out.length && enriched < limit; i++) {
    if (providerBlock.zillow) break;
    const r = out[i];
    const url =
      r.detailUrl ||
      r.url ||
      r.zillowUrl ||
      (r.zpid ? `https://www.zillow.com/homedetails/${r.zpid}_zpid/` : null);
    if (!url) continue;
    // Skip if already has multi photos / long description
    const hasRich =
      (Array.isArray(r.photos) && r.photos.length > 1) ||
      (typeof r.description === "string" && r.description.length > 80);
    if (hasRich) continue;
    try {
      const detail = await zillowByUrl(url);
      if (detail) {
        out[i] = { ...r, ...detail, _enriched: true };
        enriched++;
        console.log(`[zillow/enrich] ${enriched}/${limit} · zpid=${detail.zpid || r.zpid || "?"}`);
      }
    } catch (e) {
      console.warn(`[zillow/enrich]`, e.message);
    }
  }
  console.log(`[zillow/enrich] done · ${enriched} upgraded`);
  return out;
}

async function fromZillow() {
  if (!KEY || MANUAL_ONLY) return [];
  console.log(`[zillow] host=${ZILLOW_HOST} mode=${MODE}`);
  let raw = [];

  const wantMls = MODE === "mls" || MODE === "hybrid" || MLS_IDS.length > 0;
  const wantMarket =
    MODE === "market" || MODE === "brokerage" || MODE === "hybrid";

  if (wantMls && MLS_IDS.length) {
    for (const id of MLS_IDS) {
      try {
        raw.push(...(await zillowByMls(id)));
      } catch (e) {
        console.warn(`[zillow/mls] ${id}`, e.message);
      }
    }
  }

  if (wantMarket && MODE !== "mls") {
    for (const loc of LOCATIONS) {
      if (providerBlock.zillow) {
        console.warn(`[zillow] skip remaining locations (${providerBlock.zillow})`);
        break;
      }
      if (raw.length >= MAX_LISTINGS) break;
      try {
        raw.push(...(await zillowByLocation(loc, MAX_PAGES)));
      } catch (e) {
        console.warn(`[zillow/loc] ${loc}`, e.message);
      }
    }
  }

  // de-dupe raw by zpid
  const seen = new Set();
  raw = raw.filter((r) => {
    const k = String(r.zpid || r.url || JSON.stringify(r).slice(0, 80));
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (MODE === "brokerage") {
    const before = raw.length;
    raw = raw.filter(matchesBrokerage);
    console.log(
      `[zillow/filter] brokerage ${BROKERAGE_FILTER.join(" | ")}: ${before} → ${raw.length}`
    );
  }

  raw = raw.slice(0, MAX_LISTINGS);
  if (ENRICH_LIMIT > 0) {
    raw = await enrichListings(raw);
  }
  return raw;
}

// ── Realtor.com (RapidAPI) ───────────────────────────────────────────────
/**
 * Supported when you subscribe one of:
 *   - realty-in-us.p.rapidapi.com
 *   - realtor16.p.rapidapi.com
 *   - us-real-estate.p.rapidapi.com
 * Set REALTOR_RAPIDAPI_HOST accordingly. Same RAPIDAPI_KEY.
 */
async function fromRealtor() {
  if (!KEY || MANUAL_ONLY) return [];
  if (String(process.env.REALTOR_ENABLED || "1") === "0") return [];
  if (providerBlock.realtor) return [];

  const host = REALTOR_HOST;
  console.log(`[realtor] host=${host}`);

  const paths = buildRealtorPaths(host);
  let raw = [];

  for (const path of paths) {
    if (providerBlock.realtor) break;
    await sleep(REQUEST_GAP_MS);
    try {
      const { ok, status, body, fatal } = await rapidGet(host, path);
      if (fatal) {
        providerBlock.realtor = fatal;
        console.warn(`[realtor] blocked (${fatal}):`, body?.message || status);
        break;
      }
      if (!ok) {
        console.warn(`[realtor] ${status} ${path.slice(0, 80)}`, body?.message || "");
        if (status === 403 || status === 404) {
          providerBlock.realtor = status === 403 ? "not_subscribed" : "not_found";
          break;
        }
        continue;
      }
      const items = extractRealtorResults(body);
      console.log(`[realtor] ${path.slice(0, 60)} → ${items.length}`);
      raw.push(...items);
      if (raw.length >= MAX_LISTINGS) break;
    } catch (e) {
      console.warn(`[realtor]`, e.message);
      break;
    }
  }

  if (MODE === "brokerage" && raw.length) {
    const before = raw.length;
    const filtered = raw.filter(matchesBrokerage);
    if (filtered.length) {
      console.log(`[realtor/filter] brokerage: ${before} → ${filtered.length}`);
      raw = filtered;
    } else {
      console.warn(
        `[realtor/filter] 0 matched brokerage filter — keeping unfiltered realtor results (${before}); stamp Lock & Key only on manual rows`
      );
    }
  }

  return raw.slice(0, MAX_LISTINGS);
}

function buildRealtorPaths(host) {
  const city = "Valdosta";
  const state = "GA";
  const loc = encodeURIComponent("Valdosta, GA");
  const office = encodeURIComponent("Lock and Key Realty");
  const paths = [];

  if (host.includes("realty-in-us")) {
    paths.push(
      `/properties/v2/list-for-sale?city=${city}&state_code=${state}&offset=0&limit=42&sort=relevance`
    );
    paths.push(
      `/properties/v2/list-for-sale?city=Moultrie&state_code=${state}&offset=0&limit=20&sort=relevance`
    );
  } else if (host.includes("realtor16")) {
    paths.push(`/forsale?location=${loc}`);
    paths.push(`/properties/list-for-sale?city=${city}&state_code=${state}`);
    paths.push(`/search/agents?location=${loc}&name=${encodeURIComponent("Leyanis")}`);
  } else if (host.includes("us-real-estate")) {
    paths.push(`/for-sale?offset=0&limit=42&city=${city}&state_code=${state}`);
    paths.push(`/v2/for-sale?offset=0&limit=42&city=${city}&state_code=${state}`);
  } else if (host.includes("realtor-search")) {
    paths.push(`/properties/search-sale?location=${loc}&limit=42`);
  } else if (host.includes("real-time-real-estate-data")) {
    paths.push(`/property-search?location=${loc}&status=for_sale`);
  } else {
    // generic guesses
    paths.push(`/properties/v2/list-for-sale?city=${city}&state_code=${state}&offset=0&limit=42`);
    paths.push(`/forsale?location=${loc}`);
  }

  // optional custom path override
  if (process.env.REALTOR_SEARCH_PATH) {
    paths.unshift(process.env.REALTOR_SEARCH_PATH);
  }
  // office-oriented path if provided
  if (process.env.REALTOR_OFFICE_PATH) {
    paths.unshift(
      process.env.REALTOR_OFFICE_PATH.replace("{office}", office).replace(
        "{location}",
        loc
      )
    );
  }
  return paths;
}

function extractRealtorResults(body) {
  if (!body) return [];
  if (Array.isArray(body)) return body;
  if (Array.isArray(body.properties)) return body.properties;
  if (Array.isArray(body.data)) return body.data;
  if (Array.isArray(body.results)) return body.results;
  if (Array.isArray(body?.data?.results)) return body.data.results;
  if (Array.isArray(body?.data?.home_search?.results))
    return body.data.home_search.results;
  if (Array.isArray(body?.props)) return body.props;
  if (body.property_id || body.listing_id || body.permalink) return [body];
  return [];
}

// ── Apify ────────────────────────────────────────────────────────────────

async function fromApify() {
  const token = process.env.APIFY_TOKEN;
  if (!token || MANUAL_ONLY) return [];
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

// ── Manual MLS / JSON ────────────────────────────────────────────────────

function fromManual() {
  const abs = resolve(ROOT, MANUAL_PATH);
  if (!existsSync(abs)) {
    console.log(`[manual] no file at ${MANUAL_PATH} (ok)`);
    return [];
  }
  const data = JSON.parse(readFileSync(abs, "utf8"));
  const list = Array.isArray(data) ? data : data.listings || [];
  console.log(`[manual] ${list.length} row(s) from ${MANUAL_PATH}`);
  return list.map((row) => {
    // bare MLS id string
    if (typeof row === "string") {
      return {
        mlsId: row,
        status: "for_sale",
        city: AGENT_LOCATION.split(",")[0].trim(),
        state: "GA",
        title: `MLS ${row}`,
        priceUsd: 0,
        beds: 0,
        baths: 0,
        sqft: 0,
        yearBuilt: 0,
        image: "",
        images: [],
        tagline: "MLS",
        description: `Manual MLS placeholder for ${row}. Enrich via API or full JSON fields.`,
        brokerage: DEFAULT_AGENT.brokerage,
        listedBy: DEFAULT_AGENT.name,
        sourcePortal: "mls",
      };
    }
    return {
      ...row,
      brokerage: row.brokerage || DEFAULT_AGENT.brokerage,
      listedBy: row.listedBy || DEFAULT_AGENT.name,
      sourcePortal: row.sourcePortal || "manual",
    };
  });
}

function resolveInventoryKind(source, mode, sourcesUsed, listings) {
  if (source === "demo") return "demo";
  if (source === "manual" || (sourcesUsed.length === 1 && sourcesUsed[0] === "manual"))
    return "manual";
  if (mode === "mls" || (MLS_IDS.length && sourcesUsed.includes("zillow") && mode === "mls"))
    return "agent";
  // If every listing is manual/mls portal, treat as agent-ish
  const portals = new Set(listings.map((p) => p.sourcePortal).filter(Boolean));
  if (portals.size && [...portals].every((p) => p === "manual" || p === "mls"))
    return "agent";
  if (mode === "market" || mode === "hybrid" || mode === "brokerage") return "market";
  if (source === "mixed") return "mixed";
  return "market";
}

// ── main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("═".repeat(56));
  console.log(" Leey · inventory sync (manual + zillow + realtor)");
  console.log("═".repeat(56));
  console.log(` agent:   ${AGENT_NAME}`);
  console.log(` mode:    ${MODE}`);
  console.log(
    ` mls ids: ${MLS_IDS.length ? MLS_IDS.join(", ") : "(none — data/mls-ids.txt)"}`
  );
  console.log(` manual:  ${MANUAL_PATH}`);
  console.log(` locs:    ${LOCATIONS.join(" · ")}`);
  console.log(` zillow:  ${ZILLOW_HOST} · key=${KEY ? "yes" : "no"}`);
  console.log(` realtor: ${REALTOR_HOST} · enabled=${process.env.REALTOR_ENABLED ?? "1"}`);
  console.log(` keep:    last-good=${KEEP_LAST_GOOD}`);
  console.log(` out:     ${OUT}`);

  const groups = [];
  let sourcesUsed = [];

  if (!FORCE_DEMO) {
    // 1) Manual always first (authoritative Lock & Key rows)
    try {
      const manual = fromManual();
      if (manual.length) {
        groups.push({ items: manual, portal: "manual" });
        sourcesUsed.push("manual");
      }
    } catch (e) {
      console.error("[manual]", e.message);
    }

    // 2) Zillow (unless manual-only)
    if (!MANUAL_ONLY && MODE !== "manual") {
      try {
        const z = await fromZillow();
        if (z.length) {
          groups.push({ items: z, portal: "zillow" });
          sourcesUsed.push("zillow");
        }
      } catch (e) {
        console.error("[zillow]", e.message);
      }
    }

    // 3) Realtor fallback
    if (!MANUAL_ONLY && MODE !== "manual") {
      try {
        const r = await fromRealtor();
        if (r.length) {
          groups.push({ items: r, portal: "realtor" });
          sourcesUsed.push("realtor");
        }
      } catch (e) {
        console.error("[realtor]", e.message);
      }
    }

    // 4) Apify last
    if (!MANUAL_ONLY && !groups.some((g) => g.portal === "zillow")) {
      try {
        const a = await fromApify();
        if (a?.length) {
          groups.push({ items: a, portal: "zillow" });
          sourcesUsed.push("apify");
        }
      } catch (e) {
        console.error("[apify]", e.message);
      }
    }
  }

  let listings = mergeListings(groups);
  let source =
    sourcesUsed.length > 1
      ? "mixed"
      : sourcesUsed[0] === "apify"
        ? "zillow"
        : sourcesUsed[0] || "demo";

  if (!listings.length) {
    const last = KEEP_LAST_GOOD ? readLastGood() : null;
    if (last?.listings?.length) {
      console.warn(
        `\n⚠  No fresh listings — keeping last-good feed (${last.listings.length}, source=${last.source}, syncedAt=${last.syncedAt})`
      );
      if (DRY) {
        console.log("(dry-run) would preserve last-good");
        return;
      }
      // touch meta only
      const preserved = {
        ...last,
        meta: {
          ...(last.meta || {}),
          preserved: true,
          preserveReason: "all_sources_empty",
          attemptedAt: new Date().toISOString(),
          mode: MODE,
          sourcesTried: sourcesUsed,
        },
      };
      writeFileSync(OUT, JSON.stringify(preserved, null, 2) + "\n");
      console.log(`✓ preserved ${OUT}`);
      return;
    }

    console.warn("\n⚠  No live listings and no last-good — writing demo feed.");
    const demo = demoFeed();
    listings = demo.listings || [];
    source = "demo";
  }

  const inventoryKind = resolveInventoryKind(source, MODE, sourcesUsed, listings);
  const feed = {
    version: 1,
    source,
    syncedAt: new Date().toISOString(),
    agent: DEFAULT_AGENT,
    meta: {
      mode: MODE,
      inventoryKind,
      zillowHost: ZILLOW_HOST,
      realtorHost: REALTOR_HOST,
      locations: LOCATIONS,
      mlsIds: MLS_IDS,
      manualPath: MANUAL_PATH,
      sourcesUsed,
      enriched: (() => {
        const n = listings.filter((p) => p._enriched).length;
        return n || undefined;
      })(),
      brokerageFilter:
        MODE === "brokerage" || MODE === "hybrid" ? BROKERAGE_FILTER : undefined,
      note:
        inventoryKind === "market"
          ? "Market FOR_SALE inventory for service areas — not exclusively Leey/Lock & Key listings. Prefer MLS mode + data/mls-ids.txt for agent-accurate inventory."
          : inventoryKind === "agent"
            ? "Agent/MLS inventory."
            : undefined,
    },
    listings: listings.map((p) => {
      const { _enriched, ...rest } = p;
      return rest;
    }),
  };

  console.log(`\n→ ${listings.length} listings · source=${source} · via [${sourcesUsed.join(", ") || "—"}]`);
  if (listings[0]) {
    console.log(
      `  e.g. ${listings[0].title} · ${listings[0].city} · $${listings[0].priceUsd} · ${listings[0].brokerage || "?"}`
    );
  }

  if (DRY) {
    console.log(JSON.stringify(feed, null, 2).slice(0, 3000));
    console.log("\n(dry-run)");
    return;
  }

  mkdirSync(dirname(OUT), { recursive: true });
  // backup previous
  if (existsSync(OUT)) {
    try {
      copyFileSync(OUT, `${OUT}.bak`);
    } catch {
      /* ignore */
    }
  }
  writeFileSync(OUT, JSON.stringify(feed, null, 2) + "\n");
  console.log(`✓ wrote ${OUT}`);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
