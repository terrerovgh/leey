import { useEffect, useState } from "react";
import {
  DEMO_LISTINGS,
  EMPTY_FEED,
  type ListingsFeed,
  type Property,
} from "../data/listings";

const FEED_URL = "/data/listings.json";

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
        const data = (await res.json()) as ListingsFeed;
        if (cancelled) return;
        if (!data?.listings?.length) {
          setFeed({ ...EMPTY_FEED, syncedAt: data?.syncedAt ?? null, source: data?.source ?? "demo" });
        } else {
          setFeed({
            version: 1,
            source: data.source ?? "zillow",
            syncedAt: data.syncedAt ?? null,
            agent: data.agent ?? EMPTY_FEED.agent,
            listings: data.listings as Property[],
          });
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

  return {
    listings: feed.listings.length ? feed.listings : DEMO_LISTINGS,
    feed,
    loading,
    error,
    isLive: feed.source === "zillow" || feed.source === "mixed",
    syncedAt: feed.syncedAt,
  };
}

export function useProperty(id: string | undefined) {
  const { listings, loading, error, isLive, syncedAt } = useListings();
  const property = id ? listings.find((p) => p.id === id || p.zpid === id) : undefined;
  return { property, loading, error, isLive, syncedAt, listings };
}
