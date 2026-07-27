import type { Property } from "../data/listings";
import { Bed, Bath, Maximize } from "lucide-react";
import { useI18n } from "../i18n";
import { useNavigate } from "react-router-dom";

const formatPrice = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

interface PropertyCardProps {
  property: Property;
  variant?: "default" | "tall";
}

export function PropertyCard({ property, variant = "default" }: PropertyCardProps) {
  const { t } = useI18n();
  const navigate = useNavigate();

  const badgeLabel = property.badge ? t.listings.badges[property.badge] : undefined;

  return (
    <article
      onClick={() => navigate(`/properties/${property.id}`)}
      className={`group cursor-pointer overflow-hidden rounded-3xl bg-ivory-50 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-pine-900/10 ${
        variant === "tall" ? "h-full" : ""
      }`}
    >
      <div className={`relative overflow-hidden ${variant === "tall" ? "h-[420px]" : "h-72"}`}>
        <img
          src={property.image}
          alt={property.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]"
        />
        {badgeLabel && (
          <span className="absolute left-4 top-4 rounded-full bg-ivory-50/95 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-pine-700 backdrop-blur">
            {badgeLabel}
          </span>
        )}
        <span className="absolute right-4 bottom-4 rounded-full bg-pine-700/90 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-ivory-50 backdrop-blur">
          {t.listings.types[property.type]}
        </span>
      </div>

      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-clay-500">
              {property.city} · {property.neighborhood}
            </div>
            <h3 className="mt-2 font-display text-2xl font-light leading-tight text-ink-900">
              {property.title}
            </h3>
            <p className="mt-2 text-sm text-ink-500">{property.tagline}</p>
          </div>
          <div className="text-right text-xl font-medium tracking-tight text-pine-700 whitespace-nowrap">
            {formatPrice(property.priceUsd)}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-5 border-t hairline pt-4 text-sm text-ink-700">
          {property.beds > 0 && (
            <span className="flex items-center gap-1.5">
              <Bed className="h-4 w-4 text-clay-500" strokeWidth={1.5} />
              <span className="font-medium">{property.beds}</span>
              <span className="text-xs text-ink-400">{t.listings.fields.beds}</span>
            </span>
          )}
          {property.baths > 0 && (
            <span className="flex items-center gap-1.5">
              <Bath className="h-4 w-4 text-clay-500" strokeWidth={1.5} />
              <span className="font-medium">{property.baths}</span>
              <span className="text-xs text-ink-400">{t.listings.fields.baths}</span>
            </span>
          )}
          {property.sqft > 0 && (
            <span className="flex items-center gap-1.5">
              <Maximize className="h-4 w-4 text-clay-500" strokeWidth={1.5} />
              <span className="font-medium">
                {property.sqft.toLocaleString()}
              </span>
              <span className="text-xs text-ink-400">{t.listings.fields.sqft}</span>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
