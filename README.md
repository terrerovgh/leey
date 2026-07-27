# Leyanis “Leey” Hernandez — sitio público

Dominio de producción: **https://leeyhernandez.com** (Cloudflare)

## Desarrollo

```bash
npm run dev:leyanis      # http://localhost:5175
npm run build:leyanis    # sale a web/leyanis/dist
npm run check:leyanis
```

## Contenido oficial

- Brokerage: [Lock & Key Realty](https://lockandkeyrealty.com/)
- Perfil: [lockandkeyrealty.com/leyanis](https://lockandkeyrealty.com/leyanis/)
- Tel: (229) 890-8062
- Zonas: Valdosta, Hahira, Adel, Sparks, Lenox, Ray City + Norte de Florida
- Licencia: Georgia y Florida

## SEO incluido

- Meta title/description/keywords orientados a Sur GA
- Canonical + hreflang ES/EN
- Open Graph / Twitter cards
- JSON-LD `RealEstateAgent`
- `robots.txt` + `sitemap.xml`
- Assets en `/assets/` (foto + logo brokerage)

## Deploy Cloudflare

1. `npm run build:leyanis`
2. Publicar `web/leyanis/dist` como Workers Static Assets o Pages project en `leeyhernandez.com`
3. Verificar DNS A/CNAME del dominio en Cloudflare

## Inventario Zillow (live)

Zillow no ofrece API pública. Este repo usa un feed JSON:

```bash
cp .env.example .env
# ZILLOW_PROFILE_URL=...  +  APIFY_TOKEN=...  (o RAPIDAPI_KEY)
npm run sync:zillow
```

Salida: `public/data/listings.json` (status, fotos, descripción, precio, zillowUrl).
La web lo carga en runtime vía `useListings()`.

## Hermes profile

Perfil dedicado: `leey` (`hermes -p leey` o alias `leey`).
Skill: `leey-site` (sync + ops del sitio).
