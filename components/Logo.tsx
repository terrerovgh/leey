import { Link } from "react-router-dom";
import { SITE } from "../lib/site";

interface LogoProps {
  tone?: "ivory" | "pine";
  size?: "sm" | "md" | "lg";
}

/** Wordmark Leey. — minimal, editorial. */
export function Logo({ tone = "ivory", size = "md" }: LogoProps) {
  const baseColor = tone === "pine" ? "text-ivory-50" : "text-ink-900";
  const accentColor = tone === "pine" ? "text-clay-300" : "text-clay-500";
  const sizes = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-3xl",
  } as const;

  return (
    <Link
      to="/"
      className={`group inline-flex items-baseline gap-1.5 ${baseColor} ${sizes[size]} font-display tracking-[-0.03em] leading-none`}
      aria-label={`${SITE.agent.shortName} — Home`}
    >
      <span className="font-medium">{SITE.agent.shortName}</span>
      <span
        className={`${accentColor} leading-none transition-transform duration-500 group-hover:translate-x-0.5`}
        aria-hidden
      >
        .
      </span>
    </Link>
  );
}

/**
 * Official Lock & Key Realty PNG (transparent).
 * Nav-friendly mark — sole link to brokerage. Soft by default, lifts on hover.
 */
export function BrokerageMark({
  className = "",
  height = 28,
  tone = "light",
}: {
  className?: string;
  height?: number;
  /** light = on dark surfaces; dark = on cream/light surfaces */
  tone?: "light" | "dark";
}) {
  return (
    <a
      href={SITE.brokerage.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`brokerage-mark group inline-flex items-center ${className}`}
      aria-label={`${SITE.brokerage.name} — sitio oficial`}
      data-tone={tone}
    >
      <img
        src={SITE.brokerage.logo}
        alt={SITE.brokerage.name}
        className="brokerage-mark__img w-auto object-contain"
        style={{ height }}
        width={Math.round(height * (1024 / 302))}
        height={height}
        decoding="async"
      />
    </a>
  );
}

/** Brand lockup for the nav: Leey · Lock & Key */
export function BrandLockup({
  tone = "ivory",
}: {
  tone?: "ivory" | "pine";
}) {
  const divider =
    tone === "pine" ? "bg-ivory-50/25" : "bg-ink-900/15";
  const markTone = tone === "pine" ? "light" : "dark";

  return (
    <div className="flex min-w-0 items-center gap-3 sm:gap-3.5">
      <Logo size="md" tone={tone} />
      <span className={`hidden h-5 w-px shrink-0 sm:block ${divider}`} aria-hidden />
      <BrokerageMark
        height={22}
        tone={markTone}
        className="hidden sm:inline-flex"
      />
    </div>
  );
}
