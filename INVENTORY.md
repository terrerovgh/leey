# Inventario Lock & Key / Leey

## Objetivo
Publicar en https://leeyrealty.com **solo** listados de **Lock & Key Realty**
(y/o de Leey), con logo + agente + contacto en UI.

## Estado de APIs
| Fuente | Estado | Notas |
|--------|--------|-------|
| Zillow RapidAPI `real-estate-zillow-com` | **Preferido** | `GET /v1/search/sale` + `/v1/search/sold`. Free hard limit alto; rate 25 req. `brokerName` sparse (~15%) |
| Zillow RapidAPI legacy scraper | Cuota BASIC agotada | No usar salvo upgrade |
| Realtor RapidAPI | **No suscrito** | 403 |
| Georgia MLS público | **OK** | por MLS id |
| Manual JSON | **OK** | seed actual: 2 Lock & Key |

No hay endpoint público confiable “office=Lock & Key → todos los activos”.
El camino correcto es **MLS ids** (o filas manuales).

## Fuentes (pipeline `npm run sync:zillow`)

| Prioridad | Fuente | Cuándo |
|-----------|--------|--------|
| 1 | `data/manual-listings.json` | Siempre — filas completas verificadas |
| 2 | Georgia MLS público | `data/mls-ids.txt` → detalle en georgiamls.com |
| 3 | Zillow `real-estate-zillow-com` `/v1/search/sale` | Filtra `brokerName` en mode brokerage |
| 4 | Realtor RapidAPI | Cuando te suscribes a un producto Realtor |
| 5 | Apify | Si hay `APIFY_TOKEN` |
| fallback | last-good feed | Si todo falla (`KEEP_LAST_GOOD=1`) |
| vacío | feed agent vacío | En mode brokerage/mls/hybrid **no** se rellenan demos de mercado |

Nunca se inventan propiedades.

## A) Cómo listar Lock & Key YA (recomendado)

### A1 — MLS ids (Georgia MLS, sin RapidAPI)
1. Consigue el **MLS #** de cada casa activa de Lock & Key:
   - Flyer / CRM / GAMLS member
   - Zillow / Realtor ficha → campo MLS
   - Oficina: https://www.georgiamls.com/real-estate-offices/LKEY01
2. Pégalo en `data/mls-ids.txt` (uno por línea):
   ```
   20146849
   10312024
   ```
3. Sync + deploy:
   ```bash
   SYNC_MODE=brokerage npm run sync:zillow
   env -u CLOUDFLARE_API_TOKEN npm run ship
   ```
4. El script:
   - llama a GAMLS `getSingleListingDetails`
   - lee status/office/agent en `/listing/{id}`
   - **omite sold** (salvo `GAMLS_INCLUDE_SOLD=1`)
   - **omite** oficinas que no sean Lock & Key en mode brokerage

Verifica un id a mano:
```bash
curl -s 'https://www.georgiamls.com/listing/20146849' | head
```

### A2 — filas completas (sin red)
```bash
cp data/manual-listings.example.json data/manual-listings.json
# edita con datos reales
npm run sync:manual
env -u CLOUDFLARE_API_TOKEN npm run ship
```

## B) Reactivar Zillow / Realtor

### Zillow RapidAPI
Producto: `zillow-com-live-data-scraper-api`  
Si ves `exceeded the MONTHLY quota` → sube plan o espera reset.

Endpoints usados: `/bylocation`, `/bymlsid`, `/byurl` (enrich).  
**No hay** endpoint de agente; no se puede “sync from Zillow profile” con este producto.

### Realtor RapidAPI
La key actual **no** está suscrita. En RapidAPI suscribe **uno**:
- realty-in-us.p.rapidapi.com
- realtor16.p.rapidapi.com
- us-real-estate.p.rapidapi.com

```bash
# .env
REALTOR_ENABLED=1
REALTOR_RAPIDAPI_HOST=realty-in-us.p.rapidapi.com
SYNC_MODE=brokerage
npm run sync:zillow -- --dry-run
```

Luego filtra por brokerage en el script (mode brokerage).

## Comandos

```bash
npm run sync:zillow          # multi-source (manual + GAMLS + zillow + realtor)
npm run sync:manual          # solo data/manual-listings.json
npm run sync:zillow -- --dry-run
GAMLS_INCLUDE_SOLD=1 npm run sync:zillow -- --dry-run   # debug sold
```

## Schema mínimo de una fila manual
Ver `data/manual-listings.example.json` y `data/types.ts` (`Property`).

## UI
Cards: contacto Leey + Lock & Key; listing agent/office solo si viene del feed.
En mode agent vacío → mensaje honesto (no demos de mercado).
