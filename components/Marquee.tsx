import { useI18n } from "../i18n";

/** City ticker — seamless continuation of the hero ivory handoff. */
export function Marquee() {
  const { t } = useI18n();
  const items = [...t.marquee.items, ...t.marquee.items, ...t.marquee.items];

  return (
    <section
      id="marquee"
      className="relative z-[1] -mt-4 overflow-hidden border-b border-ink-900/[0.05] bg-ivory-50 py-5"
      aria-hidden
    >
      <div className="flex animate-marquee gap-10 whitespace-nowrap text-ink-400">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-10 text-[12px] font-medium tracking-[0.16em] uppercase"
          >
            <span>{item}</span>
            <span className="text-ink-300">·</span>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes marquee {
          from { transform: translate3d(0,0,0); }
          to   { transform: translate3d(-33.333%,0,0); }
        }
        .animate-marquee { animation: marquee 42s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .animate-marquee { animation: none; }
        }
      `}</style>
    </section>
  );
}
