/**
 * Central SEO config for every route.
 * Used by:
 *  - useSeo() hook → updates <head> on client-side navigation (SPA)
 *  - scripts/prerender.mjs → emits static <head> + JSON-LD into pre-built HTML
 * Keep every URL absolute and canonical. Phone is the single source of truth
 * from lib/site.ts.
 */
import { SITE } from "./site";
import type { Property } from "../data/types";

const U = SITE.url;
const PHONE = SITE.agent.phoneDisplay;

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
  "realtor Valdosta GA",
  "realtor Moultrie GA",
  "realtor Thomasville GA",
  "realtor Tifton GA",
  "realtor Nashville GA",
  "Hahira homes for sale",
  "Adel GA real estate",
  "South Georgia realtor",
  "Lock and Key Realty",
  "Leyanis Hernandez realtor",
  "Leey Hernandez realtor",
  "comprar casa sur Georgia",
  "vender casa Valdosta",
  "agente inmobiliario bilingüe Valdosta",
  "bilingual realtor South Georgia",
  "Georgia Florida real estate agent",
];

function clip(s: string, n = 158) {
  const t = String(s || "")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length <= n) return t;
  return t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…";
}

export function homeSeo(lang: "es" | "en" = "es"): SeoConfig {
  if (lang === "en") {
    return {
      path: "/",
      title: "Leey Hernandez | Bilingual Realtor in Valdosta & South Georgia",
      description: clip(
        `Buy or sell with Leyanis “Leey” Hernandez of Lock & Key Realty. Licensed in Georgia and Florida. Spanish and English help for homes in Valdosta, Hahira, Adel, Moultrie, Thomasville, Tifton, and North Florida. Call ${PHONE}.`,
      ),
      lang: "en",
      keywords: BASE_KEYWORDS,
      image: `${U}/assets/leey-portrait.jpg`,
      jsonLd: [realEstateAgentLd(), websiteLd(), breadcrumbLd([{ name: "Home", path: "/" }])],
    };
  }
  return {
    path: "/",
    title: "Leey Hernandez | Realtor bilingüe en Valdosta y el sur de Georgia",
    description: clip(
      `Compra o vende con Leyanis “Leey” Hernandez de Lock & Key Realty. Licenciada en Georgia y Florida. Atención en español e inglés en Valdosta, Hahira, Adel, Moultrie, Thomasville, Tifton y el norte de Florida. Llama al ${PHONE}.`,
    ),
    lang: "es",
    keywords: BASE_KEYWORDS,
    image: `${U}/assets/leey-portrait.jpg`,
    jsonLd: [realEstateAgentLd(), websiteLd(), breadcrumbLd([{ name: "Inicio", path: "/" }])],
  };
}

export function propertiesSeo(
  listings: Property[] = [],
  lang: "es" | "en" = "es",
): SeoConfig {
  const cities = [
    ...new Set(listings.map((p) => p.city).filter(Boolean)),
  ].slice(0, 8);
  const cityHint = cities.length
    ? cities.join(", ")
    : "Valdosta, Hahira, Adel, Moultrie, Thomasville, Tifton";

  if (lang === "en") {
    return {
      path: "/properties",
      title: "Homes for sale in South Georgia & Florida | Leey Hernandez",
      description: clip(
        `Browse Lock & Key Realty homes for sale in ${cityHint}. Filter by price, beds, and type. Work with Leey — bilingual agent licensed in Georgia and Florida. ${PHONE}.`,
      ),
      lang: "en",
      keywords: [
        "homes for sale Valdosta GA",
        "homes for sale South Georgia",
        "casas en venta Florida",
        "MLS South Georgia",
        ...BASE_KEYWORDS,
      ],
      image: listings[0]?.images?.[0] || listings[0]?.image || `${U}/assets/leey-portrait.jpg`,
      jsonLd: [
        realEstateAgentLd(),
        itemListLd(listings),
        breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Listings", path: "/properties" },
        ]),
      ],
    };
  }

  return {
    path: "/properties",
    title: "Casas en venta en el sur de Georgia y Florida | Leey Hernandez",
    description: clip(
      `Casas de Lock & Key Realty en venta en ${cityHint}. Filtra por precio, habitaciones y tipo. Trabaja con Leey, agente bilingüe licenciada en Georgia y Florida. ${PHONE}.`,
    ),
    lang: "es",
    keywords: [
      "casas en venta Valdosta",
      "casas en venta sur Georgia",
      "homes for sale South Georgia",
      "MLS Georgia real estate",
      ...BASE_KEYWORDS,
    ],
    image: listings[0]?.images?.[0] || listings[0]?.image || `${U}/assets/leey-portrait.jpg`,
    jsonLd: [
      realEstateAgentLd(),
      itemListLd(listings),
      breadcrumbLd([
        { name: "Inicio", path: "/" },
        { name: "Propiedades", path: "/properties" },
      ]),
    ],
  };
}

