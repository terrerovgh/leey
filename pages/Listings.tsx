import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal, X, MapPin } from "lucide-react";
import { listings as ALL, type PropertyType } from "../data/listings";
import { PropertyCard } from "../components/PropertyCard";
import { useI18n } from "../i18n";

type SortKey = "newest" | "price_asc" | "price_desc" | "sqft_desc";

const PROPERTY_TYPES: PropertyType[] = [
  "house",
  "townhouse",
  "condo",
  "land",
  "multifamily",
  "commercial",
];

export function ListingsPage() {
  const { t, lang } = useI18n();
  const isEs = lang === "es";

  // ── filters state ────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [type, setType] = useState<PropertyType | "">("");
  const [beds, setBeds] = useState<number>(0);
  const [priceMax, setPriceMax] = useState<number>(3_000_000);
  const [sort, setSort] = useState<SortKey>("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    let xs = ALL.filter((p) => {
      if (query) {
        const q = query.toLowerCase();
        const hay = `${p.title} ${p.city} ${p.neighborhood} ${p.zip}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (type && p.type !== type) return false;
      if (beds && p.beds < beds) return false;
      if (p.priceUsd > priceMax) return false;
      return true;
    });

    xs = [...xs].sort((a, b) => {
      switch (sort) {
        case "price_asc":
          return a.priceUsd - b.priceUsd;
        case "price_desc":
          return b.priceUsd - a.priceUsd;
        case "sqft_desc":
          return b.sqft - a.sqft;
        case "newest":
        default:
          // usaremos año como proxy de "newest"
          return b.yearBuilt - a.yearBuilt;
      }
    });

    return xs;
  }, [query, type, beds, priceMax, sort]);

  const clearFilters = () => {
    setQuery("");
    setType("");
    setBeds(0);
    setPriceMax(3_000_000);
  };

  return (
    <main className="bg-ivory-50 pt-32 pb-24">
      {/* Header editorial */}
      <section className="px-6">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as const }}
            className="flex flex-col gap-4"
          >
            <span className="inline-flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.25em] text-clay-500">
              <span className="h-px w-8 bg-current opacity-60" />
              {t.listings.eyebrow}
            </span>
            <h1 className="font-display text-5xl font-light leading-[1.02] tracking-[-0.02em] sm:text-6xl lg:text-7xl">
              {t.listings.title}
            </h1>
            <p className="max-w-2xl text-lg text-ink-500 sm:text-xl">
              {t.listings.subtitle}
            </p>
          </motion.div>

          {/* Search bar */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.8, ease: [0.16, 1, 0.3, 1] as const }}
            className="mt-12 flex flex-col gap-3 rounded-2xl border hairline bg-ivory-50 p-2 shadow-lg shadow-pine-900/5 sm:flex-row sm:items-center"
          >
            <div className="flex flex-1 items-center gap-3 px-4 py-3">
              <Search className="h-5 w-5 text-ink-400" strokeWidth={1.5} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.listings.search.placeholder}
                className="w-full bg-transparent text-base text-ink-900 placeholder:text-ink-400 focus:outline-none"
              />
            </div>
            <button
              onClick={() => setFiltersOpen(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-ink-900 px-6 py-3 text-sm font-medium uppercase tracking-[0.12em] text-ivory-50 transition-colors hover:bg-pine-700 lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" /> {t.listings.filters}
            </button>
            <button
              onClick={() => setFiltersOpen(true)}
              className="hidden items-center gap-2 rounded-xl bg-ink-900 px-6 py-3 text-sm font-medium uppercase tracking-[0.12em] text-ivory-50 transition-colors hover:bg-pine-700 lg:inline-flex"
            >
              <SlidersHorizontal className="h-4 w-4" /> {t.listings.filters}
            </button>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="ml-auto hidden rounded-xl bg-ivory-100 px-5 py-3 text-sm font-medium text-ink-700 focus:outline-none lg:block"
              aria-label="Sort"
            >
              <option value="newest">{isEs ? "Más recientes" : "Newest"}</option>
              <option value="price_asc">{isEs ? "Precio: bajo a alto" : "Price: low to high"}</option>
              <option value="price_desc">{isEs ? "Precio: alto a bajo" : "Price: high to low"}</option>
              <option value="sqft_desc">{isEs ? "Más tamaño" : "Largest"}</option>
            </select>
          </motion.div>

          {/* Quick filter chips (active) */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Chips
              type={type}
              beds={beds}
              onTypeChange={setType}
              onBedsChange={setBeds}
            />
            {(query || type || beds > 0 || priceMax < 3_000_000) && (
              <button
                onClick={clearFilters}
                className="ml-auto text-xs uppercase tracking-[0.15em] text-ink-500 underline-offset-4 hover:underline hover:text-clay-500"
              >
                {t.listings.search.clear}
              </button>
            )}
          </div>

          {/* Result count */}
          <div className="mt-8 flex items-baseline justify-between border-t hairline pt-6">
            <div className="font-display text-2xl font-light text-ink-900">
              {t.listings.search.nResults(filtered.length)}
            </div>
            <div className="text-sm text-ink-500">
              {isEs ? "En vivo" : "Live"} · <MapPin className="inline h-3 w-3 text-clay-500" /> GA
            </div>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="px-6 pt-10">
        <div className="mx-auto max-w-7xl">
          {filtered.length === 0 ? (
            <EmptyState message={t.listings.search.noResults} onClear={clearFilters} clearLabel={t.listings.search.clear} />
          ) : (
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-10">
              {filtered.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: Math.min(i * 0.04, 0.4),
                    duration: 0.7,
                    ease: [0.16, 1, 0.3, 1] as const,
                  }}
                >
                  <PropertyCard property={p} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Filter drawer (mobile + desktop) */}
      <FilterDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        type={type}
        onTypeChange={setType}
        beds={beds}
        onBedsChange={setBeds}
        priceMax={priceMax}
        onPriceMaxChange={setPriceMax}
        onClear={clearFilters}
      />
    </main>
  );
}

function Chips({
  type,
  beds,
  onTypeChange,
  onBedsChange,
}: {
  type: PropertyType | "";
  beds: number;
  onTypeChange: (t: PropertyType | "") => void;
  onBedsChange: (b: number) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap gap-2">
      {PROPERTY_TYPES.map((tt) => (
        <button
          key={tt}
          onClick={() => onTypeChange(type === tt ? "" : tt)}
          className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.15em] transition-colors ${
            type === tt
              ? "border-pine-700 bg-pine-700 text-ivory-50"
              : "border-current/20 text-ink-700 hover:border-ink-900 hover:text-ink-900"
          }`}
        >
          {t.listings.types[tt]}
        </button>
      ))}
      <span className="mx-2 inline-block h-6 w-px bg-ink-300/40" />
      {[1, 2, 3, 4, 5].map((b) => (
        <button
          key={b}
          onClick={() => onBedsChange(beds === b ? 0 : b)}
          className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.15em] transition-colors ${
            beds === b
              ? "border-clay-500 bg-clay-500 text-ivory-50"
              : "border-current/20 text-ink-700 hover:border-ink-900 hover:text-ink-900"
          }`}
        >
          {b}+ {t.listings.fields.beds}
        </button>
      ))}
    </div>
  );
}

function EmptyState({
  message,
  onClear,
  clearLabel,
}: {
  message: string;
  onClear: () => void;
  clearLabel: string;
}) {
  return (
    <div className="rounded-3xl border hairline bg-ivory-50 p-16 text-center">
      <div className="font-display text-4xl font-light text-ink-900">—</div>
      <p className="mt-3 max-w-md mx-auto text-ink-500">{message}</p>
      <button
        onClick={onClear}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-clay-500 px-5 py-2.5 text-sm font-medium uppercase tracking-[0.12em] text-ivory-50 hover:bg-clay-600"
      >
        {clearLabel}
      </button>
    </div>
  );
}

function FilterDrawer({
  open,
  onClose,
  type,
  onTypeChange,
  beds,
  onBedsChange,
  priceMax,
  onPriceMaxChange,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  type: PropertyType | "";
  onTypeChange: (t: PropertyType | "") => void;
  beds: number;
  onBedsChange: (b: number) => void;
  priceMax: number;
  onPriceMaxChange: (n: number) => void;
  onClear: () => void;
}) {
  const { t } = useI18n();
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", ease: [0.32, 0.72, 0, 1], duration: 0.45 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto bg-ivory-50 p-8"
          >
            <div className="mb-8 flex items-center justify-between">
              <h3 className="font-display text-2xl font-light text-ink-900">
                {t.listings.filters}
              </h3>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-full p-2 transition-colors hover:bg-ivory-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <FilterSection title={t.listings.search.type}>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onTypeChange("")}
                  className={`col-span-2 rounded-xl border px-4 py-3 text-sm transition-colors ${
                    type === ""
                      ? "border-pine-700 bg-pine-700 text-ivory-50"
                      : "border-current/20 text-ink-700"
                  }`}
                >
                  {t.listings.search.all}
                </button>
                {PROPERTY_TYPES.map((tt) => (
                  <button
                    key={tt}
                    onClick={() => onTypeChange(tt)}
                    className={`rounded-xl border px-4 py-3 text-sm transition-colors ${
                      type === tt
                        ? "border-pine-700 bg-pine-700 text-ivory-50"
                        : "border-current/20 text-ink-700"
                    }`}
                  >
                    {t.listings.types[tt]}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title={t.listings.search.beds}>
              <div className="grid grid-cols-6 gap-2">
                <button
                  onClick={() => onBedsChange(0)}
                  className={`col-span-2 rounded-xl border px-3 py-3 text-sm transition-colors ${
                    beds === 0
                      ? "border-pine-700 bg-pine-700 text-ivory-50"
                      : "border-current/20 text-ink-700"
                  }`}
                >
                  {t.listings.search.any}
                </button>
                {[1, 2, 3, 4, 5].map((b) => (
                  <button
                    key={b}
                    onClick={() => onBedsChange(b)}
                    className={`rounded-xl border px-3 py-3 text-sm transition-colors ${
                      beds === b
                        ? "border-pine-700 bg-pine-700 text-ivory-50"
                        : "border-current/20 text-ink-700"
                    }`}
                  >
                    {b}+
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title={t.listings.search.price}>
              <input
                type="range"
                min={250_000}
                max={3_000_000}
                step={50_000}
                value={priceMax}
                onChange={(e) => onPriceMaxChange(Number(e.target.value))}
                className="w-full accent-clay-500"
              />
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-ink-500">{t.listings.search.upTo}</span>
                <span className="font-display text-2xl text-pine-700">
                  ${priceMax.toLocaleString()}
                </span>
              </div>
            </FilterSection>

            <div className="mt-auto flex flex-col gap-2 pt-8">
              <button
                onClick={onClose}
                className="rounded-full bg-clay-500 px-6 py-3.5 text-sm font-medium uppercase tracking-[0.12em] text-ivory-50 transition-colors hover:bg-clay-600"
              >
                {t.listings.search.apply}
              </button>
              <button
                onClick={onClear}
                className="rounded-full px-6 py-3.5 text-sm font-medium uppercase tracking-[0.12em] text-ink-500 transition-colors hover:text-ink-900"
              >
                {t.listings.search.clear}
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h4 className="mb-4 text-[11px] font-medium uppercase tracking-[0.25em] text-clay-500">
        {title}
      </h4>
      {children}
    </section>
  );
}
