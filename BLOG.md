# Blog — Notas de Leey (multi-agent Hermes)

## Live
- Index: https://leeyrealty.com/blog/
- Feed: https://leeyrealty.com/data/blog/posts.json

## Architecture: one Hermes agent per phase

| Agent cron | ET | Script | Does | Needs | Produces |
|------------|-----|--------|------|-------|----------|
| **leey-blog-research** | 21:00 | `blog_agents/01-research.sh` | Season, inventory, free web snippets, LLM synth | listings feed | `research.json` |
| **leey-blog-topic** | 21:20 | `blog_agents/02-topic.sh` | Score topics bank + research | research | `topic.json` |
| **leey-blog-assets** | 21:40 | `blog_agents/03-assets.sh` | Commons/Openverse photo download | topic | `assets.json` + JPGs |
| **leey-blog-writer** | 22:10 | `blog_agents/04-write.sh` | Bilingual SEO draft (free/local + template) | research+topic+assets | `draft.json` |
| **leey-blog-editor** | 22:40 | `blog_agents/05-editor.sh` | Polish, anti-AI, validation → READY | draft | `final.json`, `READY.json` |
| **leey-blog-publish** | **07:00** | `blog_agents/06-publish.sh` | posts.json + git + ship | READY (or catch-up) | live blog |

Hermes wrappers: `~/.hermes/scripts/leey-blog-0N-*.sh`  
Skill: `leey-blog-pipeline` (software-development)

Night agents target **tomorrow**. Publish targets **today**.

## Pipeline code
`scripts/blog_pipeline/run.py` — stages: research | topic | assets | write | polish | publish

### Failure policy
| Stage | On failure |
|-------|------------|
| research | HTTP retries; LLM JSON 3 rounds; season fallback |
| topic | Offline bank scoring |
| assets | Wiki/Openverse retries; broad pass; **EN chart only** if zero photos |
| write | 3 JSON corrections → human template |
| editor | polish + up to 2 repair rounds + SEO guards; hard gate cover/titles/bodies |
| publish | catch-up full run if no READY; push/ship retry once |

## Commands
```bash
bash scripts/blog_agents/00-status.sh          # gates for tomorrow
bash scripts/blog_agents/01-research.sh        # single agent
npm run blog:prep                              # full night chain
npm run blog:publish                           # morning
python3 scripts/blog_pipeline/run.py --stage assets --date YYYY-MM-DD --force
```

## Media policy
- Prefer real Commons/Openverse photos (unique by hash).
- No decorative Spanish SVG covers.
- Charts/infographics only if needed, **English labels only**.

## Content rules
- Leey voice, ES+EN, South Georgia only
- No invented metrics
- SEO titles/meta + anti-AI scrub
- Figure markers `{{figure:N}}` + sign-off — Leey
