import { useEffect, useState } from "react";
import {
  DEMO_LISTINGS,
  EMPTY_FEED,
  type ListingsFeed,
  type Property,
} from "../data/listings";

const FEED_URL = "/data/listings.json";

export type InventoryMode = "agent" | "market" | "mixed" | "demo" | "manual" | "unknown";

/**
 * Loads live inventory from public/data/listings.json (Zillow sync output).
 * Falls back to demo seed if the feed is missing or empty.
 */
export function useListings() {
  const [feed, setFeed] = useState<ListingsFeed>(EMPTY_FEED);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(FEED_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ListingsFeed & {
          meta?: { mode?: string; inventoryKind?: string };
        };
        if (cancelled) return;
        if (!data?.listings?.length) {
          setFeed({
            ...EMPTY_FEED,
            syncedAt: data?.syncedAt ?? null,
            source: data?.source ?? "demo",
            meta: data?.meta,
          } as ListingsFeed);
        } else {
          setFeed({
            version: 1,
            source: data.source ?? "zillow",
            syncedAt: data.syncedAt ?? null,
            agent: data.agent ?? EMPTY_FEED.agent,
            listings: data.listings as Property[],
            meta: data.meta,
          } as ListingsFeed);
        }
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setFeed(EMPTY_FEED);
        setError(e instanceof Error ? e.message : "feed_error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const listings = feed.listings.length ? feed.listings : DEMO_LISTINGS;
  const isLive = feed.source === "zillow" || feed.source === "mixed";
  const inventoryMode = resolveInventoryMode(feed);

  return {
    listings,
    feed,
    loading,
    error,
    isLive,
    syncedAt: feed.syncedAt,
    inventoryMode,
    cities: uniqueCities(listings),
  };
}

export function useProperty(id: string | undefined) {
  const { listings, loading, error, isLive, syncedAt, inventoryMode } = useListings();
  const property = id
    ? listings.find((p) => p.id === id || p.zpid === id || p.mlsId === id)
    : undefined;
  return { property, loading, error, isLive, syncedAt, listings, inventoryMode };
}

function uniqueCities(listings: Property[]) {
  return [...new Set(listings.map((p) => p.city).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function resolveInventoryMode(feed: ListingsFeed & { meta?: any }): InventoryMode {
  if (!feed.listings?.length || feed.source === "demo") return "demo";
  if (feed.source === "manual") return "manual";
  const kind = String(feed.meta?.inventoryKind || "").toLowerCase();
  if (kind === "agent" || kind === "mls") return "agent";
  if (kind === "market") return "market";
  const mode = String(feed.meta?.mode || "").toLowerCase();
  if (mode === "mls") return "agent";
  if (mode === "market" || mode === "hybrid" || mode === "brokerage") return "market";
  if (feed.source === "mixed") return "mixed";
  return "unknown";
}
