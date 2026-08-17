# Blog — Notas de Leey (multi-agent Hermes)

## Live
- Index: https://leeyrealty.com/blog/
- Feed: https://leeyrealty.com/data/blog/posts.json

## Architecture: one Hermes agent per phase

| Agent cron | ET | Script | Does | Needs | Produces |
|------------|-----|--------|------|-------|----------|
| **leey-blog-research** | 21:00 | `blog_agents/01-research.sh` | Season, inventory, free web snippets, LLM synth | listings feed | `research.json` |
| **leey-blog-topic** | 21:20 | `blog_agents/02-topic.sh` | Score topics bank + research | research | `topic.json` |
| **leey-blog-image-search** | 21:30 | `blog_agents/03a-image-search.sh` | Rank photo candidates (listings first, then modern color web) | topic | `image_candidates.json` |
| **leey-blog-image-download** | 21:45 | `blog_agents/03b-image-download.sh` | Download + reject B&W/archival; prefer listing homes | candidates | `assets.json` + JPGs |
| **leey-blog-writer** | 22:10 | `blog_agents/04-write.sh` | Bilingual SEO draft (free/local + template) | research+topic+assets | `draft.json` |
| **leey-blog-editor** | 22:40 | `blog_agents/05-editor.sh` | SEO polish, anti-AI scrub, READY gate | draft | `final.json` + `READY.json` |
| **leey-blog-publish** | 07:00 | `blog_agents/06-publish.sh` | Merge feed, git, Cloudflare ship | READY (today) | live post |

Night phases target **tomorrow**. Publish targets **today**.

Umbrella manual: `blog_agents/03-assets.sh` runs search+download (`--stage assets`).

## Media policy (image agents)
- Prefer **live listing photos** from `public/data/listings.json` (GAMLS / Lock & Key) for houses and buildings.
- Use internet (Commons/Openverse) only when more relevant **and** modern color.
- Reject black-and-white / low-chroma (PIL check).
- Reject archival/HABS/HAER/vintage/postcard and pre-2015 year hints.
- No decorative Spanish SVGs. English chart SVG only if zero photos.
- Dedupe by SHA1 across posts (do not reuse the same file on another post).

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

## Skill
Hermes skill: `leey-blog-pipeline`  
Code: `scripts/blog_pipeline/run.py` stages `image-search` / `image-download` / `assets`