export function propertySeo(p: Property, lang: "es" | "en" = "es"): SeoConfig {
  const price = `$${p.priceUsd.toLocaleString("en-US")}`;
  const beds = p.beds ? `${p.beds} bd` : "";
  const baths = p.baths ? `${p.baths} ba` : "";
  const sqft = p.sqft ? `${p.sqft.toLocaleString("en-US")} sqft` : "";
  const specs = [beds, baths, sqft].filter(Boolean).join(" · ");
  const loc = [p.address || p.title, p.city, p.state, p.zip].filter(Boolean).join(", ");
  const descBase =
    lang === "en"
      ? `${p.title} — ${price}. ${specs}. ${loc}. ${p.tagline || p.description || ""} Work with Leey Hernandez, bilingual realtor, Lock & Key Realty. ${PHONE}.`
      : `${p.title} — ${price}. ${specs}. ${loc}. ${p.tagline || p.description || ""} Con Leey Hernandez, realtor bilingüe de Lock & Key Realty. ${PHONE}.`;

  return {
    path: `/properties/${p.id}`,
    title: `${p.title} — ${price} | Leey Hernandez`,
    description: clip(descBase),
    lang,
    image: p.images?.[0] ?? p.image,
    keywords: [
      `casas en ${p.city}`,
      `${p.city} homes for sale`,
      `${p.type} for sale ${p.state || "GA"}`,
      p.zip ? `${p.zip} real estate` : "",
      ...BASE_KEYWORDS,
    ].filter(Boolean),
    jsonLd: [
      realEstateAgentLd(),
      residenceLd(p),
      breadcrumbLd([
        { name: lang === "en" ? "Home" : "Inicio", path: "/" },
        { name: lang === "en" ? "Listings" : "Propiedades", path: "/properties" },
        { name: p.title, path: `/properties/${p.id}` },
      ]),
    ],
  };
}

