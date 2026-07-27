# Cloudflare Pages / deploy notes for leeyrealty.com
#
# Dashboard (recommended)
# 1. Cloudflare → Workers & Pages → Create → Pages → Connect to Git
# 2. Repo: terrerovgh/leey  · branch main
# 3. Build settings:
#      Framework preset: Vite
#      Build command:    npm run build
#      Build output:     dist
#      Root directory:   /   (repo root)
# 4. After first deploy: Custom domains → add leeyrealty.com + www
# 5. DNS: Cloudflare will set CNAME for the Pages project (proxy ON is fine)
#
# CLI alternative (token needs Account · Cloudflare Pages · Edit):
#   npx wrangler pages project create leey --production-branch=main
#   npm run build
#   npx wrangler pages deploy dist --project-name=leey
#
# SPA: public/_redirects → /* /index.html 200  (copied into dist on build)
