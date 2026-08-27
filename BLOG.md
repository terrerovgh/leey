# Blog — Notas de Leey (bots especializados Hermes)

## Live
- Index: https://leeyrealty.com/blog/
- Feed: https://leeyrealty.com/data/blog/posts.json

## Architecture: one specialized Hermes bot per phase

Hermes does **not** use a separate “Agents roster” product for this.
Each bot = **agent-mode cron** + **bot skill** + **prompt** + **context script**.

Inter-Agent Collaboration Workflow:
1. **Research Bot** (`01-research.sh`): Scans seasonal conditions, active inventory, and live web queries to generate market insights in `research.json`.
2. **Topic Bot** (`02-topic.sh`): Evaluates post-research insights against the topic bank and selects the single most valuable topic for the day, preparing visual queries in `topic.json`.
3. **Image Search Bot** (`03a-image-search.sh`): Reads `topic.json` and builds a highly relevant pool of color candidates (active listings + verified Wikimedia Commons photos) in `image_candidates.json`.
4. **Image Download Bot** (`03b-image-download.sh`): Downloads candidates, verifies chroma and visual relevance, discarding irrelevant or B&W images, outputting `assets.json` and optimized JPGs.
5. **Writer Bot** (`04-write.sh`): Consumes `research.json`, `topic.json`, and `assets.json` to write an in-depth, bilingual (ES & EN matching) draft with Leey's signature voice in `draft.json`.
6. **Editor Bot** (`05-editor.sh`): Reviews the draft, ensures perfect bilingual correspondence, verifies SEO metadata, runs anti-AI humanizer checks, and validates gates before issuing `READY.json`.
7. **Publish Bot** (`06-publish.sh`): Consumes `READY.json`, merges into `posts.json`, triggers static pre-rendering, and ships to Cloudflare production.

| Bot cron | Bot skill | ET | Phase script | Day | Produces |
|----------|-----------|-----|--------------|-----|----------|
| **leey-blog-research** | `leey-blog-bot-research` | 21:00 | `01-research.sh` | tomorrow | `research.json` |
| **leey-blog-topic** | `leey-blog-bot-topic` | 21:20 | `02-topic.sh` | tomorrow | `topic.json` |
| **leey-blog-image-search** | `leey-blog-bot-image-search` | 21:30 | `03a-image-search.sh` | tomorrow | `image_candidates.json` |
| **leey-blog-image-download** | `leey-blog-bot-image-download` | 21:45 | `03b-image-download.sh` | tomorrow | `assets.json` + JPGs |
| **leey-blog-writer** | `leey-blog-bot-writer` | 22:10 | `04-write.sh` | tomorrow | `draft.json` |
| **leey-blog-editor** | `leey-blog-bot-editor` | 22:40 | `05-editor.sh` | tomorrow | `final.json` + `READY.json` |
| **leey-blog-publish** | `leey-blog-bot-publish` | 07:00 | `06-publish.sh` | **today** | live post + ship |

Shared cron settings:
- `no_agent: false` (LLM agent runs)
- `model: free-then-local`
- `workdir: /home/terrerov/Projects/leey`
- `deliver: local`
- `skills: [<bot-skill>, leey-blog-pipeline]`

Dependency (no LLM bot): `leey-daily-listings` @ 07:00 `no-agent` → fresh `listings.json` for image bots.

Night phases target **tomorrow**. Publish targets **today**.

Umbrella manual: `blog_agents/03-assets.sh` runs search+download (`--stage assets`).

## Media policy (image bots)
- Prefer **live listing photos** from `public/data/listings.json` (GAMLS / Lock & Key) for houses and buildings.
- Use internet (Commons/Openverse) only when more relevant **and** modern color.
- Reject black-and-white / low-chroma (PIL check).
- Reject archival/HABS/HAER/vintage/postcard and pre-2015 year hints.
- No decorative Spanish SVGs. English chart SVG only if zero photos.
- Dedupe by SHA1 across posts (do not reuse the same file on another post).
- **Examine before accept:** vision QA (`hermes chat --image`) per topic; porch/kitchen require porch/kitchen cues if vision is down.

## Manual
```bash
npm run blog:status
npm run blog:research
npm run blog:topic
npm run blog:image-search
npm run blog:image-download
# or combined:
npm run blog:assets
npm run blog:write
npm run blog:editor
npm run blog:publish
```

Force one bot cron now:
```bash
hermes cron run <id>   # use id from `hermes cron list`
hermes cron list
```

## Instalación / recuperación de crons

Si los crons desaparecen o cambian de máquina, recréalos con:

```bash
bash scripts/hermes-crons-install.sh
```

Dry-run (muestra lo que crearía sin tocar nada):

```bash
bash scripts/hermes-crons-install.sh --dry-run
```

## Health check

```bash
bash scripts/blog-health.sh
```

Reporta:
- que los 8 jobs de Hermes existan,
- que el post más reciente no tenga más de 48h,
- que `listings.json` esté fresco,
- que el CMS responda.

## Skills
- Pipeline map: `leey-blog-pipeline`
- Specialized bots: `leey-blog-bot-research` … `leey-blog-bot-publish`
- Code: `scripts/blog_pipeline/run.py` stages `image-search` / `image-download` / `assets`
- Context helper: `~/.hermes/scripts/leey-blog-bot-ctx.sh`

## Blog Studio (edición humana)
- URL: https://leeyrealty.com/studio
- Login: magic link por email (allowlist)
- Docs: `docs/BLOG-STUDIO.md`
- Feed live en runtime: Worker KV (además del `posts.json` del repo)
- Tras publish, el pipeline hace upsert a `/api/blog/agent/upsert` si `LEEY_BLOG_AGENT_TOKEN` está en `.env`
