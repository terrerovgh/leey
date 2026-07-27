import { Section } from "./Section";
import { Reveal } from "./Reveal";
import { useI18n } from "../i18n";

export function Areas() {
  const { t } = useI18n();

  return (
    <Section
      id="areas"
      eyebrow={t.areas.eyebrow}
      title={t.areas.title}
      subtitle={t.areas.subtitle}
      tone="paper"
    >
      <div className="mt-8 grid grid-cols-1 gap-px bg-ink-900/10 sm:grid-cols-2 lg:grid-cols-3">
        {t.areas.items.map((area, i) => {
          const highlighted = "highlight" in area && area.highlight;
          return (
            <Reveal
              key={area.city}
              delay={i * 0.03}
              className={`bg-ivory-100 p-7 sm:p-8 ${
                highlighted ? "sm:col-span-2 lg:col-span-1 bg-pine-700 text-ivory-50" : "text-ink-900"
              }`}
            >
              <h3 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
                {area.city}
              </h3>
              <p
                className={`mt-3 text-sm leading-relaxed ${
                  highlighted ? "text-ivory-100/80" : "text-ink-500"
                }`}
              >
                {area.desc}
              </p>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}
