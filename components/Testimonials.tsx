import { Section } from "./Section";
import { Reveal } from "./Reveal";
import { useI18n } from "../i18n";

export function Testimonials() {
  const { t } = useI18n();

  return (
    <Section
      id="testimonials"
      eyebrow={t.testimonials.eyebrow}
      title={t.testimonials.title}
      tone="pine"
    >
      <div className="mt-10 grid grid-cols-1 gap-px bg-ivory-50/10 sm:grid-cols-3">
        {t.testimonials.items.map((item, i) => (
          <Reveal
            key={item.name}
            delay={i * 0.05}
            className="bg-pine-700 p-6 sm:p-8 lg:p-10"
          >
            <blockquote className="font-display text-xl font-normal leading-snug text-ivory-50 lg:text-2xl">
              “{item.quote}”
            </blockquote>
            <div className="mt-8 text-sm">
              <div className="font-medium text-ivory-50">{item.name}</div>
              <div className="mt-0.5 text-ivory-100/50">{item.role}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
