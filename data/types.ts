/** Shared listing types — frontend + sync script contract. */

export type PropertyType =
  | "house"
  | "townhouse"
  | "condo"
  | "land"
  | "multifamily"
  | "commercial";

export type PropertyBadge = "new" | "hot" | "reduced" | "exclusive";

/** MLS / portal status */
export type ListingStatus =
  | "for_sale"
  | "pending"
  | "sold"
  | "coming_soon"
  | "off_market"
  | "unknown";

export interface Property {
  id: string;
  /** Zillow property id when known */
  zpid?: string;
  mlsId?: string;
  status: ListingStatus;
  title: string;
  address?: string;
  city: string;
  neighborhood: string;
  state?: string;
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
  /** Canonical Zillow listing URL */
  zillowUrl?: string;
  /** Listing portal URL when not Zillow */
  sourceUrl?: string;
  sourcePortal?: "zillow" | "realtor" | "mls" | "loopnet" | "manual" | "other";
  daysOnMarket?: number;
  lat?: number;
  lng?: number;
  listedAt?: string;
  updatedAt?: string;
  /** Listing office / brokerage name from feed when known */
  brokerage?: string;
  /** Listing agent name from feed when known */
  listedBy?: string;
}

export interface ListingsFeed {
  version: 1;
  source: "zillow" | "demo" | "manual" | "mixed";
  syncedAt: string | null;
  agent: {
    name: string;
    zillowProfileUrl: string | null;
    phone?: string;
    email?: string;
    brokerage?: string;
  };
  listings: Property[];
}
