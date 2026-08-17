# Blog — Notas de Leey (multi-agent + retries)

## Live
- Index: https://leeyrealty.com/blog/
- Feed: https://leeyrealty.com/data/blog/posts.json

## Multi-agent pipeline

Code: `scripts/blog_pipeline/run.py`

| Stage | On failure |
|-------|------------|
| **research** | Web fetch 3 tries; LLM synth 3 JSON correction rounds (free→local); deterministic season fallback |
| **topic** | Bank scoring always works offline |
| **assets** | Wiki/Openverse retries; broad query pass; SVG cover last resort |
| **write** | 3 JSON correction rounds; human-voice template fallback |
| **polish** | 3 polish rounds + up to 2 validation repair rounds (prefers `local` then free) + SEO guards |
| **publish** | Late prep if missing; preflight repair; hard-gate on cover/titles/bodies; push/ship retry once |

Logs per day: `data/blog/pipeline/DATE/pipeline.log.jsonl`  
Artifacts: `research.round*.txt`, `write.round*.txt`, `repair*.round*.txt`, `READY.json`

### Commands
```bash
npm run blog:prep       # 22:00 — prep TOMORROW
npm run blog:publish    # 07:00 — publish
python3 scripts/blog_pipeline/run.py --date YYYY-MM-DD --stage polish --force
```

### Hermes crons (ET)
| Name | When | Script |
|------|------|--------|
| `leey-blog-prep` | 22:00 | prep for tomorrow |
| `leey-blog-morning` | **07:00** | publish |

Models: `free-then-local` → `free` → `local` → `background` (order flips on correction rounds).

### Content rules
- Leey voice, ES+EN, South Georgia only
- No invented metrics
- Real Commons/Openverse photos + attribution captions when available
- SEO titles/meta + anti-AI scrub

## Media policy
- Prefer real Commons/Openverse photos.
- No decorative Spanish SVG covers.
- Charts/infographics only if needed, **English labels only**.
