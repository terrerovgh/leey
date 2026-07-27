# Inventario Lock & Key / Leey

## Objetivo
Publicar en https://leeyrealty.com solo datos verificados: listados de la
oficina **Lock & Key Realty** y/o de Leey, con logo + agente + contacto en UI.

## Fuentes (pipeline `npm run sync:zillow`)

| Prioridad | Fuente | Cuándo |
|-----------|--------|--------|
| 1 | `data/manual-listings.json` | Siempre — filas completas que tú pegas |
| 2 | `data/mls-ids.txt` + Zillow `/bymlsid` | Si hay cuota RapidAPI Zillow |
| 3 | Zillow by location (+ filtro brokerage) | Mode market/brokerage/hybrid |
| 4 | Realtor RapidAPI | Cuando te suscribes a un producto Realtor |
| 5 | Apify | Si hay `APIFY_TOKEN` |
| fallback | last-good feed | Si todo falla (`KEEP_LAST_GOOD=1`) |

Nunca se inventan propiedades. Si no hay fuente, se conserva el feed anterior.

## A) Fallback MLS manual (funciona ya, sin API)

### Opción A1 — filas completas (recomendado sin cuota)
1. Copia el ejemplo:
   ```bash
   cp data/manual-listings.example.json data/manual-listings.json
   ```
2. Edita `data/manual-listings.json` con datos **reales** del MLS / flyer / office:
   - `mlsId`, `address`, `priceUsd`, `beds`, `baths`, `sqft`, `image(s)`, `description`
   - `brokerage`: `"Lock & Key Realty"`
   - `listedBy`: agente listante (o `"Leyanis Hernandez"`)
3. Sync solo manual + deploy:
   ```bash
   npm run sync:manual
   npm run ship
   ```

### Opción A2 — solo IDs MLS
1. Pega un MLS por línea en `data/mls-ids.txt`
2. Con cuota Zillow activa:
   ```bash
   # .env → SYNC_MODE=hybrid  (o mls)
   npm run sync:zillow
   ```
3. Sin cuota API, los IDs solos **no** alcanzan: convierte cada uno en fila completa en `manual-listings.json`.

## B) Suscribir API Realtor y cablearla

Hoy la key RapidAPI **no** está suscrita a productos Realtor (responden 403).

1. Entra a RapidAPI con la misma cuenta de la key.
2. Suscribe **uno** de estos (free tier si alcanza):
   - [Realty in US](https://rapidapi.com/apidojo/api/realty-in-us) → host `realty-in-us.p.rapidapi.com`
   - [Realtor16](https://rapidapi.com/s.mahmoud97/api/realtor16) → host `realtor16.p.rapidapi.com`
   - [US Real Estate](https://rapidapi.com/datascraper/api/us-real-estate) → host `us-real-estate.p.rapidapi.com`
3. En `.env`:
   ```bash
   RAPIDAPI_KEY=tu_key
   REALTOR_ENABLED=1
   REALTOR_RAPIDAPI_HOST=realty-in-us.p.rapidapi.com
   SYNC_MODE=hybrid
   ```
4. Prueba:
   ```bash
   npm run sync:zillow -- --dry-run
   npm run sync:zillow
   npm run ship
   ```

El script ya prueba paths comunes por host y normaliza resultados al schema del front.

### Zillow RapidAPI
Producto actual: `zillow-com-live-data-scraper-api`  
Si ves `exceeded the MONTHLY quota` → sube plan o espera reset; el feed no se borra.

## Comandos

```bash
npm run sync:zillow          # hybrid multi-source
npm run sync:manual          # solo data/manual-listings.json
npm run sync:zillow -- --dry-run
npm run sync:zillow -- --force-demo   # solo demos (dev)
```

## Schema mínimo de una fila manual

Ver `data/manual-listings.example.json` y `data/types.ts` (`Property`).

## UI
Cards y detalle siempre muestran Lock & Key (logo) + agente + `(404) 403-8306`.
El enlace externo único a la brokerage sigue en nav/footer.
