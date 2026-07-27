# Cloudflare deploy — leeyrealty.com

## Real production shape (verified)
- **Not** Cloudflare Pages Git-connected.
- **Workers Static Assets** service name: `leey`
- Custom hostnames: `leeyrealty.com`, `www.leeyrealty.com` → worker `leey`
- DNS: AAAA → `100::` proxied (Workers route)

## Ship
```bash
export HOME=/home/terrerov
export CLOUDFLARE_API_TOKEN=…   # profile leey .env
export CLOUDFLARE_ACCOUNT_ID=1ddbfa86148b21137f5125cbdd637e8c
cd ~/Projects/leey
npm run check
npm run deploy    # build + wrangler deploy
# and/or push main for source of truth:
git push origin main
```

## SPA
`wrangler.toml` → `[assets] not_found_handling = "single-page-application"`
Do **not** use `/* /index.html 200` in `_redirects` (CF error 100324).

## Optional Pages project
If you later create a Pages project connected to `terrerovgh/leey`:
- Build: `npm run build`
- Output: `dist`
- Then push-to-main can auto-deploy; until then use `wrangler deploy`.
