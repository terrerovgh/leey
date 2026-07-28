import { useEffect } from "react";
import type { SeoConfig } from "./seo";

/**
 * Applies SEO <head> tags on client-side route changes.
 * The pre-rendered static HTML already has correct tags for the initial load;
 * this keeps them right when the SPA navigates without a full reload.
 */
export function useSeo(cfg: SeoConfig) {
  useEffect(() => {
    const canonical = `${cfg.path === "/" ? "" : ""}${window.location.origin}${cfg.path}`;
    setMeta("description", cfg.description);
    setMeta("keywords", (cfg.keywords ?? []).join(", "));
    setMeta("robots", cfg.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large");
    setLink("canonical", canonical);
    setMetaProp("og:title", cfg.title);
    setMetaProp("og:description", cfg.description);
    setMetaProp("og:url", canonical);
    if (cfg.image) setMetaProp("og:image", cfg.image);
    setMetaProp("og:locale", cfg.lang === "es" ? "es_US" : "en_US");
    setMetaName("twitter:title", cfg.title);
    setMetaName("twitter:description", cfg.description);
    if (cfg.image) setMetaName("twitter:image", cfg.image);
    document.title = cfg.title;

    // JSON-LD: remove previously injected route LD, add this route's.
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
  }, [cfg]);
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
