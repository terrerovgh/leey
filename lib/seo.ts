/**
 * Central SEO config for every route.
 * Used by:
 *  - useSeo() hook → updates <head> on client-side navigation (SPA)
 *  - scripts/prerender.mjs → emits static <head> + JSON-LD into pre-built HTML
 * Keep every URL absolute and canonical. Phone is the single source of truth
 * from lib/site.ts (currently (404) 403-8306).
 */
import { SITE } from "./site";
import type { Property } from "../data/types";

const U = SITE.url;

export interface SeoConfig {
  path: string;
  title: string;
  description: string;
  /** es | en — controls og:locale + content language emphasis */
  lang: "es" | "en";
  keywords?: string[];
  /** Optional og:image override (property photo, etc.) */
  image?: string;
  /** JSON-LD objects for this route */
  jsonLd?: Record<string, unknown>[];
  /** noindex for thin/duplicate routes */
  noindex?: boolean;
}

const BASE_KEYWORDS = [
  "realtor Valdosta",
  "realtor Moultrie",
  "realtor Thomasville",
  "realtor Tifton",
  "realtor Nashville GA",
  "Hahira homes",
  "Adel GA real estate",
  "Lock and Key Realty",
  "comprar casa sur Georgia",
  "agente inmobiliario bilingüe",
];

export function homeSeo(): SeoConfig {
  return {
    path: "/",
    title: "Leyanis “Leey” Hernandez | Realtor bilingüe · Sur de Georgia & Florida",
    description:
      "Leyanis Hernandez (Leey) — agente de Lock & Key Realty. Licenciada en Georgia y Florida. Casas en Valdosta, Hahira, Moultrie, Thomasville, Tifton, Nashville, Adel, Sparks, Lenox, Ray City y Norte de Florida. (404) 403-8306.",
    lang: "es",
    keywords: BASE_KEYWORDS,
    jsonLd: [realEstateAgentLd()],
  };
}

export function propertiesSeo(): SeoConfig {
  return {
    path: "/properties",
    title: "Casas en venta · Sur de Georgia & Florida | Leey Hernandez",
    description:
      "Inventario de casas en venta en Valdosta, Hahira, Adel, Moultrie, Thomasville, Tifton y Norte de Florida. Filtra por precio, tipo y habitaciones con Leey, agente bilingüe de Lock & Key Realty.",
    lang: "es",
    keywords: [
      "casas en venta Valdosta",
      "homes for sale South Georgia",
      "casas en venta Florida",
      "MLS Georgia real estate",
      ...BASE_KEYWORDS,
    ],
    jsonLd: [realEstateAgentLd(), itemListLd()],
  };
}

export function propertySeo(p: Property): SeoConfig {
  const price = `$${p.priceUsd.toLocaleString("en-US")}`;
  const beds = p.beds ? `${p.beds} bd` : "";
  const baths = p.baths ? `${p.baths} ba` : "";
  const sqft = p.sqft ? `${p.sqft.toLocaleString("en-US")} sqft` : "";
  const specs = [beds, baths, sqft].filter(Boolean).join(" · ");
  const loc = [p.neighborhood, p.city, p.state].filter(Boolean).join(", ");
  return {
    path: `/properties/${p.id}`,
    title: `${p.title} — ${price} | Leey Hernandez`,
    description: `${p.tagline} ${specs}. ${loc}. ${p.description}`,
    lang: "es",
    image: p.images?.[0] ?? p.image,
    keywords: [
      `casas en ${p.city}`,
      `${p.city} homes for sale`,
      `${p.type} for sale ${p.state}`,
      ...BASE_KEYWORDS,
    ],
    jsonLd: [realEstateAgentLd(), residenceLd(p)],
  };
}

export function areaSeo(slug: string, city: string, state: string, tagline: string, keywords: string[]): SeoConfig {
  const isFl = state === "FL";
  return {
    path: `/areas/${slug}`,
    title: `Realtor en ${city}, ${state} | Leey Hernandez — Lock & Key Realty`,
    description: `${tagline} Casas en venta y asesoría inmobiliaria en ${city}, ${state} con Leey Hernandez, agente bilingüe licenciada en Georgia y Florida. (404) 403-8306.`,
    lang: "es",
    keywords: [...keywords, ...BASE_KEYWORDS],
    jsonLd: [realEstateAgentLd(), areaLd(city, state, isFl)],
  };
}

/* ── JSON-LD builders ──────────────────────────────────────────────────── */

export function realEstateAgentLd() {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "@id": `${U}/#agent`,
    name: "Leyanis Hernandez",
    alternateName: ["Leey Hernandez", "Leyanis “Leey” Hernandez"],
    url: `${U}/`,
    image: `${U}/assets/leey-portrait.jpg`,
    logo: `${U}/assets/lock-and-key-logo.png`,
    telephone: SITE.agent.phoneTel,
    email: SITE.agent.email,
    description:
      "Real estate agent licensed in Georgia and Florida with Lock & Key Realty. Serving Valdosta, Hahira, Adel, Sparks, Lenox, Ray City, Moultrie, Thomasville, Nashville, Tifton and North Florida.",
    knowsLanguage: ["es", "en"],
    areaServed: [
      "Valdosta", "Hahira", "Adel", "Sparks", "Lenox", "Ray City",
      "Moultrie", "Thomasville", "Nashville", "Tifton", "Florida", "Georgia",
    ].map((n) => ({ "@type": "City", name: n })),
    address: {
      "@type": "PostalAddress",
      addressLocality: "Valdosta",
      addressRegion: "GA",
      addressCountry: "US",
    },
    memberOf: {
      "@type": "RealEstateAgent",
      name: "Lock and Key Realty",
      url: "https://lockandkeyrealty.com/",
    },
    sameAs: ["https://lockandkeyrealty.com/leyanis/"],
    priceRange: "$$",
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      opens: "09:00",
      closes: "19:00",
    },
  };
}

export function itemListLd() {
  // Lightweight: full per-item LD lives on each property page.
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Homes for sale — South Georgia & Florida",
    url: `${U}/properties`,
  };
}

export function residenceLd(p: Property) {
  const offer: Record<string, unknown> = {
    "@type": "Offer",
    price: p.priceUsd,
    priceCurrency: "USD",
    availability:
      p.status === "for_sale"
        ? "https://schema.org/InStock"
        : "https://schema.org/OffMarket",
  };
  if (p.mlsId) (offer as any).sku = `MLS-${p.mlsId}`;
  return {
    "@context": "https://schema.org",
    "@type": "Residence",
    name: p.title,
    description: p.description,
    url: `${U}/properties/${p.id}`,
    image: p.images?.length ? p.images : [p.image],
    numberOfRooms: p.beds || undefined,
    numberOfBathroomsTotal: p.baths || undefined,
    floorSize: p.sqft ? { "@type": "QuantitativeValue", value: p.sqft, unitCode: "SQF" } : undefined,
    yearBuilt: p.yearBuilt || undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: p.city,
      addressRegion: p.state,
      postalCode: p.zip,
      addressCountry: "US",
    },
    offers: offer,
    realEstateAgent: { "@id": `${U}/#agent` },
  };
}

export function areaLd(city: string, state: string, isFl: boolean) {
  return {
    "@context": "https://schema.org",
    "@type": "Place",
    name: `${city}, ${state}`,
    address: {
      "@type": "PostalAddress",
      addressLocality: city,
      addressRegion: state,
      addressCountry: "US",
    },
    containedInPlace: { "@type": "State", name: isFl ? "Florida" : "Georgia" },
  };
}
