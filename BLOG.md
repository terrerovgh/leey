# Blog — Notas de Leey (bots especializados Hermes)

## Live
- Index: https://leeyrealty.com/blog/
- Feed: https://leeyrealty.com/data/blog/posts.json

## Architecture: rolling ready-post pool + specialized Hermes bots

Hermes does **not** use a separate “Agents roster” product for this.
Each bot = **agent-mode cron** + **bot skill** + **prompt** + **context script**.

The pipeline now maintains a rolling pool of at least **10 ready/reviewed posts** in `data/blog/queue.json`.
Posts move through: `drafting` → `ready` → `reviewed` → `published`/`discarded`.
The morning publish agent pops the oldest reviewed post, so the site always has a buffer of quality content.

Inter-Agent Collaboration Workflow:
1. **Pool Bot** (`08-pool.sh`): Generates up to 3 complete posts per night (research → topic → images → write → polish) to keep the pool near 10. Adds each finished post as `ready` in `data/blog/queue.json`.
2. **Review Bot** (`07-review.sh`): Runs a strong decision LLM over every `ready` post; approves quality posts (`reviewed`) or discards (`discarded`) posts that do not meet Leey's standards.
3. **Publish Bot** (`06-publish.sh`): Pops the oldest `reviewed` post from the queue, merges it into `posts.json`, and ships to Cloudflare.

Legacy single-phase bots (`01-research` … `05-editor`) remain available for manual runs and debugging.

| Bot cron | Bot skill | ET | Phase script | Produces |
|----------|-----------|-----|--------------|----------|
| **leey-blog-pool** | `leey-blog-bot-pool` | 21:00 | `08-pool.sh` | up to 3 new `ready` posts |
| **leey-blog-review** | `leey-blog-bot-review` | 23:00 | `07-review.sh` | `reviewed` / `discarded` verdicts |
| **leey-blog-publish** | `leey-blog-bot-publish` | 07:00 | `06-publish.sh` | live post + ship |

Shared cron settings:
- `no_agent: false` (LLM agent runs)
- `model: strong-then-free` for decision agents (review, topic, research)
- `model: free-then-local` for creative agents (write, polish)
- `workdir: /home/terrerov/Projects/leey`
- `deliver: local`
- `skills: [<bot-skill>, leey-blog-pipeline]`

Dependency (no LLM bot): `leey-daily-listings` @ 07:00 `no-agent` → fresh `listings.json` for image bots.

## Media policy (image bots)
- Prefer **live listing photos** from `public/data/listings.json` (GAMLS / Lock & Key) for houses and buildings.
- Use internet (Commons/Openverse) when relevant; optionally **Pexels/Unsplash** when `PEXELS_API_KEY` / `UNSPLASH_ACCESS_KEY` are configured.
- Reject black-and-white / low-chroma (PIL check).
- Reject archival/HABS/HAER/vintage/postcard and pre-2015 year hints.
- No decorative Spanish SVGs. English chart SVG only if zero photos.
- Dedupe by SHA1 across posts; rejected images are removed from the dedupe set so they can be reconsidered for other topics.
- **Examine before accept:** vision QA (`hermes chat --image`) per topic using strong vision models first; porch/kitchen require porch/kitchen cues if vision is down.
- Target **4–6 final images** per post, selected from a pool of up to 60 scored candidates.
- Image-search results are cached for 7 days to avoid repeating API calls.

## Manual
```bash
# Check system health (crons, pool, latest post, listings)
npm run blog:status

# Fill the ready-post pool (generate up to 3 posts)
python3 scripts/blog_pipeline/run.py --stage pool --target 3

# Review all ready posts in the queue
python3 scripts/blog_pipeline/run.py --stage review-queue

# Publish the oldest reviewed post
python3 scripts/blog_pipeline/run.py --stage publish --no-ship

# Legacy single-phase commands (for debugging or forcing one topic)
python3 scripts/blog_pipeline/run.py --stage research
python3 scripts/blog_pipeline/run.py --stage topic
python3 scripts/blog_pipeline/run.py --stage assets
python3 scripts/blog_pipeline/run.py --stage write
python3 scripts/blog_pipeline/run.py --stage polish
python3 scripts/blog_pipeline/run.py --stage review
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
