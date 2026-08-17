import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal, X, MapPin } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { type PropertyType } from "../data/listings";
import { PropertyCard } from "../components/PropertyCard";
import { useI18n } from "../i18n";
import { useListings } from "../lib/useListings";
import { useSeo } from "../lib/useSeo";
import { propertiesSeo } from "../lib/seo";

type SortKey = "newest" | "price_asc" | "price_desc" | "sqft_desc";

const PROPERTY_TYPES: PropertyType[] = [
  "house",
  "townhouse",
  "condo",
  "land",
  "multifamily",
  "commercial",
];

const PRICE_CAP = 1_000_000;
const PRICE_FLOOR = 50_000;
const PRICE_STEP = 25_000;

export function ListingsPage() {
  const { t, lang } = useI18n();
  const isEs = lang === "es";
  const {
    listings: ALL,
    loading,
    isLive,
    syncedAt,
    inventoryMode,
    cities,
  } = useListings();
  useSeo(propertiesSeo(ALL, lang));

  const [params, setParams] = useSearchParams();

  const query = params.get("q") ?? "";
  const type = (params.get("type") as PropertyType | null) ?? "";
  const beds = numParam(params.get("beds"), 0);
  const city = params.get("city") ?? "";
  const priceMax = clamp(
    numParam(params.get("max"), PRICE_CAP),
    PRICE_FLOOR,
    PRICE_CAP,
  );
  const sort = (params.get("sort") as SortKey | null) ?? "newest";
  const [filtersOpen, setFiltersOpen] = useState(false);

  const setFilter = (key: string, value: string | number | null | undefined) => {
    const next = new URLSearchParams(params);
    if (
      value == null ||
      value === "" ||
      value === 0 ||
      (key === "max" && Number(value) >= PRICE_CAP) ||
      (key === "sort" && value === "newest")
    ) {
      next.delete(key);
    } else {
      next.set(key, String(value));
    }
    setParams(next, { replace: true });
  };

  const filtered = useMemo(() => {
    let xs = ALL.filter((p) => {
      if (query) {
        const q = query.toLowerCase();
        const hay =
          `${p.title} ${p.city} ${p.neighborhood} ${p.zip} ${p.address ?? ""} ${p.mlsId ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (type && p.type !== type) return false;
      if (city && p.city.toLowerCase() !== city.toLowerCase()) return false;
      if (beds && p.beds < beds) return false;
      if (p.priceUsd > 0 && p.priceUsd > priceMax) return false;
      if (p.status === "sold" || p.status === "off_market") return false;
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
        default: {
          const ta = a.listedAt
            ? Date.parse(a.listedAt)
            : a.updatedAt
              ? Date.parse(a.updatedAt)
              : a.yearBuilt || 0;
          const tb = b.listedAt
            ? Date.parse(b.listedAt)
            : b.updatedAt
              ? Date.parse(b.updatedAt)
              : b.yearBuilt || 0;
          return tb - ta;
        }
      }
    });

    return xs;
  }, [ALL, query, type, beds, priceMax, sort, city]);

  const clearFilters = () => {
    setParams(new URLSearchParams(), { replace: true });
  };

  const hasActive =
    !!query || !!type || beds > 0 || !!city || priceMax < PRICE_CAP;

  const statusLine = loading
    ? t.listings.loadingLabel
    : inventoryMode === "agent" || inventoryMode === "manual"
      ? isLive || ALL.length > 0
        ? `${t.listings.liveLabel}${
            syncedAt
              ? ` · ${new Date(syncedAt).toLocaleString(
                  lang === "es" ? "es-US" : "en-US",
                )}`
              : ""
          } · ${t.listings.marketLabel}`
        : t.listings.previewLabel
      : isLive
        ? `${t.listings.liveLabel}${
            syncedAt
              ? ` · ${new Date(syncedAt).toLocaleString(
                  lang === "es" ? "es-US" : "en-US",
                )}`
              : ""
          }`
        : t.listings.previewLabel;

  return (
    <main className="bg-ivory-50 pt-32 pb-24">
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
            <p className="text-xs tracking-wide text-ink-400">{statusLine}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.15,
              duration: 0.8,
              ease: [0.16, 1, 0.3, 1] as const,
            }}
            className="mt-12 flex flex-col gap-3 rounded-2xl border hairline bg-ivory-50 p-2 shadow-lg shadow-pine-900/5 sm:flex-row sm:items-center"
          >
            <div className="flex flex-1 items-center gap-3 px-4 py-3">
              <Search className="h-5 w-5 text-ink-400" strokeWidth={1.5} />
              <input
                value={query}
                onChange={(e) => setFilter("q", e.target.value)}
                placeholder={t.listings.search.placeholder}
                className="w-full bg-transparent text-base text-ink-900 placeholder:text-ink-400 focus:outline-none"
                aria-label={t.listings.search.placeholder}
              />
            </div>
            <button
              onClick={() => setFiltersOpen(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-ink-900 px-6 py-3 text-sm font-medium uppercase tracking-[0.12em] text-ivory-50 transition-colors hover:bg-pine-700"
            >
              <SlidersHorizontal className="h-4 w-4" /> {t.listings.filters}
            </button>
            <select
              value={sort}
              onChange={(e) => setFilter("sort", e.target.value)}
              className="hidden rounded-xl bg-ivory-100 px-5 py-3 text-sm font-medium text-ink-700 focus:outline-none lg:block"
              aria-label="Sort"
            >
              <option value="newest">{t.listings.sort.newest}</option>
              <option value="price_asc">{t.listings.sort.priceAsc}</option>
              <option value="price_desc">{t.listings.sort.priceDesc}</option>
              <option value="sqft_desc">{t.listings.sort.sqftDesc}</option>
            </select>
          </motion.div>

          {cities.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[11px] uppercase tracking-[0.2em] text-ink-400">
                {t.listings.search.city}
              </span>
              <button
                onClick={() => setFilter("city", "")}
                className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.15em] transition-colors ${
                  !city
                    ? "border-pine-700 bg-pine-700 text-ivory-50"
                    : "border-current/20 text-ink-700 hover:border-ink-900"
                }`}
              >
                {t.listings.search.all}
              </button>
              {cities.map((c) => (
                <button
                  key={c}
                  onClick={() => setFilter("city", city === c ? "" : c)}
                  className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.15em] transition-colors ${
                    city === c
                      ? "border-pine-700 bg-pine-700 text-ivory-50"
                      : "border-current/20 text-ink-700 hover:border-ink-900"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Chips
              type={type as PropertyType | ""}
              beds={beds}
              onTypeChange={(tt) => setFilter("type", tt)}
              onBedsChange={(b) => setFilter("beds", b || null)}
            />
            {hasActive && (
              <button
                onClick={clearFilters}
                className="ml-auto text-xs uppercase tracking-[0.15em] text-ink-500 underline-offset-4 hover:underline hover:text-clay-500"
              >
                {t.listings.search.clear}
              </button>
            )}
          </div>

          <div className="mt-8 flex items-baseline justify-between border-t hairline pt-6">
            <div className="font-display text-2xl font-light text-ink-900">
              {loading ? "…" : t.listings.search.nResults(filtered.length)}
            </div>
            <div className="text-sm text-ink-500">
              <MapPin className="inline h-3 w-3 text-clay-500" />{" "}
              {isEs ? "Sur de Georgia · FL" : "South GA · FL"}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pt-10">
        <div className="mx-auto max-w-7xl">
          {loading ? (
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-10">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-96 animate-pulse rounded-3xl bg-ivory-100"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              message={
                !loading && ALL.length === 0 && (inventoryMode === "agent" || inventoryMode === "manual")
                  ? t.listings.emptyAgent
                  : t.listings.search.noResults
              }
              onClear={clearFilters}
              clearLabel={t.listings.search.clear}
              showClear={ALL.length > 0}
            />
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

      <FilterDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        type={(type as PropertyType | "") || ""}
        onTypeChange={(tt) => setFilter("type", tt)}
        beds={beds}
        onBedsChange={(b) => setFilter("beds", b || null)}
        priceMax={priceMax}
        onPriceMaxChange={(n) => setFilter("max", n)}
        city={city}
        cities={cities}
        onCityChange={(c) => setFilter("city", c)}
        onClear={clearFilters}
      />
    </main>
  );
}

function numParam(v: string | null, d: number) {
  if (v == null || v === "") return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
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
  showClear = true,
}: {
  message: string;
  onClear: () => void;
  clearLabel: string;
  showClear?: boolean;
}) {
  return (
    <div className="rounded-3xl border hairline bg-ivory-50 p-16 text-center">
      <div className="font-display text-4xl font-light text-ink-900">—</div>
      <p className="mx-auto mt-3 max-w-md text-ink-500">{message}</p>
      {showClear && (
        <button
          onClick={onClear}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-clay-500 px-5 py-2.5 text-sm font-medium uppercase tracking-[0.12em] text-ivory-50 hover:bg-clay-600"
        >
          {clearLabel}
        </button>
      )}
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
  city,
  cities,
  onCityChange,
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
  city: string;
  cities: string[];
  onCityChange: (c: string) => void;
  onClear: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
            transition={{
              type: "tween",
              ease: [0.32, 0.72, 0, 1],
              duration: 0.45,
            }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto bg-ivory-50 p-8"
            role="dialog"
            aria-modal="true"
            aria-label={t.listings.filters}
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

            {cities.length > 0 && (
              <FilterSection title={t.listings.search.city}>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => onCityChange("")}
                    className={`rounded-xl border px-4 py-3 text-sm transition-colors ${
                      !city
                        ? "border-pine-700 bg-pine-700 text-ivory-50"
                        : "border-current/20 text-ink-700"
                    }`}
                  >
                    {t.listings.search.all}
                  </button>
                  {cities.map((c) => (
                    <button
                      key={c}
                      onClick={() => onCityChange(city === c ? "" : c)}
                      className={`rounded-xl border px-4 py-3 text-sm transition-colors ${
                        city === c
                          ? "border-pine-700 bg-pine-700 text-ivory-50"
                          : "border-current/20 text-ink-700"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </FilterSection>
            )}

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
                min={PRICE_FLOOR}
                max={PRICE_CAP}
                step={PRICE_STEP}
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
