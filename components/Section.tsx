import type { ReactNode } from "react";
import { motion } from "framer-motion";

interface SectionProps {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "left" | "center";
  tone?: "ivory" | "paper" | "pine";
  children?: ReactNode;
  className?: string;
}

const tones = {
  ivory: "bg-ivory-50 text-ink-900",
  paper: "bg-ivory-100 text-ink-900",
  pine: "bg-pine-700 text-ivory-50",
} as const;

/**
 * Editorial section header — eyebrow label + display title + optional subtitle.
 * Encodes our visual rhythm: tiny eyebrow, big serif, generous whitespace.
 */
export function Section({
  id,
  eyebrow,
  title,
  subtitle,
  align = "left",
  tone = "ivory",
  children,
  className = "",
}: SectionProps) {
  return (
    <section
      id={id}
      className={`relative px-6 py-20 sm:py-24 lg:py-28 ${tones[tone]} ${className}`}
    >
      <div
        className={`mx-auto max-w-6xl ${
          align === "center" ? "text-center" : ""
        }`}
      >
        {(eyebrow || title) && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className={`mb-10 lg:mb-14 ${align === "center" ? "mx-auto" : ""}`}
          >
            {eyebrow && (
              <div
                className={`mb-6 inline-flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.25em] ${
                  tone === "pine" ? "text-clay-200" : "text-clay-500"
                }`}
              >
                <span className="h-px w-8 bg-current opacity-60" />
                {eyebrow}
              </div>
            )}
            <h2 className="font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] sm:text-5xl lg:text-6xl">
              {title}
            </h2>
            {subtitle && (
              <p
                className={`mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl ${
                  align === "center" ? "mx-auto" : ""
                } ${
                  tone === "pine"
                    ? "text-pine-100/85"
                    : "text-ink-500"
                }`}
              >
                {subtitle}
              </p>
            )}
          </motion.div>
        )}
        {children}
      </div>
    </section>
  );
}
