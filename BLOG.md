# Blog — Notas de Leey

## Live
- Index: https://leeyrealty.com/blog/
- Feed: https://leeyrealty.com/data/blog/posts.json

## Content rules
- Realtor voice (Leey), bilingual ES/EN, South Georgia towns only.
- No invented metrics. No AI-marketing clichés.
- Every post needs a cover figure (SVG infographic/chart or photo).
- Body can embed `{{figure:0}}` for mid-article art.

## Daily publish
```bash
npm run blog:daily
# or Hermes cron 62a97214ec22 @ 07:15 America/New_York
# script: ~/.hermes/scripts/leey-daily-blog-publish.sh
# → scripts/daily-blog-publish.sh
```

Pipeline:
1. Skip if a post already exists for today.
2. Pick least-used angle from `data/blog/topics.json`.
3. Try free LLM via `hermes chat --model free-then-local` (optional).
4. Fallback: deterministic human-voice template + unique SVG cover.
5. Anti-slop scrub → append to `public/data/blog/posts.json`.
6. Commit + push + `npm run ship` only when changed.

## Manual new post
Edit `public/data/blog/posts.json` (schema in `data/blog/types.ts`), add assets under `public/assets/blog/`, then:
```bash
env -u CLOUDFLARE_API_TOKEN npm run ship
```
