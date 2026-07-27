import { Section } from "./Section";
import { Reveal } from "./Reveal";
import { PropertyCard } from "./PropertyCard";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useI18n } from "../i18n";
import { useListings } from "../lib/useListings";

export function ListingsTeaser() {
  const { t } = useI18n();
  const { listings, loading } = useListings();
  const featured = listings
    .filter((p) => p.status !== "sold" && p.status !== "off_market")
    .slice(0, 3);

  return (
    <Section
      id="listings"
      eyebrow={t.listings.eyebrow}
      title={t.listings.title}
      subtitle={t.listings.subtitle}
    >
      {loading && (
        <p className="mt-8 text-sm text-ink-400">…</p>
      )}
      <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:mt-20 lg:grid-cols-3 lg:gap-10">
        {featured.map((p, i) => (
          <Reveal key={p.id} delay={i * 0.08}>
            <PropertyCard property={p} />
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-16 flex justify-center">
        <Link
          to="/properties"
          className="group inline-flex items-center gap-3 border border-ink-900 px-7 py-4 text-sm font-medium uppercase tracking-[0.12em] text-ink-900 transition-all duration-300 hover:bg-ink-900 hover:text-ivory-50 hover:gap-4"
        >
          {t.listings.viewAll}
          <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </Reveal>
    </Section>
  );
}
