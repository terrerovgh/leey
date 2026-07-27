# Leey Hernandez — sitio inmobiliario

Sitio público de **Leyanis “Leey” Hernandez**, agente de [Lock & Key Realty](https://lockandkeyrealty.com/).  
Dominio de producción: **https://leeyhernandez.com**

## Stack

- React 18 + TypeScript + Vite
- Tailwind CSS v4
- Framer Motion
- i18n ES / EN

## Desarrollo

```bash
npm install
npm run dev       # http://localhost:5175
npm run check
npm run build     # → dist/
npm run preview
```

## Contenido

- Tel: (229) 890-8062
- Licencia: Georgia y Florida
- Zonas: Valdosta, Hahira, Adel, Sparks, Lenox, Ray City, Moultrie, Thomasville, Nashville, Tifton + Norte de Florida
- Brokerage: Lock & Key Realty

## SEO

Meta locales, canonical, hreflang ES/EN, Open Graph, JSON-LD `RealEstateAgent`, `robots.txt` y `sitemap.xml`.

## Deploy (Cloudflare)

1. `npm run build`
2. Publicar `dist/` en Cloudflare Pages o Workers Static Assets
3. Apuntar `leeyhernandez.com` al proyecto
