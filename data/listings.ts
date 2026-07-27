/**
 * Listings data layer.
 * Live inventory lives in public/data/listings.json (written by scripts/sync-zillow.mjs).
 * Demo seed is the fallback when the feed is empty or fetch fails.
 */
import type { ListingsFeed, Property, PropertyType, PropertyBadge } from "./types";

export type { Property, PropertyType, PropertyBadge, ListingsFeed, ListingStatus } from "./types";

/** Demo South Georgia inventory — used until Zillow sync succeeds. */
export const DEMO_LISTINGS: Property[] = [
  {
    id: "VLD-N-014",
    status: "for_sale",
    title: "North Valdosta Brick Ranch",
    city: "Valdosta",
    neighborhood: "Northside",
    state: "GA",
    zip: "31602",
    type: "house",
    beds: 3,
    baths: 2,
    sqft: 1680,
    lotSizeSqft: 17424,
    yearBuilt: 1998,
    priceUsd: 239_000,
    image:
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1600&q=80",
    images: [
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1800&q=80",
      "https://images.unsplash.com/photo-1600585154363-67eb9e2e2099?auto=format&fit=crop&w=1800&q=80",
      "https://images.unsplash.com/photo-1600210492493-0946911123ea?auto=format&fit=crop&w=1800&q=80",
    ],
    badge: "new",
    tagline: "Quiet cul-de-sac, updated kitchen, fenced yard.",
    description:
      "Brick ranch with open living, new HVAC (2023), and a workshop out back. Minutes from Valdosta State and Northside shops.",
  },
  {
    id: "HAH-W-008",
    status: "for_sale",
    title: "Hahira Family Home",
    city: "Hahira",
    neighborhood: "West Hahira",
    state: "GA",
    zip: "31632",
    type: "house",
    beds: 4,
    baths: 2,
    sqft: 2100,
    lotSizeSqft: 26136,
    yearBuilt: 2006,
    priceUsd: 289_000,
    image:
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80",
    images: [
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1800&q=80",
      "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1800&q=80",
    ],
    badge: "hot",
    tagline: "Half-acre lot, side-entry garage, strong schools.",
    description:
      "Spacious 4-bed in Hahira with covered porch and room for a garden. Easy drive to Valdosta employment centers.",
  },
  {
    id: "ADL-M-021",
    status: "for_sale",
    title: "Adel Craftsman",
    city: "Adel",
    neighborhood: "Downtown fringe",
    state: "GA",
    zip: "31620",
    type: "house",
    beds: 3,
    baths: 2,
    sqft: 1750,
    yearBuilt: 2012,
    priceUsd: 224_900,
    image:
      "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1600&q=80",
    images: [
      "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1800&q=80",
    ],
    tagline: "Front porch, metal accents, walkable to town.",
    description: "Charming craftsman-inspired home near downtown Adel shops and parks.",
  },
  {
    id: "MOU-E-011",
    status: "pending",
    title: "Moultrie Acreage Home",
    city: "Moultrie",
    neighborhood: "East Colquitt",
    state: "GA",
    zip: "31768",
    type: "house",
    beds: 3,
    baths: 2,
    sqft: 1900,
    lotSizeSqft: 87120,
    yearBuilt: 1995,
    priceUsd: 275_000,
    image:
      "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?auto=format&fit=crop&w=1600&q=80",
    images: [
      "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?auto=format&fit=crop&w=1800&q=80",
    ],
    badge: "exclusive",
    tagline: "Two acres, metal roof, workshop.",
    description:
      "Country setting with room for animals or a garden. Solid bones and a deep porch.",
  },
  {
    id: "TVL-S-004",
    status: "for_sale",
    title: "Thomasville Bungalow",
    city: "Thomasville",
    neighborhood: "Historic district",
    state: "GA",
    zip: "31792",
    type: "house",
    beds: 3,
    baths: 2,
    sqft: 1620,
    yearBuilt: 1938,
    priceUsd: 259_000,
    image:
      "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?auto=format&fit=crop&w=1600&q=80",
    images: [
      "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?auto=format&fit=crop&w=1800&q=80",
    ],
    badge: "reduced",
    tagline: "Hardwood floors, oak shade, walkable streets.",
    description:
      "Classic Thomasville bungalow with character details and a manageable lot near downtown.",
  },
  {
    id: "TFT-N-019",
    status: "for_sale",
    title: "Tifton Ranch",
    city: "Tifton",
    neighborhood: "Northside",
    state: "GA",
    zip: "31794",
    type: "house",
    beds: 4,
    baths: 2.5,
    sqft: 2200,
    yearBuilt: 2010,
    priceUsd: 312_000,
    image:
      "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?auto=format&fit=crop&w=1600&q=80",
    images: [
      "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?auto=format&fit=crop&w=1800&q=80",
    ],
    tagline: "Open plan, screened porch, quiet street.",
    description: "Modern ranch near schools and shopping. Move-in ready.",
  },
];

export const EMPTY_FEED: ListingsFeed = {
  version: 1,
  source: "demo",
  syncedAt: null,
  agent: {
    name: "Leyanis Hernandez",
    zillowProfileUrl: "https://www.zillow.com/profile/leey63/",
    phone: "(229) 890-8062",
    email: "leey@lockandkeyrealty.com",
    brokerage: "Lock & Key Realty",
  },
  listings: DEMO_LISTINGS,
};

/** @deprecated use useListings() — kept for sync imports during migration */
export const listings = DEMO_LISTINGS;
