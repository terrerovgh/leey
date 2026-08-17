/**
 * Pre-render static HTML for every route so search engines and link
 * previewers see real content WITHOUT executing JS.
 *
 * Strategy (robust, no headless browser needed):
 *  - Vite builds the SPA into dist/ (index.html is the JS shell).
 *  - This script reads dist/index.html, then for each route writes a
 *    folder-style static page (e.g. dist/properties/index.html) whose
 *    <head> carries that route's SEO meta + JSON-LD, and whose <div id=root>
 *    already contains the STATIC, crawlable content for the route.
 *  - The original module script is preserved, so the SPA still hydrates
 *    client-side for real users; the static content is replaced on mount.
 *
 * Run: node scripts/prerender.mjs   (after `vite build`)
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIST = resolve(ROOT, "dist");

const SITE_URL = "https://leeyrealty.com";
const PHONE_DISPLAY = "(404) 403-8306";
const PHONE_TEL = "+1" + "404" + "403" + "8306";
const EMAIL = "leey@lockandkeyrealty.com";
const AGENT = "Leyanis “Leey” Hernandez";
const BROKERAGE = "Lock & Key Realty";

/* ── Load feed (live or demo) ─────────────────────────────────────── */
function loadFeed() {
  try {
    const raw = readFileSync(resolve(ROOT, "public/data/listings.json"), "utf8");
    const data = JSON.parse(raw);
    if (data?.listings?.length) return data;
  } catch {}
  // fallback: hard-coded demo mirror (kept in sync with data/listings.ts)
  return {
    source: "demo",
    listings: [
      { id: "VLD-N-014", status: "for_sale", title: "North Valdosta Brick Ranch", city: "Valdosta", neighborhood: "Northside", state: "GA", zip: "31602", type: "house", beds: 3, baths: 2, sqft: 1680, lotSizeSqft: 17424, yearBuilt: 1998, priceUsd: 239000, image: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1600&q=80", images: ["https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1800&q=80"], tagline: "Quiet cul-de-sac, updated kitchen, fenced yard.", description: "Brick ranch with open living, new HVAC (2023), and a workshop out back. Minutes from Valdosta State and Northside shops." },
      { id: "HAH-W-008", status: "for_sale", title: "Hahira Family Home", city: "Hahira", neighborhood: "West Hahira", state: "GA", zip: "31632", type: "house", beds: 4, baths: 2, sqft: 2100, lotSizeSqft: 26136, yearBuilt: 2006, priceUsd: 289000, image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80", images: ["https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1800&q=80"], tagline: "Half-acre lot, side-entry garage, strong schools.", description: "Spacious 4-bed in Hahira with covered porch and room for a garden. Easy drive to Valdosta employment centers." },
      { id: "ADL-M-021", status: "for_sale", title: "Adel Craftsman", city: "Adel", neighborhood: "Downtown fringe", state: "GA", zip: "31620", type: "house", beds: 3, baths: 2, sqft: 1750, yearBuilt: 2012, priceUsd: 224900, image: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1600&q=80", images: ["https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1800&q=80"], tagline: "Front porch, metal accents, walkable to town.", description: "Charming craftsman-inspired home near downtown Adel shops and parks." },
      { id: "MOU-E-011", status: "pending", title: "Moultrie Acreage Home", city: "Moultrie", neighborhood: "East Colquitt", state: "GA", zip: "31768", type: "house", beds: 3, baths: 2, sqft: 1900, lotSizeSqft: 87120, yearBuilt: 1995, priceUsd: 275000, image: "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?auto=format&fit=crop&w=1600&q=80", images: ["https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?auto=format&fit=crop&w=1800&q=80"], tagline: "Two acres, metal roof, workshop.", description: "Country setting with room for animals or a garden. Solid bones and a deep porch." },
      { id: "TVL-S-004", status: "for_sale", title: "Thomasville Bungalow", city: "Thomasville", neighborhood: "Historic district", state: "GA", zip: "31792", type: "house", beds: 3, baths: 2, sqft: 1620, yearBuilt: 1938, priceUsd: 259000, image: "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?auto=format&fit=crop&w=1600&q=80", images: ["https://images.unsplash.com/photo-1572120360610-d971b9d7767c?auto=format&fit=crop&w=1800&q=80"], tagline: "Hardwood floors, oak shade, walkable streets.", description: "Classic Thomasville bungalow with character details and a manageable lot near downtown." },
      { id: "TFT-N-019", status: "for_sale", title: "Tifton Ranch", city: "Tifton", neighborhood: "Northside", state: "GA", zip: "31794", type: "house", beds: 4, baths: 2.5, sqft: 2200, yearBuilt: 2010, priceUsd: 312000, image: "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?auto=format&fit=crop&w=1600&q=80", images: ["https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?auto=format&fit=crop&w=1800&q=80"], tagline: "Open plan, screened porch, quiet street.", description: "Modern ranch near schools and shopping. Move-in ready." },
    ],
  };
}

const FEED = loadFeed();
const LISTINGS = FEED.listings.filter((p) => p.status === "for_sale" || p.status === "pending");

/* ── Area data (mirror of lib/areas.ts) ──────────────────────────── */
const AREAS = [
  { slug: "valdosta", city: "Valdosta", state: "GA", taglineEs: "El corazón del sur de Georgia.", taglineEn: "South Georgia's hub city.", bodyEs: ["Valdosta es el centro económico del sur de Georgia: sede de Valdosta State University, hospital regional y corredores comerciales sobre la I-75. Sus barrios combinan ranchos de ladrillo asequibles con casas nuevas en desarrollos planificados.", "Como agente bilingüe licenciada en Georgia y Florida, ayudo a familias a comprar y vender en Valdosta sin fricción, en español o en inglés. Conozco los precios por barrio, las escuelas y qué reparaciones valen la pena antes de listar."], bodyEn: ["Valdosta is the economic hub of South Georgia — home to Valdosta State University, a regional hospital, and I-75 commercial corridors.", "As a bilingual agent licensed in Georgia and Florida, I help families buy and sell in Valdosta with no friction, in Spanish or English."], kwEs: ["realtor Valdosta GA", "casas en venta Valdosta"], kwEn: ["Valdosta realtor", "homes for sale Valdosta GA"] },
  { slug: "hahira", city: "Hahira", state: "GA", taglineEs: "Pueblo unido, lotes amplios, a minutos de Valdosta.", taglineEn: "Close-knit town, wider lots, minutes from Valdosta.", bodyEs: ["Hahira conserva el encanto de un pueblo pequeño con lotes más generosos y una comunidad muy unida.", "Te ayudo a encontrar esa casa con porche y jardín en Hahira, o a listar la tuya."], bodyEn: ["Hahira keeps small-town charm with wider lots and a tight-knit community.", "I'll help you find that porch-and-yard home in Hahira, or list yours."], kwEs: ["realtor Hahira GA", "casas Hahira"], kwEn: ["Hahira realtor", "homes for sale Hahira GA"] },
  { slug: "adel", city: "Adel", state: "GA", taglineEs: "Condado de Cook. Buen valor y ambiente familiar.", taglineEn: "Cook County. Solid value and a family feel.", bodyEs: ["Adel, en el condado de Cook, ofrece casas con muy buen valor y un ambiente familiar auténtico.", "Conozco el inventario de Adel y te guío desde la búsqueda hasta el cierre."], bodyEn: ["Adel, in Cook County, offers strong home value and an authentic family feel.", "I know Adel's inventory and I'll walk you from search to closing."], kwEs: ["realtor Adel GA", "casas en Adel GA"], kwEn: ["Adel realtor", "homes for sale Adel GA"] },
  { slug: "sparks", city: "Sparks", state: "GA", taglineEs: "Opciones accesibles junto a Adel.", taglineEn: "Attainable options next to Adel.", bodyEs: ["Sparks es una comunidad pequeña junto a Adel con opciones de vivienda más accesibles.", "Te ayudo a evaluar propiedades en Sparks con datos reales de mercado."], bodyEn: ["Sparks is a small community next to Adel with attainable housing.", "I'll help you evaluate Sparks properties with real market data."], kwEs: ["realtor Sparks GA", "casas Sparks GA"], kwEn: ["Sparks realtor", "homes for sale Sparks GA"] },
  { slug: "lenox", city: "Lenox", state: "GA", taglineEs: "Vida de pueblo tranquilo cerca del corredor I-75.", taglineEn: "Quiet town living near the I-75 corridor.", bodyEs: ["Lenox combina la calma de un pueblo con la ventaja de estar cerca del corredor I-75.", "Busco contigo la propiedad adecuada en Lenox."], bodyEn: ["Lenox pairs small-town calm with proximity to the I-75 corridor.", "I'll search Lenox with you."], kwEs: ["realtor Lenox GA", "casas Lenox GA"], kwEn: ["Lenox realtor", "homes for sale Lenox GA"] },
  { slug: "ray-city", city: "Ray City", state: "GA", taglineEs: "Condado de Berrien. Casas con terreno y comunidad.", taglineEn: "Berrien County. Homes with land and community.", bodyEs: ["Ray City atrae a quienes buscan casa con terreno y una comunidad cercana.", "Te ayudo a encontrar esa propiedad con terreno en Ray City."], bodyEn: ["Ray City draws buyers wanting homes with land and a close community.", "I'll help you find that land-and-home property in Ray City."], kwEs: ["realtor Ray City GA", "casas Ray City GA"], kwEn: ["Ray City realtor", "homes for sale Ray City GA"] },
  { slug: "moultrie", city: "Moultrie", state: "GA", taglineEs: "Condado de Colquitt. Pueblo activo con buen parque residencial.", taglineEn: "Colquitt County. Active town with solid residential stock.", bodyEs: ["Moultrie es un pueblo activo con inventario residencial sólido y lotes grandes.", "Si buscas casa con terreno en Moultrie, te ayudo a identificar la mejor opción."], bodyEn: ["Moultrie is an active town with solid residential stock and large lots.", "If you want a home with land in Moultrie, I'll help you spot the best option."], kwEs: ["realtor Moultrie GA", "casas Moultrie GA"], kwEn: ["Moultrie realtor", "homes for sale Moultrie GA"] },
  { slug: "thomasville", city: "Thomasville", state: "GA", taglineEs: "Condado de Thomas. Encanto histórico y barrios consolidados.", taglineEn: "Thomas County. Historic charm and established neighborhoods.", bodyEs: ["Thomasville destaca por su encanto histórico, sus bungalows y barrios con sombra de robles.", "Te ayudo a navegar el mercado histórico de Thomasville."], bodyEn: ["Thomasville stands out for historic charm, oak-shaded streets, and character bungalows.", "I'll help you navigate Thomasville's historic market."], kwEs: ["realtor Thomasville GA", "casas Thomasville GA"], kwEn: ["Thomasville realtor", "homes for sale Thomasville GA"] },
  { slug: "nashville", city: "Nashville", state: "GA", taglineEs: "Condado de Berrien. Ritmo de pueblo pequeño y opciones accesibles.", taglineEn: "Berrien County. Small-town pace and attainable options.", bodyEs: ["Nashville ofrece el ritmo de un pueblo pequeño y opciones de vivienda accesibles.", "Te acompaño en la compra o venta de tu casa en Nashville."], bodyEn: ["Nashville offers small-town pace and attainable housing.", "I'll stand with you through buying or selling your Nashville home."], kwEs: ["realtor Nashville GA", "casas Nashville GA"], kwEn: ["Nashville realtor", "homes for sale Nashville GA"] },
  { slug: "tifton", city: "Tifton", state: "GA", taglineEs: "Condado de Tift. Energía universitaria, comercios y casas familiares.", taglineEn: "Tift County. Campus energy, retail corridors, family homes.", bodyEs: ["Tifton suma energía universitaria, corredores comerciales y casas familiares bien ubicadas.", "Te ayudo a comprar o vender en Tifton con conocimiento del mercado local."], bodyEn: ["Tifton blends campus energy, retail corridors, and well-located family homes.", "I'll help you buy or sell in Tifton with local-market knowledge."], kwEs: ["realtor Tifton GA", "casas Tifton GA"], kwEn: ["Tifton realtor", "homes for sale Tifton GA"] },
  { slug: "north-florida", city: "North Florida", state: "FL", taglineEs: "Compra y vende al sur de la línea estatal.", taglineEn: "Buy and sell south of the state line.", bodyEs: ["Si cruzas desde Georgia hacia el norte de Florida, trabajar con una agente licenciada en ambos estados ahorra meses.", "Te ayudo con la compra o venta de tu propiedad en el norte de Florida."], bodyEn: ["If you're crossing from Georgia into North Florida, working with an agent licensed in both states saves months.", "I'll help you buy or sell your North Florida property."], kwEs: ["realtor norte de Florida", "casas norte de Florida"], kwEn: ["North Florida realtor", "homes for sale North Florida"] },
];

/* ── HTML helpers ─────────────────────────────────────────────────── */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmtPrice = (n) => "$" + Number(n).toLocaleString("en-US");

function listingCard(p) {
  const specs = [p.beds ? `${p.beds} bd` : "", p.baths ? `${p.baths} ba` : "", p.sqft ? `${Number(p.sqft).toLocaleString("en-US")} sqft` : ""].filter(Boolean).join(" · ");
  const loc = [p.neighborhood, p.city, p.state].filter(Boolean).join(", ");
  const href = `/properties/${p.id}`;
  return `
    <article class="listing-card">
      <a href="${href}" aria-label="${esc(p.title)}">
        <div class="listing-img" style="background-image:url('${esc(p.images?.[0] ?? p.image)}')"></div>
        <div class="listing-body">
          <div class="listing-loc">${esc(loc)}</div>
          <h3>${esc(p.title)}</h3>
          <div class="listing-price">${fmtPrice(p.priceUsd)}</div>
          <div class="listing-specs">${esc(specs)}</div>
          <div class="listing-office">${esc(BROKERAGE)} · ${esc(AGENT)}</div>
        </div>
      </a>
    </article>`;
}

/* ── Head builder ─────────────────────────────────────────────────── */
function buildHead({ title, description, path, image, keywords, jsonLd, lang = "es" }) {
  const canonical = SITE_URL + path;
  const ogLocale = lang === "es" ? "es_US" : "en_US";
  const ld = (jsonLd || []).map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n    ");
  return `    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta name="keywords" content="${esc((keywords || []).join(", "))}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="${ogLocale}" />
    <meta property="og:site_name" content="Leyanis Hernandez Realtor" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:image" content="${image || SITE_URL + "/assets/leey-portrait.jpg"}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${image || SITE_URL + "/assets/leey-portrait.jpg"}" />
    ${ld}`;
}

/* ── Route content builders ───────────────────────────────────────── */
function homeContent() {
  const cities = AREAS.map((a) => a.city).join(", ");
  return `
    <main class="seo-static">
      <section class="seo-hero">
        <p class="eyebrow">REALTOR · GEORGIA &amp; FLORIDA</p>
        <h1>Your next home in South Georgia.</h1>
        <p class="lede">${esc(cities)}. Hablamos español.</p>
        <p>${esc(AGENT)} — ${esc(BROKERAGE)}. Licensed in Georgia and Florida. Bilingual real estate agent serving South Georgia and North Florida.</p>
      </section>
      <section>
        <h2>About Leey</h2>
        <p>My name is Leyanis Hernandez. I was born in Havana, Cuba, and immigrated to the United States in 1998. I'm licensed in Georgia and Florida and I work in Spanish and English.</p>
      </section>
      <section>
        <h2>Homes for sale</h2>
        <div class="listing-grid">${LISTINGS.map(listingCard).join("")}</div>
      </section>
      <section>
        <h2>Contact</h2>
        <p>Phone: <a href="tel:${PHONE_TEL}">${esc(PHONE_DISPLAY)}</a> · Email: <a href="mailto:${EMAIL}">${esc(EMAIL)}</a></p>
      </section>
    </main>`;
}

function propertiesContent() {
  return `
    <main class="seo-static">
      <section>
        <h1>Homes for sale · South Georgia &amp; Florida</h1>
        <p>Inventory with ${esc(BROKERAGE)}. Filter by price, type and bedrooms with ${esc(AGENT)}, your bilingual agent.</p>
      </section>
      <section>
        <div class="listing-grid">${LISTINGS.map(listingCard).join("")}</div>
      </section>
    </main>`;
}

function propertyContent(p) {
  const specs = [p.beds ? `${p.beds} bedrooms` : "", p.baths ? `${p.baths} baths` : "", p.sqft ? `${Number(p.sqft).toLocaleString("en-US")} sqft` : "", p.yearBuilt ? `Built ${p.yearBuilt}` : ""].filter(Boolean).join(" · ");
  const loc = [p.neighborhood, p.city, p.state, p.zip].filter(Boolean).join(", ");
  return `
    <main class="seo-static">
      <article>
        <div class="listing-loc">${esc(loc)}</div>
        <h1>${esc(p.title)}</h1>
        <p class="lede">${esc(p.tagline)}</p>
        <div class="listing-price">${fmtPrice(p.priceUsd)}</div>
        <ul class="listing-specs-list"><li>${esc(specs)}</li></ul>
        <img src="${esc(p.images?.[0] ?? p.image)}" alt="${esc(p.title)}" />
        <h2>About this home</h2>
        <p>${esc(p.description)}</p>
        <div class="listing-office">Presented by ${esc(AGENT)}, ${esc(BROKERAGE)}</div>
        <p>Phone: <a href="tel:${PHONE_TEL}">${esc(PHONE_DISPLAY)}</a> · <a href="mailto:${EMAIL}">${esc(EMAIL)}</a></p>
      </article>
    </main>`;
}

function areaContent(a) {
  const local = LISTINGS.filter((p) => p.city.toLowerCase() === a.city.toLowerCase());
  const body = a.bodyEs.map((p) => `<p>${esc(p)}</p>`).join("");
  const cards = local.length ? `<section><h2>Homes in ${esc(a.city)}</h2><div class="listing-grid">${local.map(listingCard).join("")}</div></section>` : "";
  return `
    <main class="seo-static">
      <section>
        <div class="listing-loc">${esc(a.city)}, ${esc(a.state)}</div>
        <h1>Realtor en ${esc(a.city)}</h1>
        <p class="lede">${esc(a.taglineEs)}</p>
        <div class="area-body">${body}</div>
      </section>
      ${cards}
      <section>
        <h2>Contact</h2>
        <p>Phone: <a href="tel:${PHONE_TEL}">${esc(PHONE_DISPLAY)}</a> · <a href="mailto:${EMAIL}">${esc(EMAIL)}</a></p>
      </section>
    </main>`;
}

/* ── JSON-LD ──────────────────────────────────────────────────────── */
function agentLd() {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "@id": `${SITE_URL}/#agent`,
    name: "Leyanis Hernandez",
    alternateName: ["Leey Hernandez", "Leyanis “Leey” Hernandez"],
    url: `${SITE_URL}/`,
    image: `${SITE_URL}/assets/leey-portrait.jpg`,
    logo: `${SITE_URL}/assets/lock-and-key-logo.png`,
    telephone: PHONE_TEL,
    email: EMAIL,
    description: "Real estate agent licensed in Georgia and Florida with Lock & Key Realty. Serving Valdosta, Hahira, Adel, Sparks, Lenox, Ray City, Moultrie, Thomasville, Nashville, Tifton and North Florida.",
    knowsLanguage: ["es", "en"],
    areaServed: [
      ...["Valdosta", "Hahira", "Adel", "Sparks", "Lenox", "Ray City", "Moultrie", "Thomasville", "Nashville", "Tifton"].map((n) => ({
        "@type": "City",
        name: n,
        containedInPlace: { "@type": "State", name: "Georgia" },
      })),
      { "@type": "State", name: "Georgia" },
      { "@type": "State", name: "Florida" },
    ],
    address: { "@type": "PostalAddress", addressLocality: "Valdosta", addressRegion: "GA", addressCountry: "US" },
    memberOf: { "@type": "RealEstateAgent", name: "Lock and Key Realty", url: "https://lockandkeyrealty.com/" },
    sameAs: ["https://lockandkeyrealty.com/leyanis/", "https://www.zillow.com/profile/leey63/"],
    priceRange: "$$",
    openingHoursSpecification: { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], opens: "09:00", closes: "19:00" },
  };
}
function residenceLd(p) {
  const offer = { "@type": "Offer", price: p.priceUsd, priceCurrency: "USD", availability: p.status === "for_sale" ? "https://schema.org/InStock" : "https://schema.org/OffMarket" };
  return {
    "@context": "https://schema.org", "@type": "SingleFamilyResidence", name: p.title, description: p.description,
    url: `${SITE_URL}/properties/${p.id}`,
    image: p.images?.length ? p.images : [p.image],
    numberOfRooms: p.beds || undefined, numberOfBathroomsTotal: p.baths || undefined,
    floorSize: p.sqft ? { "@type": "QuantitativeValue", value: p.sqft, unitCode: "SQF" } : undefined,
    yearBuilt: p.yearBuilt || undefined,
    address: { "@type": "PostalAddress", addressLocality: p.city, addressRegion: p.state, postalCode: p.zip, addressCountry: "US" },
    offers: offer, realEstateAgent: { "@id": `${SITE_URL}/#agent` },
  };
}

/* ── Assemble pages ───────────────────────────────────────────────── */
const shell = readFileSync(resolve(DIST, "index.html"), "utf8");

// Strip the original in-<head> JSON-LD (the generic agent block) so we
// don't duplicate; the per-route LD below replaces it.
const baseHeadStripped = shell
  .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "")
  // Remove the SPA's default title/description/canonical so route ones win.
  // Meta tags may be multi-line in index.html.
  .replace(/<title>[\s\S]*?<\/title>/i, "")
  .replace(/<meta\s+name=["']description["'][\s\S]*?>/i, "")
  .replace(/<meta\s+name=["']keywords["'][\s\S]*?>/i, "")
  .replace(/<meta\s+name=["']robots["'][\s\S]*?>/i, "")
  .replace(/<meta\s+property=["']og:title["'][\s\S]*?>/i, "")
  .replace(/<meta\s+property=["']og:description["'][\s\S]*?>/i, "")
  .replace(/<meta\s+property=["']og:url["'][\s\S]*?>/i, "")
  .replace(/<meta\s+property=["']og:image["'][\s\S]*?>/i, "")
  .replace(/<meta\s+property=["']og:locale["'][\s\S]*?>/i, "")
  .replace(/<meta\s+name=["']twitter:title["'][\s\S]*?>/i, "")
  .replace(/<meta\s+name=["']twitter:description["'][\s\S]*?>/i, "")
  .replace(/<meta\s+name=["']twitter:image["'][\s\S]*?>/i, "")
  .replace(/<link\s+rel=["']canonical["'][\s\S]*?>/i, "");

function renderPage({ routeHead, staticBody }) {
  // Inject route head right before </head>, and static body into #root.
  const withHead = baseHeadStripped.replace("</head>", `    ${routeHead}\n  </head>`);
  return withHead.replace(
    /<div id="root"><\/div>/,
    `<div id="root">${STATIC_STYLE}\n${staticBody}</div>`,
  );
}

/* Fallback CSS so the static (pre-hydration) content is presentable
 * if JS fails to load. The SPA's Tailwind overrides these once mounted. */
const STATIC_STYLE = `<style>
  .seo-static{max-width:1120px;margin:0 auto;padding:120px 24px 80px;font-family:Georgia,serif;color:#1c1714;line-height:1.6}
  .seo-static .eyebrow,.seo-static .listing-loc{font-family:system-ui,sans-serif;font-size:11px;letter-spacing:.25em;text-transform:uppercase;color:#c45c26;margin-bottom:12px}
  .seo-static h1{font-size:clamp(2.4rem,6vw,4rem);font-weight:300;line-height:1.05;margin:0 0 16px;letter-spacing:-.02em}
  .seo-static h2{font-size:clamp(1.6rem,3vw,2.2rem);font-weight:300;margin:48px 0 16px}
  .seo-static h3{font-size:1.25rem;font-weight:500;margin:0 0 4px}
  .seo-static .lede{font-size:1.25rem;color:#6b5d52;max-width:42rem;margin:0 0 24px}
  .seo-static p{max-width:42rem;margin:0 0 16px;color:#4a4039}
  .seo-static a{color:#2f7d6b;text-decoration:underline}
  .seo-static .listing-price{font-size:1.5rem;font-weight:600;color:#2f7d6b;margin:6px 0}
  .seo-static .listing-specs{font-size:.85rem;color:#6b5d52}
  .seo-static .listing-office{font-size:.75rem;color:#9b8c80;margin-top:8px;text-transform:uppercase;letter-spacing:.12em}
  .seo-static .listing-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:24px;margin-top:20px}
  .seo-static .listing-card{border:1px solid rgba(28,23,20,.1);border-radius:18px;overflow:hidden;background:#fdfbf7}
  .seo-static .listing-card a{text-decoration:none;color:inherit;display:block}
  .seo-static .listing-img{aspect-ratio:4/3;background-size:cover;background-position:center}
  .seo-static .listing-body{padding:16px 20px 20px}
  .seo-static .area-body p{color:#4a4039}
  .seo-static img{max-width:100%;border-radius:14px;margin:16px 0}
  .seo-static ul.listing-specs-list{list-style:none;padding:0}
</style>`;

const pages = [];
// Home
pages.push({
  file: "index.html",
  head: buildHead({
    title: `${AGENT} | Realtor bilingüe · Sur de Georgia & Florida`,
    description: `${AGENT} — agente de ${BROKERAGE}. Licenciada en Georgia y Florida. Casas en ${AREAS.map((a) => a.city).join(", ")}. ${PHONE_DISPLAY}.`,
    path: "/",
    keywords: ["realtor Valdosta", "realtor Moultrie", "realtor Thomasville", "realtor Tifton", "agente inmobiliario bilingüe", "Lock and Key Realty"],
    jsonLd: [agentLd()],
  }),
  body: homeContent(),
});
// Properties
pages.push({
  file: "properties/index.html",
  head: buildHead({
    title: "Casas en venta · Sur de Georgia & Florida | Leey Hernandez",
    description: "Inventario de casas en venta en Valdosta, Hahira, Adel, Moultrie, Thomasville, Tifton y Norte de Florida con Leey, agente bilingüe de Lock & Key Realty.",
    path: "/properties",
    keywords: ["casas en venta Valdosta", "homes for sale South Georgia", "casas en venta Florida", "MLS Georgia real estate"],
    jsonLd: [agentLd()],
  }),
  body: propertiesContent(),
});
// Property details
for (const p of LISTINGS) {
  pages.push({
    file: `properties/${p.id}/index.html`,
    head: buildHead({
      title: `${p.title} — ${fmtPrice(p.priceUsd)} | Leey Hernandez`,
      description: `${p.tagline} ${[p.neighborhood, p.city, p.state].filter(Boolean).join(", ")}. ${p.description}`,
      path: `/properties/${p.id}`,
      image: p.images?.[0] ?? p.image,
      keywords: [`casas en ${p.city}`, `${p.city} homes for sale`, `${p.type} for sale ${p.state}`],
      jsonLd: [agentLd(), residenceLd(p)],
    }),
    body: propertyContent(p),
  });
}
// Areas
for (const a of AREAS) {
  pages.push({
    file: `areas/${a.slug}/index.html`,
    head: buildHead({
      title: `Realtor en ${a.city}, ${a.state} | Leey Hernandez — ${BROKERAGE}`,
      description: `${a.taglineEs} Casas en venta y asesoría inmobiliaria en ${a.city}, ${a.state} con Leey Hernandez, agente bilingüe licenciada en Georgia y Florida. ${PHONE_DISPLAY}.`,
      path: `/areas/${a.slug}`,
      keywords: [...a.kwEs, "realtor Valdosta", "Lock and Key Realty"],
      jsonLd: [agentLd(), { "@context": "https://schema.org", "@type": "Place", name: `${a.city}, ${a.state}`, address: { "@type": "PostalAddress", addressLocality: a.city, addressRegion: a.state, addressCountry: "US" }, containedInPlace: { "@type": "State", name: a.state === "FL" ? "Florida" : "Georgia" } }],
    }),
    body: areaContent(a),
  });
}

for (const pg of pages) {
  const out = renderPage({ routeHead: pg.head, staticBody: pg.body });
  const full = resolve(DIST, pg.file);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, out);
}

/* 404 page (used by not_found_handling = "404-page") */
const notFound = renderPage({
  routeHead: buildHead({
    title: "Página no encontrada | Leey Hernandez",
    description: "La página que buscas no existe. Volvé al inicio para ver casas en venta.",
    path: "/404",
    noindex: true,
    jsonLd: [agentLd()],
  }),
  staticBody: `<main class="seo-static"><section><h1>404</h1><p>La página que buscás no existe. <a href="/">Volver al inicio</a>.</p></section></main>`,
});
writeFileSync(resolve(DIST, "404.html"), notFound);

/* ── Sitemap (kept in sync with the static pages above) ───────────── */
const urlset = [
  { loc: "/", freq: "weekly", pri: 1.0 },
  { loc: "/properties", freq: "daily", pri: 0.9 },
  ...LISTINGS.map((p) => ({ loc: `/properties/${p.id}`, freq: "daily", pri: 0.8 })),
  ...AREAS.map((a) => ({ loc: `/areas/${a.slug}`, freq: "monthly", pri: 0.7 })),
];
const sm = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlset.map((u) => `  <url>
    <loc>${SITE_URL}${u.loc}</loc>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.pri}</priority>
  </url>`).join("\n")}
</urlset>
`;
writeFileSync(resolve(DIST, "sitemap.xml"), sm);

console.log(`[prerender] wrote ${pages.length} static pages + sitemap.xml`);
