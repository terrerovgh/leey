# AGENTS.md — leey

Public website (Spanish-first, with EN mirror) for realtor **Leyanis "Leey" Hernandez**, brokerage **Lock & Key Realty**. Production: https://leeyrealty.com.

## Stack & layout

- **Frontend:** Vite + React 18 + TypeScript (strict, `noEmit`) + Tailwind v4 (`@tailwindcss/vite`) + `framer-motion` + `lucide-react` + `react-router-dom`.
- **Backend:** Cloudflare **Workers Static Assets**. Single worker `worker/index.js` (Blog CMS: magic-link auth via Resend, posts CRUD on KV `BLOG_KV`, media on R2 `MEDIA`, dynamic `/data/blog/posts.json`, agent API). Config: `wrangler.toml`.
- **Routing:** `main.tsx` → `App.tsx` (Header + routes). Pages in `pages/`, presentational components in `components/`, shared helpers in `lib/`.
- **i18n:** `i18n/` provides es + en dictionaries; components select via `lang`/translation keys. Blog content is stored per-locale (`titleEs`/`titleEn`, `bodyEs`/`bodyEn`, …).
- **Canonical site data:** `lib/site.ts` (`SITE.agent`, `SITE.brokerage`, `SITE.areas`). Edit there, not in components.
- Dev server: `npm run dev` on **port 5175**.

## Commands

- `npm run check` — typecheck (`tsc --noEmit`). The repo's only lint/quality gate; run after any TS/TSX change. There is no ESLint or Prettier config.
- `npm run build` — `tsc --noEmit && vite build`, then `postbuild` → `scripts/prerender.mjs` writes static HTML into `dist/` (SSG for SEO; Studio SPA routes fall back via worker `not_found_handling = "single-page-application"`).
- `npm run ship` — check + build + `npx wrangler deploy` (full production deploy; use `npm run deploy` to skip the check).
- `npm run preview` — serve `dist/` locally.

## Listings data (never invent properties)

- Canonical types live in `data/types.ts`; frontend layer in `data/listings.ts`; feed loaded at runtime via `lib/useListings.ts`.
- Live feed: `public/data/listings.json`, produced by `scripts/sync-zillow.mjs` (`npm run sync:zillow`, `:demo`, `:manual`).
- **Mode is `brokerage`** (Lock & Key only) — see `INVENTORY.md`. Never fill gaps with market demos, and never fabricate listings. Sources by priority: manual rows (`data/manual-listings.json`) → Georgia MLS ids (`data/mls-ids.txt` / GAMLS) → Zillow RapidAPI (`RAPIDAPI_HOST=real-estate-zillow-com…`) filtered by `ZILLOW_BROKERAGE_FILTER`.
- Secrets go in `.env` (gitignored); copy from `.env.example`, never commit values.

## Blog

- Contract/types: `data/blog/types.ts` (`BlogPost`, `BlogIndex`). Body is markdown-ish plain paragraphs; figures embedded as `{{figure:N}}`.
- Published index: `public/data/blog/posts.json` (served through the worker). Queue pool: `data/blog/queue.json` with lifecycle `drafting → ready → reviewed → published|discarded`.
- Bots (see `BLOG.md` and `docs/`): `scripts/blog_agents/01–05` legacy single-phase, `07-review.sh`, `08-pool.sh`, publish via `06-publish.sh`. Crons ~21:00 pool, 23:00 review, 07:00 publish (`docs/HERMES-CRONS.md`).
- Content tone: local South Georgia market value-first advice (buying, selling, remodeling, neighborhoods, market), always anchored to real local economics; ES primary + EN mirror.
- After touching the blog: `npm run check` then `npm run build` (prerender must succeed). Publish scripts (`blog:*`) handle ship to Cloudflare.

## Deploy / infra conventions

- **Workers Static Assets** (not Pages) service named `leey`; hostnames `leeyrealty.com` + `www`. See `DEPLOY-CLOUDFLARE.md` and `deploy/` (docker-compose + nginx are the older LAN/Traefik path — Cloudflare worker is the live production shape).
- Changing `worker/index.js` requires `wrangler deploy` (and KV/R2 already provisioned via `wrangler.toml`).
- `dist/`, `.env`, `node_modules/`, `.wrangler/`, blog runtime logs are gitignored.

## Conventions

- No code comments unless they explain non-obvious "why" (existing code uses brief Spanish doc comments).
- UI copy is user-facing Spanish, with EN equivalents in `i18n/`; code identifiers and docs-for-agents in English.
- Keep `lib/site.ts`, `data/types.ts`, and `data/blog/types.ts` as the single sources of truth for their domains.