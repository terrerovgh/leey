import { useEffect, useState } from "react";
import type { BlogIndex, BlogPost } from "./blog";
import { findPost, publishedPosts } from "./blog";

let cache: BlogIndex | null = null;
let inflight: Promise<BlogIndex | null> | null = null;

async function loadIndex(): Promise<BlogIndex | null> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/data/blog/posts.json", { cache: "no-cache" })
    .then(async (r) => {
      if (!r.ok) return null;
      const data = (await r.json()) as BlogIndex;
      if (!data || !Array.isArray(data.posts)) return null;
      cache = data;
      return data;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useBlogIndex() {
  const [index, setIndex] = useState<BlogIndex | null>(cache);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let alive = true;
    loadIndex().then((data) => {
      if (!alive) return;
      setIndex(data);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  return {
    index,
    loading,
    posts: publishedPosts(index),
  };
}

export function useBlogPost(slug: string | undefined) {
  const { index, loading, posts } = useBlogIndex();
  const post: BlogPost | undefined = slug ? findPost(index, slug) : undefined;
  return { post, loading, posts, index };
}
