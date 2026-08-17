import { motion } from "framer-motion";
import { useI18n } from "../i18n";
import { SITE } from "../lib/site";

export function FinalCTA() {
  const { lang } = useI18n();
  const isEs = lang === "es";

  return (
    <section className="bg-pine-700 py-20 text-ivory-50 lg:py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as const }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold-300">
            {isEs ? "Siguiente paso" : "Next step"}
          </p>
          <h2 className="font-display mt-4 text-3xl font-medium leading-[1.12] tracking-[-0.02em] sm:text-4xl lg:text-5xl">
            {isEs
              ? "¿Compras, vendes o quieres visitar una casa?"
              : "Buying, selling, or ready to tour a home?"}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-ivory-100/75">
            {isEs
              ? "Escríbeme o llámame. Te respondo en español o en inglés y te digo el siguiente paso concreto."
              : "Call or message me. I’ll answer in Spanish or English and give you a clear next step."}
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href={`tel:${SITE.agent.phoneTel}`}
              className="bg-ivory-50 px-7 py-3.5 text-sm font-medium tracking-wide text-pine-800 transition hover:bg-clay-100"
            >
              {SITE.agent.phoneDisplay}
            </a>
            <a
              href="#contact"
              className="border border-ivory-50/25 px-7 py-3.5 text-sm font-medium tracking-wide transition hover:border-ivory-50/60"
            >
              {isEs ? "Escribir a Leey" : "Message Leey"}
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
