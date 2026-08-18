# Blog Studio — edición humana + agentes

## URLs
- Studio: https://leeyrealty.com/studio
- Feed live (público): https://leeyrealty.com/data/blog/posts.json
- Media: https://leeyrealty.com/media/blog/…

## Qué es
CMS ligero encima del blog multi-agente:
- Login por **magic link** al email (sin password).
- Edición bilingüe ES/EN, SEO, cover/figures, drafts.
- Subida de imágenes a **R2**.
- Fuente de verdad en runtime: **KV** (`blog:index`).
- El sitio público lee el feed desde el Worker (no solo el JSON del build).

## Quién puede entrar
Allowlist en `wrangler.toml` → `ALLOWED_EMAILS`:
- `leey@lockandkeyrealty.com`
- `terrerov@gmail.com`

## Secrets (Cloudflare Worker)
```bash
cd ~/Projects/leey
npx wrangler secret put RESEND_API_KEY   # envío del magic link
npx wrangler secret put AGENT_TOKEN      # token para agentes Hermes
```

Sin `RESEND_API_KEY`, el endpoint de login devuelve `devLink` en la respuesta JSON (solo bootstrap; no es el modo producción).

Dominio de envío: por defecto `FROM_EMAIL` usa `onboarding@resend.dev` (Resend sandbox → solo llega a la cuenta Resend). Para producción, verifica un dominio en Resend y actualiza `FROM_EMAIL` en `wrangler.toml`.

## Agentes Hermes
Tras `stage publish`, `run.py` llama:

`POST /api/blog/agent/upsert`  
Header: `x-agent-token: $LEEY_BLOG_AGENT_TOKEN`

En la máquina de los crons (`.env` del repo):
```bash
LEEY_BLOG_AGENT_TOKEN=<mismo valor que wrangler secret AGENT_TOKEN>
LEEY_BLOG_CMS_URL=https://leeyrealty.com
```

Sync manual de todo el feed estático → KV:
```bash
bash scripts/blog-cms-sync.sh
bash scripts/blog-cms-sync.sh --status
```

## API (resumen)
| Método | Ruta | Auth | Uso |
|--------|------|------|-----|
| POST | `/api/blog/auth/request` | — | pide magic link |
| POST | `/api/blog/auth/verify` | — | canjea token → cookie |
| GET | `/api/blog/auth/me` | cookie | sesión |
| GET/POST | `/api/blog/posts` | cookie | listar / crear |
| GET/PUT/DELETE | `/api/blog/posts/:slug` | cookie | CRUD |
| GET/POST | `/api/blog/media` | cookie | listar / upload |
| POST | `/api/blog/seed` | cookie | re-seed desde asset estático |
| POST | `/api/blog/agent/upsert` | agent token | pipeline |
| GET | `/api/blog/agent/status` | agent token | health |

## Flujo diario
1. Noche: agentes research→editor escriben `final.json` + `READY.json`.
2. 07:00: publish → `posts.json` + git/ship + **upsert CMS**.
3. Humano (si hace falta): https://leeyrealty.com/studio → edita y “Publicar live”.
4. El blog público refleja KV en ≤ ~30s (cache-control corto).

## Deploy
```bash
npm run ship   # check + build + wrangler deploy (worker + assets)
```

## Bindings
- KV `BLOG_KV` = namespace `LEEY_BLOG`
- R2 `MEDIA` = bucket `leey-blog-media`
