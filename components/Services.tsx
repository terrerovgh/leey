import { Section } from "./Section";
import { Reveal } from "./Reveal";
import { useI18n } from "../i18n";

/** Editorial numbered list — no icons. */
export function Services() {
  const { t } = useI18n();

  return (
    <Section id="services" eyebrow={t.services.eyebrow} title={t.services.title} tone="paper">
      <ol className="mt-4 divide-y divide-ink-900/10 border-y border-ink-900/10">
        {t.services.items.map((item, i) => (
          <Reveal key={item.title} delay={i * 0.03}>
            <li className="grid grid-cols-1 gap-3 py-7 sm:grid-cols-12 sm:items-baseline sm:gap-8 lg:py-8">
              <span className="text-[11px] font-semibold tracking-[0.18em] text-clay-600 sm:col-span-1">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="font-display text-xl font-medium text-ink-900 sm:col-span-3 lg:text-2xl">
                {item.title}
              </h3>
              <p className="text-base leading-relaxed text-ink-500 sm:col-span-8">
                {item.desc}
              </p>
            </li>
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}
