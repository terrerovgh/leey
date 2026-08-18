/** Client for Leey Blog Studio API (same-origin). */

export type StudioFigure = {
  src: string;
  altEs: string;
  altEn: string;
  captionEs?: string;
  captionEn?: string;
  kind?: "photo" | "infographic" | "chart";
};

export type StudioPost = {
  slug: string;
  date: string;
  updatedAt?: string;
  category: string;
  readMinutes: number;
  cover: StudioFigure;
  figures?: StudioFigure[];
  tags: string[];
  areas?: string[];
  titleEs: string;
  titleEn: string;
  excerptEs: string;
  excerptEn: string;
  bodyEs: string;
  bodyEn: string;
  seoTitleEs?: string;
  seoTitleEn?: string;
  seoDescriptionEs?: string;
  seoDescriptionEn?: string;
  draft?: boolean;
  editedBy?: string;
};

export type MediaItem = {
  key: string;
  src: string;
  contentType: string;
  size: number;
  name: string;
  uploadedAt: string;
  uploadedBy?: string;
};

async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error || `http_${res.status}`);
    (err as Error & { status?: number; data?: unknown }).status = res.status;
    (err as Error & { data?: unknown }).data = data;
    throw err;
  }
  return data as T;
}

export function requestMagicLink(email: string) {
  return api<{
    ok: boolean;
    message?: string;
    emailed?: boolean;
    devLink?: string;
    warning?: string;
    throttled?: boolean;
  }>("/api/blog/auth/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function verifyMagicToken(token: string) {
  return api<{ ok: boolean; email: string }>("/api/blog/auth/verify", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function logoutStudio() {
  return api<{ ok: boolean }>("/api/blog/auth/logout", { method: "POST" });
}

export function meStudio() {
  return api<{ authenticated: boolean; email?: string }>("/api/blog/auth/me");
}

export function listStudioPosts() {
  return api<{ posts: StudioPost[]; updatedAt: string }>("/api/blog/posts");
}

export function getStudioPost(slug: string) {
  return api<{ post: StudioPost }>(`/api/blog/posts/${encodeURIComponent(slug)}`);
}

export function saveStudioPost(post: StudioPost, isNew: boolean) {
  if (isNew) {
    return api<{ ok: boolean; post: StudioPost }>("/api/blog/posts", {
      method: "POST",
      body: JSON.stringify({ post }),
    });
  }
  return api<{ ok: boolean; post: StudioPost }>(`/api/blog/posts/${encodeURIComponent(post.slug)}`, {
    method: "PUT",
    body: JSON.stringify({ post }),
  });
}

export function deleteStudioPost(slug: string) {
  return api<{ ok: boolean }>(`/api/blog/posts/${encodeURIComponent(slug)}`, {
    method: "DELETE",
  });
}

export function listMedia() {
  return api<{ items: MediaItem[] }>("/api/blog/media");
}

export async function uploadMedia(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return api<{ ok: boolean; item: MediaItem }>("/api/blog/media", {
    method: "POST",
    body: fd,
  });
}

export function deleteMedia(key: string) {
  return api<{ ok: boolean }>(`/api/blog/media/${encodeURIComponent(key)}`, {
    method: "DELETE",
  });
}

export function seedStudio(force = false) {
  return api<{ ok: boolean; posts?: number; skipped?: boolean }>("/api/blog/seed", {
    method: "POST",
    body: JSON.stringify({ force }),
  });
}

export const CATEGORIES = [
  "buying",
  "selling",
  "remodel",
  "decor",
  "neighborhoods",
  "market",
  "first_home",
] as const;

export function emptyPost(): StudioPost {
  const today = new Date().toISOString().slice(0, 10);
  return {
    slug: "",
    date: today,
    category: "market",
    readMinutes: 5,
    cover: { src: "", altEs: "", altEn: "", kind: "photo" },
    figures: [],
    tags: [],
    areas: [],
    titleEs: "",
    titleEn: "",
    excerptEs: "",
    excerptEn: "",
    bodyEs: "",
    bodyEn: "",
    draft: true,
  };
}
