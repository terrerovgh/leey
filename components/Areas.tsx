import { Section } from "./Section";
import { Reveal } from "./Reveal";
import { useI18n } from "../i18n";
import { Link } from "react-router-dom";
import { AREAS } from "../lib/areas";

export function Areas() {
  const { t, lang } = useI18n();
  const isEs = lang === "es";

  return (
    <Section
      id="areas"
      eyebrow={t.areas.eyebrow}
      title={t.areas.title}
      subtitle={t.areas.subtitle}
      tone="paper"
    >
      <div className="mt-8 grid grid-cols-1 gap-px bg-ink-900/10 sm:grid-cols-2 lg:grid-cols-3">
        {AREAS.map((area, i) => {
          const highlighted = area.slug === "valdosta";
          const desc = isEs ? area.blurbEs : area.blurbEn;
          return (
            <Reveal
              key={area.slug}
              delay={i * 0.03}
              className={`bg-ivory-100 p-7 sm:p-8 ${
                highlighted ? "sm:col-span-2 lg:col-span-1 bg-pine-700 text-ivory-50" : "text-ink-900"
              }`}
            >
              <Link
                to={`/areas/${area.slug}`}
                className="group block focus:outline-none"
                aria-label={isEs ? `Ver casas en ${area.city}` : `View homes in ${area.city}`}
              >
                <h3 className="font-display text-2xl font-medium tracking-tight transition-colors group-hover:text-clay-300 sm:text-3xl">
                  {area.city}
                </h3>
                <p
                  className={`mt-3 text-sm leading-relaxed ${
                    highlighted ? "text-ivory-100/80" : "text-ink-500"
                  }`}
                >
                  {desc}
                </p>
                <span className="mt-4 inline-block text-[11px] uppercase tracking-[0.2em] text-clay-400">
                  {isEs ? "Ver zonas →" : "View area →"}
                </span>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}
