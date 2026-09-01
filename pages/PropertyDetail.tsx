import { useParams, Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Bed,
  Bath,
  Maximize,
  Calendar,
  Trees,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { useI18n } from "../i18n";
import { SITE } from "../lib/site";
import { useProperty } from "../lib/useListings";
import { useSeo } from "../lib/useSeo";
import { propertySeo } from "../lib/seo";

const formatPrice = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { property, loading, listings } = useProperty(id);
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const isEs = lang === "es";
  const [active, setActive] = useState(0);

  // Hooks must run unconditionally — pass a stub when property not ready.
  useSeo(
    property
      ? propertySeo(property, lang)
      : {
          path: id ? `/properties/${id}` : "/properties",
          title: isEs ? "Propiedad | Leey Hernandez" : "Property | Leey Hernandez",
          description: isEs
            ? "Detalle de propiedad con Leey Hernandez, Lock & Key Realty."
            : "Property detail with Leey Hernandez, Lock & Key Realty.",
          lang,
          noindex: true,
        },
  );

  if (loading) {
    return (
      <main className="bg-ivory-50 pt-32 pb-24">
        <div className="mx-auto max-w-3xl px-6 text-center text-ink-500">
          {isEs ? "Cargando…" : "Loading…"}
        </div>
      </main>
    );
  }

  if (!property) {
    return (
      <main className="bg-ivory-50 pt-32 pb-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h1 className="font-display text-5xl font-light">—</h1>
          <p className="mt-3 text-ink-500">
            {isEs ? "No encontramos esa propiedad." : "We couldn't find that property."}
          </p>
          <Link
            to="/properties"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-clay-500 px-5 py-2.5 text-sm font-medium uppercase tracking-[0.12em] text-ivory-50"
          >
            {t.listings.viewAll}
          </Link>
        </div>
      </main>
    );
  }

  const badgeLabel = property.badge ? t.listings.badges[property.badge] : undefined;
  const similar = listings
    .filter((p) => p.id !== property.id && p.city === property.city)
    .slice(0, 3);

  return (
    <main className="bg-ivory-50 pt-24 pb-20 sm:pt-28 sm:pb-24">
      {/* Breadcrumb / back */}
      <div className="mx-auto max-w-7xl px-6">
        <button
          onClick={() => navigate(-1)}
          className="group inline-flex min-h-11 items-center gap-2 text-sm uppercase tracking-[0.18em] text-ink-500 transition-colors hover:text-clay-500"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          {isEs ? "Volver" : "Back"}
        </button>
      </div>

      {/* Title */}
      <section className="px-6 pt-10">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as const }}
          >
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-clay-500">
              <MapPin className="h-3 w-3" />
              <span>{property.city}</span>
              <span className="text-ink-300">·</span>
              <span>{property.neighborhood}</span>
              <span className="text-ink-300">·</span>
              <span>{property.zip}</span>
              {badgeLabel && (
                <>
                  <span className="text-ink-300">·</span>
                  <span className="rounded-full bg-clay-500 px-2.5 py-0.5 text-[10px] font-medium text-ivory-50">
                    {badgeLabel}
                  </span>
                </>
              )}
            </div>

            <h1 className="mt-4 break-words font-display text-4xl font-light leading-[1.04] tracking-[-0.02em] sm:text-6xl">
              {property.title}
            </h1>

            <p className="mt-4 max-w-3xl text-lg text-ink-500 sm:text-xl">{property.tagline}</p>

            <div className="mt-8 flex flex-wrap items-end justify-between gap-6 border-y hairline py-6">
              <div className="font-display text-4xl font-medium tracking-tight text-pine-700 sm:text-5xl lg:text-6xl">
                {formatPrice(property.priceUsd)}
              </div>
              <div className="flex flex-wrap items-center gap-5 text-sm text-ink-700">
                {property.beds > 0 && (
                  <Spec icon={<Bed className="h-4 w-4" />} value={`${property.beds}`} label={t.listings.fields.beds} />
                )}
                {property.baths > 0 && (
                  <Spec icon={<Bath className="h-4 w-4" />} value={`${property.baths}`} label={t.listings.fields.baths} />
                )}
                {property.sqft > 0 && (
                  <Spec icon={<Maximize className="h-4 w-4" />} value={property.sqft.toLocaleString()} label={t.listings.fields.sqft} />
                )}
                {property.yearBuilt > 0 && (
                  <Spec icon={<Calendar className="h-4 w-4" />} value={`${property.yearBuilt}`} label={t.listings.fields.yearBuilt} />
                )}
                {property.lotSizeSqft && (
                  <Spec icon={<Trees className="h-4 w-4" />} value={`${(property.lotSizeSqft / 43560).toFixed(2)} ac`} label={t.listings.fields.lotSize} />
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Gallery */}
      <section className="mt-10 px-6">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] as const }}
            className="grid grid-cols-1 gap-4 lg:grid-cols-3"
          >
            <div className="lg:col-span-2 aspect-[16/10] overflow-hidden rounded-3xl">
              <img
                key={property.images[active]}
                src={property.images[active]}
                alt={property.title}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="grid grid-cols-3 gap-3 lg:grid-cols-1 lg:grid-rows-3">
              {property.images.slice(0, 6).map((img, i) => (
                <button
                  key={img + i}
                  onClick={() => setActive(i)}
                  className={`aspect-[4/3] overflow-hidden rounded-2xl ring-offset-2 ring-offset-ivory-50 transition-all lg:aspect-[16/9] ${
                    i === active ? "ring-2 ring-clay-500" : "opacity-80 hover:opacity-100"
                  }`}
                  aria-label={`View image ${i + 1}`}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Description + Sidebar */}
      <section className="mt-20 px-6">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 lg:grid-cols-3 lg:gap-16">
          <div className="lg:col-span-2">
            <h2 className="font-display text-3xl font-light text-ink-900 sm:text-4xl">
              {isEs ? "Sobre esta propiedad" : "About this home"}
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-ink-700">
              {property.description}
            </p>
            {property.zillowUrl && (
              <a
                href={property.zillowUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-clay-600 transition hover:text-clay-500"
              >
                {isEs ? "Ver en Zillow" : "View on Zillow"}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}

            <div className="mt-12 rounded-3xl bg-ivory-100 p-8 lg:p-10">
              <h3 className="font-display text-2xl font-light text-ink-900">
                {isEs ? "Detalles" : "Details"}
              </h3>
              <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  property.beds > 0 &&
                    `${property.beds} ${isEs ? "habitaciones" : "bedrooms"}`,
                  property.baths > 0 &&
                    `${property.baths} ${isEs ? "baños" : "baths"}`,
                  property.sqft > 0 &&
                    `${property.sqft.toLocaleString()} sqft`,
                  property.yearBuilt > 0 &&
                    `${isEs ? "Construida en" : "Built"} ${property.yearBuilt}`,
                  property.lotSizeSqft
                    ? `${(property.lotSizeSqft / 43560).toFixed(2)} ac`
                    : null,
                  property.mlsId ? `MLS ${property.mlsId}` : null,
                  (property.brokerage || SITE.brokerage.name) &&
                    `${isEs ? "Oficina" : "Office"}: ${property.brokerage || SITE.brokerage.name}`,
                  property.listedBy
                    ? `${isEs ? "Listado por" : "Listed by"}: ${property.listedBy}${
                        property.listedByPhone ? ` · ${property.listedByPhone}` : ""
                      }`
                    : null,
                ]
                  .filter(Boolean)
                  .map((f) => (
                    <li key={String(f)} className="flex items-start gap-2.5 text-sm text-ink-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-pine-700" />
                      {f}
                    </li>
                  ))}
              </ul>
            </div>

            {/* Mock mortgage calculator */}
            <MortgageCalculator priceUsd={property.priceUsd} />
          </div>

          {/* Sidebar — contact card */}
          <aside>
            <div className="sticky top-28 border border-ink-900/10 bg-surface-elevated p-7">
              <div className="flex items-center gap-3">
                <img
                  src={SITE.brokerage.logo}
                  alt={SITE.brokerage.name}
                  className="h-9 w-auto object-contain"
                  decoding="async"
                />
                <div className="min-w-0">
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-clay-500">
                    {SITE.brokerage.name}
                  </div>
                  <div className="font-display text-lg leading-tight text-ink-900">
                    {SITE.agent.displayName}
                  </div>
                </div>
              </div>

              <div className="mt-5 font-display text-2xl font-medium text-ink-900">
                {isEs ? "¿Te interesa?" : "Interested?"}
              </div>
              <p className="mt-2 text-sm text-ink-500">
                {isEs
                  ? "Agenda una visita o envíame un mensaje."
                  : "Schedule a tour or send a message."}
              </p>

              <div className="mt-7 space-y-2">
                <a
                  href={`tel:${SITE.agent.phoneTel}`}
                  className="flex items-center justify-center gap-2 bg-ink-900 px-5 py-3 text-sm font-medium text-ivory-50 transition hover:bg-clay-600"
                >
                  <Phone className="h-4 w-4" /> {t.listings.cta}
                </a>
                <a
                  href={`mailto:${SITE.agent.email}`}
                  className="flex items-center justify-center gap-2 border border-ink-900/15 px-5 py-3 text-sm font-medium text-ink-900 transition hover:border-ink-900"
                >
                  <Mail className="h-4 w-4" /> {t.contact.formSend}
                </a>
              </div>

              <div className="mt-7 space-y-1 border-t hairline pt-5 text-sm">
                <div className="font-medium text-ink-900">{SITE.agent.shortName}</div>
                <a
                  href={`tel:${SITE.agent.phoneTel}`}
                  className="block text-ink-500 transition hover:text-clay-600"
                >
                  {SITE.agent.phoneDisplay}
                </a>
                <a
                  href={`mailto:${SITE.agent.email}`}
                  className="block text-ink-500 transition hover:text-clay-600"
                >
                  {SITE.agent.email}
                </a>
                {(property.brokerage || property.listedBy) && (
                  <p className="pt-3 text-xs leading-relaxed text-ink-400">
                    {property.listedBy && (
                      <span>
                        {isEs ? "Listado por" : "Listed by"} {property.listedBy}
                        {property.brokerage ? " · " : ""}
                      </span>
                    )}
                    {property.brokerage}
                  </p>
                )}
                {property.listedByPhone && (
                  <a
                    href={`tel:${property.listedByPhone.replace(/[^\d+]/g, "")}`}
                    className="block pt-1 text-xs text-ink-500 transition hover:text-clay-600"
                  >
                    {isEs ? "Tel. listado" : "Listing agent"}: {property.listedByPhone}
                  </a>
                )}
                {property.listedByProfileUrl && (
                  <a
                    href={property.listedByProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block pt-1 text-xs text-ink-500 transition hover:text-clay-600"
                  >
                    {isEs ? "Perfil del list agent (GAMLS)" : "Listing agent profile (GAMLS)"}
                  </a>
                )}
                <p className="pt-2 text-xs leading-relaxed text-ink-400">
                  {isEs
                    ? "Contacto para visitas: Leey · Lock & Key Realty."
                    : "Tour contact: Leey · Lock & Key Realty."}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* Similar */}
      {similar.length > 0 && (
        <section className="mt-24 px-6">
          <div className="mx-auto max-w-7xl">
            <h2 className="font-display text-3xl font-light text-ink-900 sm:text-4xl">
              {isEs ? `Más en ${property.city}` : `More in ${property.city}`}
            </h2>
            <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((p) => (
                <Link
                  key={p.id}
                  to={`/properties/${p.id}`}
                  className="group block"
                >
                  <div className="overflow-hidden rounded-3xl bg-ivory-50">
                    <div className="aspect-[4/3] overflow-hidden">
                      <img
                        src={p.image}
                        alt={p.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.06]"
                      />
                    </div>
                    <div className="p-5">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-clay-500">
                        {p.neighborhood}
                      </div>
                      <h3 className="mt-2 font-display text-xl font-light text-ink-900">
                        {p.title}
                      </h3>
                      <div className="mt-2 text-lg font-medium text-pine-700">
                        {formatPrice(p.priceUsd)}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function Spec({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-clay-500">{icon}</span>
      <span className="font-medium text-ink-900">{value}</span>
      <span className="text-xs text-ink-500">{label}</span>
    </span>
  );
}

function MortgageCalculator({ priceUsd }: { priceUsd: number }) {
  const { lang } = useI18n();
  const isEs = lang === "es";
  const [downPct, setDownPct] = useState(20);
  const [years, setYears] = useState(30);
  const [rate, setRate] = useState(6.75);

  // Standard mortgage formula
  const principal = priceUsd * (1 - downPct / 100);
  const monthlyRate = rate / 100 / 12;
  const n = years * 12;
  const monthly = monthlyRate === 0 ? principal / n : (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
  const total = monthly * n;
  const interest = total - principal;

  return (
    <div className="mt-12 bg-pine-700 p-8 text-ivory-50 lg:p-10">
      <div className="font-display text-3xl font-light">
        {isEs ? "Calculadora de hipoteca" : "Mortgage calculator"}
      </div>
      <p className="mt-2 text-sm text-ivory-100/80">
        {isEs
          ? "Estimado. Para cifras reales necesitas el loan estimate oficial del lender."
          : "Estimate. For real numbers you'll need the lender's official loan estimate."}
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <CalcSlider
          label={isEs ? "Enganche" : "Down payment"}
          value={`${downPct}%`}
          min={3}
          max={50}
          step={1}
          onChange={setDownPct}
        />
        <CalcSlider
          label={isEs ? "Plazo" : "Term"}
          value={`${years} ${isEs ? "años" : "yr"}`}
          min={10}
          max={30}
          step={5}
          onChange={setYears}
        />
        <CalcSlider
          label={isEs ? "Tasa" : "Rate"}
          value={`${rate}%`}
          min={3}
          max={10}
          step={0.05}
          onChange={setRate}
        />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label={isEs ? "Pago mensual" : "Monthly"} value={formatPrice(Math.round(monthly))} highlight />
        <Stat label={isEs ? "Total prestado" : "Principal"} value={formatPrice(Math.round(principal))} />
        <Stat label={isEs ? "Intereses totales" : "Total interest"} value={formatPrice(Math.round(interest))} />
      </div>
    </div>
  );
}

function CalcSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-clay-300">
          {label}
        </span>
        <span className="font-display text-2xl text-ivory-50">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        defaultValue={
          // we'll set initial via key-change pattern; simpler is to use default and onInput update
          (label.includes("Down") || label.includes("Enganche")) ? 20 :
          (label.includes("Term") || label.includes("Plazo")) ? 30 :
          6.75
        }
        onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))}
        className="mt-3 w-full accent-clay-400"
      />
    </label>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-5 ${
        highlight ? "bg-clay-500 text-ivory-50" : "bg-pine-600/60 text-ivory-100"
      }`}
    >
      <div className="text-[11px] uppercase tracking-[0.2em] opacity-80">{label}</div>
      <div className="mt-2 font-display text-3xl font-medium">{value}</div>
    </div>
  );
}