export function areaSeo(
  slug: string,
  city: string,
  state: string,
  tagline: string,
  keywords: string[],
  lang: "es" | "en" = "es",
): SeoConfig {
  const isFl = state === "FL";
  if (lang === "en") {
    return {
      path: `/areas/${slug}`,
      title: `Realtor in ${city}, ${state} | Leey Hernandez — Lock & Key Realty`,
      description: clip(
        `${tagline} Buy or sell in ${city}, ${state} with Leey Hernandez — bilingual agent licensed in Georgia and Florida. ${PHONE}.`,
      ),
      lang: "en",
      keywords: [...keywords, ...BASE_KEYWORDS],
      image: `${U}/assets/leey-portrait.jpg`,
      jsonLd: [
        realEstateAgentLd(),
        areaLd(city, state, isFl),
        breadcrumbLd([
          { name: "Home", path: "/" },
          { name: city, path: `/areas/${slug}` },
        ]),
      ],
    };
  }
  return {
    path: `/areas/${slug}`,
    title: `Realtor en ${city}, ${state} | Leey Hernandez — Lock & Key Realty`,
    description: clip(
      `${tagline} Compra o vende en ${city}, ${state} con Leey Hernandez, agente bilingüe licenciada en Georgia y Florida. ${PHONE}.`,
    ),
    lang: "es",
    keywords: [...keywords, ...BASE_KEYWORDS],
    image: `${U}/assets/leey-portrait.jpg`,
    jsonLd: [
      realEstateAgentLd(),
      areaLd(city, state, isFl),
      breadcrumbLd([
        { name: "Inicio", path: "/" },
        { name: city, path: `/areas/${slug}` },
      ]),
    ],
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
      "Leyanis “Leey” Hernandez is a bilingual real estate agent with Lock & Key Realty, licensed in Georgia and Florida. She helps families buy and sell homes in Valdosta, Hahira, Adel, Sparks, Lenox, Ray City, Moultrie, Thomasville, Nashville, Tifton, and North Florida — in Spanish or English.",
    knowsLanguage: ["es", "en"],
    areaServed: [
      "Valdosta",
      "Hahira",
      "Adel",
      "Sparks",
      "Lenox",
      "Ray City",
      "Moultrie",
      "Thomasville",
      "Nashville",
      "Tifton",
    ].map((n) => ({
      "@type": "City",
      name: n,
      containedInPlace: { "@type": "State", name: "Georgia" },
    })).concat([
      { "@type": "State", name: "Florida" } as any,
      { "@type": "State", name: "Georgia" } as any,
    ]),
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
    sameAs: [
      "https://lockandkeyrealty.com/leyanis/",
      SITE.zillow.profileUrl,
    ],
    priceRange: "$$",
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ],
      opens: "09:00",
      closes: "19:00",
    },
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${U}/#website`,
    url: `${U}/`,
    name: "Leey Hernandez Realtor — South Georgia & Florida",
    description:
      "Bilingual realtor Leyanis “Leey” Hernandez of Lock & Key Realty. Homes for sale and local guidance across South Georgia and North Florida.",
    publisher: { "@id": `${U}/#agent` },
    inLanguage: ["es-US", "en-US"],
    potentialAction: {
      "@type": "SearchAction",
      target: `${U}/properties?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${U}${it.path === "/" ? "/" : it.path}`,
    })),
  };
}

export function itemListLd(listings: Property[] = []) {
  const active = listings
    .filter((p) => p.status === "for_sale" || p.status === "pending")
    .slice(0, 24);
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Homes for sale — South Georgia & Florida",
    url: `${U}/properties`,
    numberOfItems: active.length || undefined,
    itemListElement: active.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${U}/properties/${p.id}`,
      name: p.title,
      image: p.images?.[0] || p.image,
    })),
  };
}

export function residenceLd(p: Property) {
  const offer: Record<string, unknown> = {
    "@type": "Offer",
    price: p.priceUsd,
    priceCurrency: "USD",
    url: `${U}/properties/${p.id}`,
    availability:
      p.status === "for_sale"
        ? "https://schema.org/InStock"
        : p.status === "pending"
          ? "https://schema.org/LimitedAvailability"
          : "https://schema.org/OffMarket",
    seller: { "@id": `${U}/#agent` },
  };
  if (p.mlsId) (offer as any).sku = `MLS-${p.mlsId}`;

  const street = p.address || p.title;
  return {
    "@context": "https://schema.org",
    "@type": "SingleFamilyResidence",
    name: p.title,
    description: clip(p.description || p.tagline || p.title, 300),
    url: `${U}/properties/${p.id}`,
    image: p.images?.length ? p.images : [p.image],
    numberOfRooms: p.beds || undefined,
    numberOfBedrooms: p.beds || undefined,
    numberOfBathroomsTotal: p.baths || undefined,
    floorSize: p.sqft
      ? { "@type": "QuantitativeValue", value: p.sqft, unitCode: "SQF" }
      : undefined,
    yearBuilt: p.yearBuilt || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: street,
      addressLocality: p.city,
      addressRegion: p.state || "GA",
      postalCode: p.zip || undefined,
      addressCountry: "US",
    },
    geo:
      p.lat && p.lng
        ? { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lng }
        : undefined,
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
    containedInPlace: {
      "@type": "State",
      name: isFl ? "Florida" : "Georgia",
    },
  };
}
