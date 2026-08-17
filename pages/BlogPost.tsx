import { Link, useParams } from "react-router-dom";
import { useBlogPost } from "../lib/useBlog";
import { useI18n } from "../i18n";
import { useSeo } from "../lib/useSeo";
import { blogPostSeo } from "../lib/seo";
import {
  categoryLabel,
  formatBlogDate,
  parseBody,
  type BlogPost,
} from "../lib/blog";
import { SITE } from "../lib/site";
import { BlogCard } from "../components/BlogCard";

export function BlogPostPage() {
  const { slug } = useParams();
  const { t, lang } = useI18n();
  const { post, loading, posts } = useBlogPost(slug);
  const isEs = lang === "es";

  useSeo(
    post
      ? blogPostSeo(post, lang)
      : {
          path: slug ? `/blog/${slug}` : "/blog",
          title: isEs ? "Nota | Leey Hernandez" : "Note | Leey Hernandez",
          description: isEs
            ? "Notas de Leey sobre casas y vida en el sur de Georgia."
            : "Notes from Leey on homes and life in South Georgia.",
          lang,
          noindex: true,
        },
  );

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-28">
        <p className="text-ink-500">{isEs ? "Cargando…" : "Loading…"}</p>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-28 text-center">
        <h1 className="font-display text-4xl font-light text-ink-900">{t.blog.notFound}</h1>
        <Link to="/blog" className="mt-8 inline-flex text-clay-700">
          ← {t.blog.back}
        </Link>
      </main>
    );
  }

  const title = isEs ? post.titleEs : post.titleEn;
  const body = parseBody(isEs ? post.bodyEs : post.bodyEn);
  const related = posts.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <main className="pt-16">
      <article>
        <header className="border-b border-ink-900/5 bg-ivory-50">
          <div className="mx-auto max-w-3xl px-6 py-14 sm:py-16">
            <Link to="/blog" className="text-sm text-ink-500 transition hover:text-clay-700">
              ← {t.blog.back}
            </Link>
            <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-clay-600">
              <span>{categoryLabel(post.category, lang)}</span>
              <span className="text-ink-300">·</span>
              <time dateTime={post.date}>{formatBlogDate(post.date, lang)}</time>
              <span className="text-ink-300">·</span>
              <span className="normal-case tracking-normal text-ink-400">
                {post.readMinutes} {t.blog.minRead}
              </span>
            </div>
            <h1 className="mt-4 font-display text-4xl font-light leading-[1.1] tracking-[-0.02em] text-ink-900 sm:text-5xl">
              {title}
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-ink-500">
              {isEs ? post.excerptEs : post.excerptEn}
            </p>
            <div className="mt-8 flex items-center gap-3">
              <img
                src={SITE.agent.portrait}
                alt=""
                className="h-12 w-12 rounded-full object-cover"
              />
              <div className="text-sm">
                <div className="font-medium text-ink-900">{SITE.agent.displayName}</div>
                <div className="text-ink-500">{SITE.brokerage.name}</div>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-4xl px-6 pt-10">
          <div className="overflow-hidden rounded-[28px] bg-ivory-100">
            <img
              src={post.cover.src}
              alt={isEs ? post.cover.altEs : post.cover.altEn}
              className="w-full object-cover"
            />
          </div>
          {(isEs ? post.cover.captionEs : post.cover.captionEn) && (
            <p className="mt-3 text-center text-sm text-ink-400">
              {isEs ? post.cover.captionEs : post.cover.captionEn}
            </p>
          )}
        </div>

        <div className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
          <div className="space-y-6">
            {body.map((block, i) => {
              if (block.type === "h") {
                return (
                  <h2
                    key={i}
                    className="pt-4 font-display text-2xl font-light text-ink-900 sm:text-3xl"
                  >
                    {block.text}
                  </h2>
                );
              }
              if (block.type === "figure") {
                const fig = post.figures?.[block.index] || post.cover;
                if (!fig) return null;
                return (
                  <figure key={i} className="my-10 overflow-hidden rounded-3xl bg-ivory-100">
                    <img
                      src={fig.src}
                      alt={isEs ? fig.altEs : fig.altEn}
                      className="w-full"
                      loading="lazy"
                    />
                    {(isEs ? fig.captionEs : fig.captionEn) && (
                      <figcaption className="px-4 py-3 text-center text-sm text-ink-500">
                        {isEs ? fig.captionEs : fig.captionEn}
                      </figcaption>
                    )}
                  </figure>
                );
              }
              return (
                <p
                  key={i}
                  className="text-[17px] leading-[1.75] text-ink-700 [&_a]:text-clay-700 [&_a]:underline [&_a]:underline-offset-2 [&_strong]:font-semibold [&_strong]:text-ink-900"
                  dangerouslySetInnerHTML={{ __html: block.html }}
                />
              );
            })}
          </div>

          <div className="mt-14 rounded-3xl border border-ink-900/10 bg-surface-elevated p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-clay-600">
              {t.blog.talkEyebrow}
            </p>
            <h3 className="mt-3 font-display text-2xl font-light text-ink-900">
              {t.blog.talkTitle}
            </h3>
            <p className="mt-2 text-ink-500">{t.blog.talkBody}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={`tel:${SITE.agent.phoneTel}`}
                className="bg-ink-900 px-5 py-3 text-sm font-medium text-ivory-50"
              >
                {SITE.agent.phoneDisplay}
              </a>
              <a
                href={`mailto:${SITE.agent.email}?subject=${encodeURIComponent(title)}`}
                className="border border-ink-900/15 px-5 py-3 text-sm font-medium text-ink-900"
              >
                {SITE.agent.email}
              </a>
            </div>
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section className="border-t border-ink-900/5 bg-ivory-100/50">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="font-display text-3xl font-light text-ink-900">{t.blog.moreNotes}</h2>
            <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p: BlogPost) => (
                <BlogCard key={p.slug} post={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
