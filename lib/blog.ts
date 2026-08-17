import type { BlogCategory, BlogIndex, BlogPost } from "../data/blog/types";

export type { BlogCategory, BlogIndex, BlogPost };

const CATEGORY_LABELS_ES: Record<BlogCategory, string> = {
  buying: "Comprar",
  selling: "Vender",
  remodel: "Remodelar",
  decor: "Decoración",
  neighborhoods: "Zonas",
  market: "Mercado",
  first_home: "Primera casa",
};

const CATEGORY_LABELS_EN: Record<BlogCategory, string> = {
  buying: "Buying",
  selling: "Selling",
  remodel: "Remodel",
  decor: "Decor",
  neighborhoods: "Neighborhoods",
  market: "Market",
  first_home: "First home",
};

export function categoryLabel(cat: BlogCategory, lang: "es" | "en") {
  return lang === "es" ? CATEGORY_LABELS_ES[cat] : CATEGORY_LABELS_EN[cat];
}

export function publishedPosts(index: BlogIndex | null | undefined): BlogPost[] {
  const list = index?.posts ?? [];
  return list
    .filter((p) => !p.draft)
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function findPost(index: BlogIndex | null | undefined, slug: string) {
  return publishedPosts(index).find((p) => p.slug === slug);
}

export function formatBlogDate(iso: string, lang: "es" | "en") {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === "es" ? "es-US" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Very small markdown-ish renderer: paragraphs, **bold**, [label](url), {{figure:n}} */
export type BodyBlock =
  | { type: "p"; html: string }
  | { type: "h"; text: string }
  | { type: "figure"; index: number };

export function parseBody(body: string): BodyBlock[] {
  const chunks = String(body || "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: BodyBlock[] = [];
  for (const chunk of chunks) {
    const fig = chunk.match(/^\{\{figure:(\d+)\}\}$/);
    if (fig) {
      out.push({ type: "figure", index: Number(fig[1]) });
      continue;
    }
    if (chunk.startsWith("**") && chunk.endsWith("**") && !chunk.slice(2, -2).includes("**")) {
      out.push({ type: "h", text: chunk.slice(2, -2) });
      continue;
    }
    // heading-like lines wrapped in **text** mid paragraph handled below
    if (/^\*\*[^*]+\*\*$/.test(chunk)) {
      out.push({ type: "h", text: chunk.replace(/\*/g, "") });
      continue;
    }
    out.push({ type: "p", html: inlineFormat(chunk) });
  }
  return out;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineFormat(s: string) {
  let t = escapeHtml(s);
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+|\/[^)]+)\)/g, '<a href="$2" class="blog-link">$1<\/a>');
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\n/g, "<br />");
  return t;
}
