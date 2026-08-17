import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BlogCard } from "../components/BlogCard";
import { useBlogIndex } from "../lib/useBlog";
import { useI18n } from "../i18n";
import { useSeo } from "../lib/useSeo";
import { blogIndexSeo } from "../lib/seo";
import { SITE } from "../lib/site";

export function BlogPage() {
  const { t, lang } = useI18n();
  const { posts, loading } = useBlogIndex();
  const isEs = lang === "es";

  useSeo(blogIndexSeo(lang, posts));

  const featured = posts[0];
  const rest = posts.slice(1);

  const empty = useMemo(() => !loading && posts.length === 0, [loading, posts.length]);

  return (
    <main className="pt-16">
      <section className="border-b border-ink-900/5 bg-ivory-50">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-clay-600">
            {t.blog.eyebrow}
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-light leading-[1.08] tracking-[-0.02em] text-ink-900 sm:text-5xl lg:text-6xl">
            {t.blog.title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-500">{t.blog.subtitle}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14 sm:py-16">
        {loading && (
          <p className="text-ink-500">{isEs ? "Cargando notas…" : "Loading notes…"}</p>
        )}

        {empty && (
          <div className="rounded-3xl border border-ink-900/10 bg-surface-elevated p-10 text-center">
            <p className="font-display text-2xl text-ink-900">{t.blog.empty}</p>
            <p className="mt-3 text-ink-500">{t.blog.emptyHint}</p>
            <a
              href={`tel:${SITE.agent.phoneTel}`}
              className="mt-8 inline-flex bg-ink-900 px-6 py-3 text-sm font-medium text-ivory-50"
            >
              {SITE.agent.phoneDisplay}
            </a>
          </div>
        )}

        {featured && (
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-7">
              <Link to={`/blog/${featured.slug}`} className="group block overflow-hidden rounded-[28px]">
                <div className="aspect-[16/11] overflow-hidden bg-ivory-100">
                  <img
                    src={featured.cover.src}
                    alt={isEs ? featured.cover.altEs : featured.cover.altEn}
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                  />
                </div>
              </Link>
            </div>
            <div className="flex flex-col justify-center lg:col-span-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-clay-600">
                {t.blog.featured}
              </p>
              <h2 className="mt-3 font-display text-3xl font-light leading-snug text-ink-900 sm:text-4xl">
                <Link to={`/blog/${featured.slug}`} className="hover:text-clay-700">
                  {isEs ? featured.titleEs : featured.titleEn}
                </Link>
              </h2>
              <p className="mt-4 text-base leading-relaxed text-ink-500 sm:text-lg">
                {isEs ? featured.excerptEs : featured.excerptEn}
              </p>
              <Link
                to={`/blog/${featured.slug}`}
                className="mt-8 inline-flex w-fit bg-ink-900 px-6 py-3 text-sm font-medium text-ivory-50 transition hover:bg-clay-600"
              >
                {t.blog.readMore}
              </Link>
            </div>
          </div>
        )}

        {rest.length > 0 && (
          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((p) => (
              <BlogCard key={p.slug} post={p} />
            ))}
          </div>
        )}
      </section>

      <section className="border-t border-ink-900/5 bg-pine-700 text-ivory-50">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-14 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-3xl font-light">{t.blog.ctaTitle}</h2>
            <p className="mt-2 max-w-xl text-ivory-100/75">{t.blog.ctaBody}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={`tel:${SITE.agent.phoneTel}`}
              className="bg-ivory-50 px-6 py-3 text-sm font-medium text-pine-800"
            >
              {SITE.agent.phoneDisplay}
            </a>
            <Link
              to="/properties"
              className="border border-ivory-50/30 px-6 py-3 text-sm font-medium text-ivory-50"
            >
              {t.nav.listings}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
