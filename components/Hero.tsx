import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useI18n } from "../i18n";
import { SITE } from "../lib/site";

/** South Georgia countryside home — porch, metal roof, large lot. */
const HERO_BG =
  "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?auto=format&fit=crop&w=2400&q=85";

/**
 * Editorial cinematic hero:
 * left = copy / CTAs, right = clean portrait plate that soft-grounds into the scene.
 * Lock & Key lives in the nav (BrandLockup), not repeated here.
 */
export function Hero() {
  const { t } = useI18n();
  const easing = [0.16, 1, 0.3, 1] as const;

  return (
    <section className="relative isolate min-h-[100svh] overflow-hidden bg-pine-900 text-ivory-50">
      {/* Backdrop */}
      <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden>
        <img
          src={HERO_BG}
          alt=""
          className="hero-kenburns h-full w-full object-cover object-[center_40%]"
          width={2400}
          height={1600}
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-pine-900/94 via-pine-900/78 to-pine-900/45" />
        <div className="absolute inset-0 bg-gradient-to-t from-pine-900/40 via-transparent to-pine-900/55" />
        {/* Soft handoff into page */}
        <div className="hero-to-page pointer-events-none absolute inset-x-0 bottom-0 h-[34%]" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-[100svh] max-w-6xl grid-cols-1 items-center gap-12 px-6 pb-24 pt-28 lg:grid-cols-12 lg:gap-10 lg:pb-28 lg:pt-24">
        {/* Copy */}
        <div className="lg:col-span-6 xl:col-span-7">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: easing }}
            className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold-300"
          >
            {SITE.agent.title} · Georgia & Florida
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.95, ease: easing }}
            className="font-display mt-5 max-w-xl text-[2.25rem] font-medium leading-[1.05] tracking-[-0.03em] text-ivory-50 sm:text-5xl lg:text-[3.5rem] xl:text-[3.85rem]"
          >
            {t.hero.title}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.85, ease: easing }}
            className="mt-6 max-w-md text-base leading-relaxed text-ivory-100/80 sm:text-lg"
          >
            {t.hero.subtitle}
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.32, duration: 0.65 }}
            className="mt-4 text-sm font-medium tracking-wide text-clay-300"
          >
            {t.hero.speakEs}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.75, ease: easing }}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <a
              href="/properties"
              className="group inline-flex min-h-11 items-center gap-2 bg-clay-500 px-7 py-3.5 text-sm font-semibold tracking-wide text-ivory-50 transition hover:bg-clay-400"
            >
              {t.hero.cta1}
              <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
            <a
              href="#contact"
              className="inline-flex min-h-11 items-center gap-2 border border-ivory-50/30 bg-ivory-50/5 px-7 py-3.5 text-sm font-medium tracking-wide text-ivory-50 backdrop-blur-[2px] transition hover:border-ivory-50/60 hover:bg-ivory-50/10"
            >
              {t.hero.cta2}
            </a>
          </motion.div>
        </div>

        {/* Portrait plate — clean, grounded, no gold frame / no messy feather */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.95, ease: easing }}
          className="lg:col-span-6 xl:col-span-5"
        >
          <figure className="hero-portrait mx-auto w-full max-w-[340px] sm:max-w-[380px] lg:ml-auto lg:mr-0 lg:max-w-none">
            <div className="hero-portrait__frame relative overflow-hidden">
              <div className="aspect-[4/5] w-full">
                <img
                  src={SITE.agent.portrait}
                  alt={SITE.agent.displayName}
                  className="h-full w-full object-cover object-[center_18%]"
                  width={480}
                  height={640}
                  fetchPriority="high"
                />
              </div>
              {/* soft bottom grounding into caption */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-pine-900/90 via-pine-900/35 to-transparent"
              />
            </div>

            <figcaption className="hero-portrait__meta mt-4 flex items-end justify-between gap-4 border-t border-ivory-50/15 pt-4">
              <div className="min-w-0">
                <div className="font-display text-xl font-medium leading-snug text-ivory-50 sm:text-2xl">
                  {SITE.agent.displayName}
                </div>
                <div className="mt-0.5 truncate text-sm text-ivory-100/65">
                  {SITE.brokerage.name}
                </div>
              </div>
              <a
                href={`tel:${SITE.agent.phoneTel}`}
                className="shrink-0 text-sm font-medium tabular-nums tracking-wide text-ivory-50/90 transition hover:text-clay-200"
              >
                {SITE.agent.phoneDisplay}
              </a>
            </figcaption>
          </figure>
        </motion.div>
      </div>
    </section>
  );
}
