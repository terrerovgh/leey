export type PropertyType = "house" | "townhouse" | "condo" | "land" | "multifamily" | "commercial";
export type PropertyBadge = "new" | "hot" | "reduced" | "exclusive";

export interface Property {
  id: string;
  title: string;
  city: string;
  neighborhood: string;
  zip: string;
  type: PropertyType;
  beds: number;
  baths: number;
  sqft: number;
  lotSizeSqft?: number;
  yearBuilt: number;
  hoaMonthly?: number;
  priceUsd: number;
  image: string;
  images: string[];
  badge?: PropertyBadge;
  tagline: string;
  description: string;
}

/** Sample South Georgia / North Florida inventory (demo — replace with live MLS). */
export const listings: Property[] = [
  {
    id: "VLD-N-014",
    title: "North Valdosta Brick Ranch",
    city: "Valdosta",
    neighborhood: "Northside",
    zip: "31602",
    type: "house",
    beds: 3,
    baths: 2,
    sqft: 1680,
    lotSizeSqft: 17424,
    yearBuilt: 1998,
    priceUsd: 239_000,
    image: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1600&q=80",
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
    title: "Hahira Family Home",
    city: "Hahira",
    neighborhood: "West Hahira",
    zip: "31632",
    type: "house",
    beds: 4,
    baths: 2,
    sqft: 2100,
    lotSizeSqft: 26136,
    yearBuilt: 2006,
    priceUsd: 289_000,
    image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80",
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
    title: "Adel Craftsman",
    city: "Adel",
    neighborhood: "Downtown fringe",
    zip: "31620",
    type: "house",
    beds: 3,
    baths: 2,
    sqft: 1540,
    lotSizeSqft: 13068,
    yearBuilt: 2012,
    priceUsd: 215_000,
    image: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1600&q=80",
    images: [
      "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1800&q=80",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1800&q=80",
    ],
    tagline: "Cook County value — move-in ready.",
    description:
      "Craftsman details, LVP floors, and a bright primary suite. Walkable to Adel’s main corridor.",
  },
  {
    id: "SPK-R-003",
    title: "Sparks Starter Ranch",
    city: "Sparks",
    neighborhood: "Sparks proper",
    zip: "31647",
    type: "house",
    beds: 3,
    baths: 1,
    sqft: 1180,
    lotSizeSqft: 10890,
    yearBuilt: 1974,
    priceUsd: 149_000,
    image: "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?auto=format&fit=crop&w=1600&q=80",
    images: [
      "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?auto=format&fit=crop&w=1800&q=80",
    ],
    badge: "reduced",
    tagline: "Affordable entry, solid bones, great flip or first home.",
    description:
      "Classic ranch with carport and mature trees. Ideal for first-time buyers or investors who want sweat equity.",
  },
  {
    id: "LNX-C-011",
    title: "Lenox Country Parcel Home",
    city: "Lenox",
    neighborhood: "County road",
    zip: "31637",
    type: "house",
    beds: 3,
    baths: 2,
    sqft: 1760,
    lotSizeSqft: 87120,
    yearBuilt: 1991,
    priceUsd: 259_000,
    image: "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1600&q=80",
    images: [
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1800&q=80",
      "https://images.unsplash.com/photo-1600585154084-4e5fe7c39198?auto=format&fit=crop&w=1800&q=80",
    ],
    badge: "exclusive",
    tagline: "Two acres, privacy, I-75 access.",
    description:
      "Country living without isolation. Metal roof, large workshop, and room for animals or garden beds.",
  },
  {
    id: "RAY-B-006",
    title: "Ray City Bungalow",
    city: "Ray City",
    neighborhood: "In-town",
    zip: "31645",
    type: "house",
    beds: 2,
    baths: 1,
    sqft: 980,
    lotSizeSqft: 8712,
    yearBuilt: 1952,
    priceUsd: 129_000,
    image: "https://images.unsplash.com/photo-1597047084897-51e81819a499?auto=format&fit=crop&w=1600&q=80",
    images: [
      "https://images.unsplash.com/photo-1597047084897-51e81819a499?auto=format&fit=crop&w=1800&q=80",
    ],
    tagline: "Charming bungalow, Berrien County taxes.",
    description:
      "Hardwoods under carpet (per seller), front porch, and walkable small-town streets.",
  },
  {
    id: "VLD-S-019",
    title: "Southside Valdosta Duplex",
    city: "Valdosta",
    neighborhood: "Southside",
    zip: "31601",
    type: "multifamily",
    beds: 4,
    baths: 2,
    sqft: 1920,
    yearBuilt: 1988,
    priceUsd: 275_000,
    image: "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?auto=format&fit=crop&w=1600&q=80",
    images: [
      "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?auto=format&fit=crop&w=1800&q=80",
    ],
    badge: "hot",
    tagline: "2×2 duplex — live in one, rent the other.",
    description:
      "Separate meters, recent roof on unit B. Strong rental demand near employers and medical corridor.",
  },
  {
    id: "HAH-N-002",
    title: "Hahira New Build",
    city: "Hahira",
    neighborhood: "New subdivision",
    zip: "31632",
    type: "house",
    beds: 4,
    baths: 3,
    sqft: 2280,
    lotSizeSqft: 15246,
    yearBuilt: 2024,
    priceUsd: 349_000,
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80",
    images: [
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=80",
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1800&q=80",
    ],
    badge: "new",
    tagline: "Builder warranty, open plan, primary on main.",
    description:
      "Still under warranty. Quartz counters, spray foam in attic, smart thermostat ready.",
  },
  {
    id: "NFL-L-007",
    title: "North Florida Lot",
    city: "Jennings",
    neighborhood: "Hamilton County, FL",
    zip: "32053",
    type: "land",
    beds: 0,
    baths: 0,
    sqft: 0,
    lotSizeSqft: 87120,
    yearBuilt: 0,
    priceUsd: 68_000,
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=80",
    images: [
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1800&q=80",
    ],
    tagline: "2 acres in Florida — build your plan.",
    description:
      "Cleared frontage, survey available. Cross-border opportunity with a GA/FL licensed agent.",
  },
  {
    id: "ADL-T-015",
    title: "Adel Townhome",
    city: "Adel",
    neighborhood: "East Adel",
    zip: "31620",
    type: "townhouse",
    beds: 2,
    baths: 2,
    sqft: 1240,
    yearBuilt: 2009,
    hoaMonthly: 95,
    priceUsd: 165_000,
    image: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1600&q=80",
    images: [
      "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1800&q=80",
    ],
    tagline: "Low maintenance, attached garage.",
    description:
      "End unit with patio. Ideal for downsizers or traveling professionals.",
  },
  {
    id: "VLD-M-030",
    title: "Valdosta Mid-Century",
    city: "Valdosta",
    neighborhood: "Country Club area",
    zip: "31602",
    type: "house",
    beds: 3,
    baths: 2,
    sqft: 1890,
    lotSizeSqft: 18700,
    yearBuilt: 1964,
    priceUsd: 265_000,
    image: "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?auto=format&fit=crop&w=1600&q=80",
    images: [
      "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?auto=format&fit=crop&w=1800&q=80",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1800&q=80",
    ],
    tagline: "Character home near golf & parks.",
    description:
      "Original hardwoods, large windows, and a sunroom addition. Remodel-friendly layout.",
  },
  {
    id: "RAY-A-004",
    title: "Ray City Acreage",
    city: "Ray City",
    neighborhood: "County",
    zip: "31645",
    type: "land",
    beds: 0,
    baths: 0,
    sqft: 0,
    lotSizeSqft: 217_800,
    yearBuilt: 0,
    priceUsd: 95_000,
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=80",
    images: [
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1800&q=80",
    ],
    badge: "exclusive",
    tagline: "5 acres — barn potential, road frontage.",
    description:
      "Level acreage with mixed pines. Bring your builder or keep as long-term hold.",
  },
];

export const cityOptions = (): string[] =>
  Array.from(new Set(listings.map((l) => l.city))).sort();
