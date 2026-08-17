# Blog — Notas de Leey (multi-agent)

## Live
- Index: https://leeyrealty.com/blog/
- Feed: https://leeyrealty.com/data/blog/posts.json

## Multi-agent pipeline (Hermes + free/local)

Code: `scripts/blog_pipeline/run.py`

| Stage | Agent job | Output |
|-------|-----------|--------|
| 1 research | Season, inventory cities, free web snippets, optional LLM synth | `data/blog/pipeline/DATE/research.json` |
| 2 topic | Pick angle from bank + research | `topic.json` |
| 3 assets | Wikimedia Commons + Openverse free images (CC) | `assets.json` + `public/assets/blog/YYYYMMDD/*` |
| 4 write | Bilingual draft (free LLM or human template) | `draft.json` |
| 5 polish | SEO + anti-AI humanizer | `final.json` + `READY.json` |
| 6 publish | Merge posts.json → git commit → `npm run ship` | live `/blog` |

### Commands
```bash
npm run blog:prep                 # stages 1–5 (overnight)
npm run blog:publish              # stage 6 (07:00) or full if no prep
python3 scripts/blog_pipeline/run.py --stage all
python3 scripts/blog_pipeline/run.py --date 2026-08-18 --stage prep
```

### Hermes crons
| Name | Schedule (ET) | Script |
|------|---------------|--------|
| `leey-blog-prep` | `0 22 * * *` (10pm) | prep for **tomorrow** |
| `leey-blog-morning` | `0 7 * * *` (7:00am) | publish ready post |

Models: `free-then-local` → `free` → `local` → `background`. If all fail, human-voice template still publishes.

### Content rules
- Realtor voice (Leey), ES+EN, South Georgia towns only
- No invented metrics
- Real web images with attribution captions when from Commons/Openverse
- SEO titles/meta + humanizer scrub (no delve/seamless/etc.)

### Manual post
Edit `public/data/blog/posts.json` + assets, then:
```bash
env -u CLOUDFLARE_API_TOKEN npm run ship
```
