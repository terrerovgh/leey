import { Link } from "react-router-dom";
import type { BlogPost } from "../lib/blog";
import { categoryLabel, formatBlogDate } from "../lib/blog";
import { useI18n } from "../i18n";

export function BlogCard({ post }: { post: BlogPost }) {
  const { lang, t } = useI18n();
  const isEs = lang === "es";
  const title = isEs ? post.titleEs : post.titleEn;
  const excerpt = isEs ? post.excerptEs : post.excerptEn;
  const cover = post.cover;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl bg-surface-elevated shadow-sm ring-1 ring-ink-900/5 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-pine-900/10">
      <Link to={`/blog/${post.slug}`} className="block overflow-hidden">
        <div className="aspect-[16/10] overflow-hidden bg-ivory-100">
          <img
            src={cover.src}
            alt={isEs ? cover.altEs : cover.altEn}
            className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
            loading="lazy"
          />
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-6 sm:p-7">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-clay-600">
          <span>{categoryLabel(post.category, lang)}</span>
          <span className="text-ink-300">·</span>
          <time dateTime={post.date}>{formatBlogDate(post.date, lang)}</time>
          <span className="text-ink-300">·</span>
          <span className="normal-case tracking-normal text-ink-400">
            {post.readMinutes} {t.blog.minRead}
          </span>
        </div>
        <h2 className="mt-3 font-display text-2xl font-light leading-snug text-ink-900">
          <Link to={`/blog/${post.slug}`} className="transition hover:text-clay-700">
            {title}
          </Link>
        </h2>
        <p className="mt-3 flex-1 text-[15px] leading-relaxed text-ink-500">{excerpt}</p>
        <Link
          to={`/blog/${post.slug}`}
          className="mt-5 inline-flex text-sm font-medium text-clay-700 transition hover:text-clay-500"
        >
          {t.blog.readMore} →
        </Link>
      </div>
    </article>
  );
}
