import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Phone } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useI18n } from "../i18n";
import { BrandLockup, BrokerageMark } from "./Logo";
import { SITE } from "../lib/site";

export function Header() {
  const { t, lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const loc = useLocation();
  const overHero = loc.pathname === "/" && !scrolled && !open;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const navItems = [
    { to: "/", label: t.nav.home, exact: true },
    { to: "/properties", label: t.nav.listings },
    { to: "/#about", label: t.nav.about },
    { to: "/#services", label: t.nav.services },
    { to: "/#areas", label: t.nav.areas },
    { to: "/#contact", label: t.nav.contact },
  ];

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }}
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        overHero
          ? "bg-transparent"
          : "border-b border-ink-900/[0.06] bg-ivory-50/95 backdrop-blur-sm"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
        <BrandLockup tone={overHero ? "pine" : "ivory"} />

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
          {navItems.slice(1, -1).map((item) => (
            <NavLink
              key={item.to + item.label}
              to={item.to}
              end={item.exact}
              className={`px-3 py-2 text-[13px] font-medium tracking-wide transition ${
                overHero
                  ? "text-ivory-100/80 hover:text-ivory-50"
                  : "text-ink-500 hover:text-ink-900"
              }`}
            >
              {item.label}
            </NavLink>
          ))}
          <a
            href={`tel:${SITE.agent.phoneTel}`}
            className={`ml-3 inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium transition ${
              overHero
                ? "bg-ivory-50 text-pine-800 hover:bg-clay-100"
                : "bg-ink-900 text-ivory-50 hover:bg-clay-600"
            }`}
          >
            <Phone className="h-3.5 w-3.5" strokeWidth={2} />
            {t.nav.call}
          </a>
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <LangToggle lang={lang} setLang={setLang} light={overHero} />
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={open}
            className={`inline-flex h-10 w-10 items-center justify-center lg:hidden ${
              overHero ? "text-ivory-50" : "text-ink-900"
            }`}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-x-0 top-16 bottom-0 z-40 bg-ivory-50 lg:hidden"
          >
            <div className="flex h-full flex-col px-8 py-8">
              <div className="mb-6 border-b hairline pb-6">
                <BrokerageMark height={28} tone="dark" />
              </div>
              {navItems.map((item, i) => (
                <motion.div
                  key={item.to + item.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i }}
                >
                  <NavLink
                    to={item.to}
                    end={item.exact}
                    className="block border-b hairline py-5 font-display text-3xl font-medium text-ink-900"
                  >
                    {item.label}
                  </NavLink>
                </motion.div>
              ))}
              <a
                href={`tel:${SITE.agent.phoneTel}`}
                className="mt-10 flex items-center justify-center gap-2 bg-ink-900 px-6 py-4 text-sm font-medium text-ivory-50"
              >
                <Phone className="h-4 w-4" />
                {SITE.agent.phoneDisplay}
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

function LangToggle({
  lang,
  setLang,
  light,
}: {
  lang: "es" | "en";
  setLang: (l: "es" | "en") => void;
  light?: boolean;
}) {
  const other = lang === "es" ? "en" : "es";
  return (
    <button
      onClick={() => setLang(other)}
      aria-label="Switch language"
      className={`inline-flex h-9 items-center px-2 text-[11px] font-semibold tracking-[0.16em] transition ${
        light ? "text-ivory-100/70 hover:text-ivory-50" : "text-ink-500 hover:text-ink-900"
      }`}
    >
      <span className={lang === "es" ? (light ? "text-ivory-50" : "text-ink-900") : ""}>
        ES
      </span>
      <span className="mx-1 opacity-40">/</span>
      <span className={lang === "en" ? (light ? "text-ivory-50" : "text-ink-900") : ""}>
        EN
      </span>
    </button>
  );
}
