/** Blog post contract — frontend + daily publisher. */

export type BlogCategory =
  | "buying"
  | "selling"
  | "remodel"
  | "decor"
  | "neighborhoods"
  | "market"
  | "first_home";

export interface BlogFigure {
  /** Absolute site path or full URL */
  src: string;
  altEs: string;
  altEn: string;
  captionEs?: string;
  captionEn?: string;
  kind?: "photo" | "infographic" | "chart";
}

export interface BlogPost {
  slug: string;
  /** ISO date YYYY-MM-DD */
  date: string;
  updatedAt?: string;
  category: BlogCategory;
  /** Minutes */
  readMinutes: number;
  cover: BlogFigure;
  /** Optional extra figures embedded by index in body */
  figures?: BlogFigure[];
  tags: string[];
  /** Related area slugs from lib/areas when applicable */
  areas?: string[];
  titleEs: string;
  titleEn: string;
  excerptEs: string;
  excerptEn: string;
  /**
   * Body as markdown-ish plain paragraphs separated by \n\n.
   * Supports simple **bold** and [label](url). No HTML.
   * Insert figures with a line: {{figure:0}}
   */
  bodyEs: string;
  bodyEn: string;
  /** SEO overrides */
  seoTitleEs?: string;
  seoTitleEn?: string;
  seoDescriptionEs?: string;
  seoDescriptionEn?: string;
  draft?: boolean;
}

export interface BlogIndex {
  version: 1;
  updatedAt: string;
  posts: BlogPost[];
}
