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
  /** Listing agent direct phone (public MLS) when known */
  listedByPhone?: string;
  /** Public GAMLS / portal profile for the listing agent */
  listedByProfileUrl?: string;
  /** Listing office phone when known */
  officePhone?: string;
}

export interface ListingsFeedMeta {
  mode?: string;
  inventoryKind?: "agent" | "market" | "mixed" | "demo" | "manual";
  zillowHost?: string;
  realtorHost?: string;
  locations?: string[];
  mlsIds?: string[];
  manualPath?: string;
  sourcesUsed?: string[];
  brokerageFilter?: string[];
  preserved?: boolean;
  preserveReason?: string;
  attemptedAt?: string;
  note?: string;
  enriched?: number;
  [key: string]: unknown;
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
  meta?: ListingsFeedMeta;
}
