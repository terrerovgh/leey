import { Section } from "./Section";
import { Reveal } from "./Reveal";
import { useI18n } from "../i18n";

/** About — bio only place for bilingual + license detail. No second photo, no profile links. */
export function About() {
  const { t } = useI18n();

  return (
    <Section id="about" eyebrow={t.about.eyebrow} title={t.about.title}>
      <div className="mt-4 grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="space-y-6 text-lg leading-relaxed text-ink-600 lg:col-span-8">
          <Reveal>
            <p>{t.about.paragraph1}</p>
          </Reveal>
          <Reveal delay={0.06}>
            <p>{t.about.paragraph2}</p>
          </Reveal>
        </div>
        <Reveal delay={0.1} className="lg:col-span-4 lg:pt-2">
          <div className="border-t hairline pt-6 lg:border-t-0 lg:border-l lg:pl-10 lg:pt-0">
            <div className="font-display text-4xl font-medium tracking-[-0.03em] text-ink-900">
              {t.about.signature}
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
