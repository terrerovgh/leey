import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost" | "ink";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  as?: "button" | "a";
  href?: string;
  children: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 font-medium tracking-tight transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] disabled:opacity-50";

const sizes = {
  sm: "px-4 py-2.5 text-xs uppercase tracking-[0.15em]",
  md: "px-6 py-3.5 text-sm",
  lg: "px-8 py-4 text-base",
} as const;

const variants = {
  primary:
    "btn-primary bg-clay-500 text-ivory-50 hover:text-ivory-50 rounded-full",
  outline:
    "border border-current text-current hover:bg-current hover:text-ivory-50 rounded-full [&:hover_*]:!text-ivory-50",
  ghost:
    "text-current hover:opacity-60 rounded-full",
  ink:
    "bg-ink-900 text-ivory-50 hover:bg-pine-700 rounded-full",
} as const;

export function Button({
  variant = "primary",
  size = "md",
  as = "button",
  href,
  children,
  className = "",
  ...rest
}: ButtonProps) {
  const cls = `${base} ${sizes[size]} ${variants[variant]} ${className}`;
  if (as === "a" && href) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}
