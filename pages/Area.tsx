import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Phone, Mail, ArrowLeft } from "lucide-react";
import { useI18n } from "../i18n";
import { SITE } from "../lib/site";
import { useSeo } from "../lib/useSeo";
import { areaSeo, propertiesSeo } from "../lib/seo";
import { AREAS, getArea } from "../lib/areas";
import { useListings } from "../lib/useListings";
import { PropertyCard } from "../components/PropertyCard";

export function AreaPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t, lang } = useI18n();
  const isEs = lang === "es";
  const { listings } = useListings();
  const area = slug ? getArea(slug) : undefined;

  if (!area) {
    return (
      <main className="bg-ivory-50 pt-32 pb-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h1 className="font-display text-5xl font-light">—</h1>
          <p className="mt-3 text-ink-500">
            {isEs ? "No encontramos esa zona." : "We couldn't find that area."}
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-clay-500 px-5 py-2.5 text-sm font-medium uppercase tracking-[0.12em] text-ivory-50"
          >
            {isEs ? "Volver al inicio" : "Back home"}
          </Link>
        </div>
      </main>
    );
  }

  useSeo(
    areaSeo(area.slug, area.city, area.state, isEs ? area.taglineEs : area.taglineEn, isEs ? area.keywordsEs : area.keywordsEn),
  );

  const local = listings.filter((p) => p.city.toLowerCase() === area.city.toLowerCase());
  const body = isEs ? area.bodyEs : area.bodyEn;

  return (
    <main className="bg-ivory-50 pt-28 pb-24">
      <div className="mx-auto max-w-7xl px-6">
        <Link
          to="/#areas"
          className="group inline-flex items-center gap-2 text-sm uppercase tracking-[0.18em] text-ink-500 transition-colors hover:text-clay-500"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          {isEs ? "Zonas" : "Areas"}
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as const }}
          className="mt-8 max-w-3xl"
        >
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-clay-500">
            <MapPin className="h-3 w-3" />
            <span>{area.city}</span>
            <span className="text-ink-300">·</span>
            <span>{area.state}</span>
          </div>
          <h1 className="mt-4 font-display text-5xl font-light leading-[1.04] tracking-[-0.02em] sm:text-6xl">
            {isEs ? `Realtor en ${area.city}` : `${area.city} Realtor`}
          </h1>
          <p className="mt-4 text-lg text-ink-500 sm:text-xl">
            {isEs ? area.taglineEs : area.taglineEn}
          </p>
        </motion.div>

        <div className="mt-12 grid max-w-3xl gap-6">
          {body.map((para, i) => (
            <p key={i} className="text-lg leading-relaxed text-ink-700">
              {para}
            </p>
          ))}
        </div>

        {/* Local listings */}
        {local.length > 0 && (
          <section className="mt-16">
            <h2 className="font-display text-3xl font-light text-ink-900 sm:text-4xl">
              {isEs ? `Casas en ${area.city}` : `Homes in ${area.city}`}
            </h2>
            <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-10">
              {local.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.7, ease: [0.16, 1, 0.3, 1] as const }}
                >
                  <PropertyCard property={p} />
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="mt-20 rounded-3xl bg-pine-700 p-10 text-ivory-50">
          <h2 className="font-display text-3xl font-light">
            {isEs ? `¿Buscas en ${area.city}?` : `Looking in ${area.city}?`}
          </h2>
          <p className="mt-3 max-w-xl text-ivory-100/80">
            {isEs
              ? "Hablemos en español o en inglés. Te ayudo a comprar o vender."
              : "Let's talk in Spanish or English. I'll help you buy or sell."}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={`tel:${SITE.agent.phoneTel}`}
              className="inline-flex items-center gap-2 bg-ivory-50 px-6 py-3 text-sm font-medium text-pine-800 transition hover:bg-clay-100"
            >
              <Phone className="h-4 w-4" /> {SITE.agent.phoneDisplay}
            </a>
            <a
              href={`mailto:${SITE.agent.email}`}
              className="inline-flex items-center gap-2 border border-ivory-100/40 px-6 py-3 text-sm font-medium text-ivory-50 transition hover:border-ivory-50"
            >
              <Mail className="h-4 w-4" /> {SITE.agent.email}
            </a>
          </div>
        </section>

        {/* Other areas */}
        <section className="mt-16">
          <h2 className="font-display text-2xl font-light text-ink-900">
            {isEs ? "Otras zonas" : "Other areas"}
          </h2>
          <div className="mt-6 flex flex-wrap gap-2">
            {AREAS.filter((a) => a.slug !== area.slug).map((a) => (
              <Link
                key={a.slug}
                to={`/areas/${a.slug}`}
                className="rounded-full border border-ink-900/15 px-4 py-2 text-xs uppercase tracking-[0.12em] text-ink-700 transition hover:border-ink-900 hover:text-ink-900"
              >
                {a.city}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
