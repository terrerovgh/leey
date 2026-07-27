# Leyanis “Leey” Hernandez — sitio público

Dominio de producción: **https://leeyrealty.com** (Cloudflare)

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
2. Publicar `web/leyanis/dist` como Workers Static Assets o Pages project en `leeyrealty.com`
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

## Deploy (LAN · Cloudflare DNS + Traefik)

Dominio: **https://leeyrealty.com**

- DNS Cloudflare (sin proxy): `A leeyrealty.com` / `www` → **192.168.4.50** (LAN de este PC)
- TLS: Let’s Encrypt vía Traefik (DNS challenge Cloudflare)
- App: nginx `leey-web` sirve `dist/` detrás de Traefik

```bash
npm run build
cd deploy && docker compose up -d
# Traefik route: /home/terrerov/infra/traefik/dynamic/leey.yml
```

Acceso en la Wi‑Fi/LAN local (sin Tailscale): https://leeyrealty.com  
(Si el DNS aún no resolvió: https://192.168.4.50 con Host `leeyrealty.com`)

Internet público: abrir puertos 80/443 al router o Cloudflare Tunnel / Pages.
