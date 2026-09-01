import { Mail, Phone } from "lucide-react";
import { Logo, BrokerageMark } from "./Logo";
import { useI18n } from "../i18n";
import { SITE } from "../lib/site";

export function Footer() {
  const { t } = useI18n();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-pine-700 text-ivory-50">
      <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16 lg:py-20">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            <Logo tone="pine" size="lg" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ivory-100/70">
              {t.footer.tagline}
            </p>
            <div className="mt-8 flex flex-col gap-1 text-sm">
              <a
                href={`tel:${SITE.agent.phoneTel}`}
                className="inline-flex min-h-11 items-center gap-2 text-ivory-100/85 transition hover:text-clay-300"
              >
                <Phone className="h-3.5 w-3.5" />
                {SITE.agent.phoneDisplay}
              </a>
              <a
                href={`mailto:${SITE.agent.email}`}
                className="inline-flex min-h-11 items-center gap-2 text-ivory-100/85 transition hover:text-clay-300"
              >
                <Mail className="h-3.5 w-3.5" />
                {SITE.agent.email}
              </a>
            </div>
            {/* Único enlace a Lock & Key */}
            <div className="mt-10">
              <BrokerageMark height={34} tone="light" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-7">
            <Col title={t.footer.columns.navigate}>
              <a href="/#about" className="foot-link">
                {t.nav.about}
              </a>
              <a href="/#services" className="foot-link">
                {t.nav.services}
              </a>
              <a href="/properties" className="foot-link">
                {t.nav.listings}
              </a>
              <a href="/blog" className="foot-link">
                {t.nav.blog}
              </a>
              <a href="/#contact" className="foot-link">
                {t.nav.contact}
              </a>
            </Col>
            <Col title={t.footer.columns.services}>
              {t.services.items.map((s) => (
                <a key={s.title} href="/#services" className="foot-link">
                  {s.title}
                </a>
              ))}
            </Col>
            <Col title={t.footer.columns.legal}>
              <span className="foot-link opacity-70">{t.footer.legalLinks.fairHousing}</span>
              <span className="foot-link opacity-70">{t.footer.legalLinks.license}</span>
            </Col>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-2 border-t hairline-light pt-6 text-[11px] text-ivory-100/45 sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {year} {t.footer.copyright}
          </span>
          <span>{t.footer.fairHousingNote}</span>
        </div>
      </div>
    </footer>
  );
}

function Col({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-clay-300/90">
        {title}
      </h4>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}
