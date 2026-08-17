import { useEffect } from "react";
import type { SeoConfig } from "./seo";
import { SITE } from "./site";

/**
 * Applies SEO <head> tags on client-side route changes.
 * The pre-rendered static HTML already has correct tags for the initial load;
 * this keeps them right when the SPA navigates without a full reload.
 */
export function useSeo(cfg: SeoConfig) {
  const keywords = (cfg.keywords ?? []).join(", ");
  const jsonLdKey = JSON.stringify(cfg.jsonLd ?? []);
  const imageAbs = absoluteUrl(cfg.image);

  useEffect(() => {
    const canonical = `${SITE.url}${cfg.path === "/" ? "/" : cfg.path}`;
    setMeta("description", cfg.description);
    setMeta("keywords", keywords);
    setMeta(
      "robots",
      cfg.noindex
        ? "noindex, nofollow"
        : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
    );
    setLink("canonical", canonical);
    setMetaProp("og:title", cfg.title);
    setMetaProp("og:description", cfg.description);
    setMetaProp("og:url", canonical);
    setMetaProp("og:type", cfg.path.startsWith("/properties/") ? "article" : "website");
    setMetaProp("og:image", imageAbs);
    setMetaProp("og:locale", cfg.lang === "es" ? "es_US" : "en_US");
    setMetaName("twitter:card", "summary_large_image");
    setMetaName("twitter:title", cfg.title);
    setMetaName("twitter:description", cfg.description);
    setMetaName("twitter:image", imageAbs);
    document.title = cfg.title;
    document.documentElement.lang = cfg.lang === "en" ? "en" : "es";

    document
      .querySelectorAll('script[data-seo-route="1"]')
      .forEach((n) => n.remove());
    for (const ld of cfg.jsonLd ?? []) {
      const s = document.createElement("script");
      s.type = "application/ld+json";
      s.setAttribute("data-seo-route", "1");
      s.textContent = JSON.stringify(ld);
      document.head.appendChild(s);
    }
  }, [
    cfg.path,
    cfg.title,
    cfg.description,
    cfg.lang,
    cfg.noindex,
    keywords,
    jsonLdKey,
    imageAbs,
  ]);
}

function absoluteUrl(url?: string) {
  const fallback = `${SITE.url}/assets/leey-portrait.jpg`;
  if (!url) return fallback;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${SITE.url}${url}`;
  return `${SITE.url}/${url}`;
}

function setMeta(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setMetaName(name: string, content: string) {
  setMeta(name, content);
}

function setMetaProp(prop: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${prop}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", prop);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}
