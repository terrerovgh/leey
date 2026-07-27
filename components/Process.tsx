import { Section } from "./Section";
import { Reveal } from "./Reveal";
import { useI18n } from "../i18n";

export function Process() {
  const { t } = useI18n();

  return (
    <Section id="process" eyebrow={t.process.eyebrow} title={t.process.title}>
      <ol className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
        {t.process.steps.map((step, i) => (
          <Reveal key={step.n} delay={i * 0.04}>
            <li className="border-t border-ink-900/10 pt-5">
              <div className="text-[11px] font-semibold tracking-[0.18em] text-clay-600">
                {step.n}
              </div>
              <h3 className="mt-3 font-display text-xl font-medium text-ink-900">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">{step.desc}</p>
            </li>
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}
