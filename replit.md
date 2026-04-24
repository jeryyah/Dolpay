# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/viorelvar-market run build` — build the Viorelvar Market frontend (deployed to Vercel)

## Vercel Deployment

The `viorelvar-market` artifact is deployed to Vercel using `vercel.json` at the repo root.

- Build command (defined in `vercel.json`): `BASE_PATH=/ PORT=3000 NODE_ENV=production pnpm --filter @workspace/viorelvar-market run build`
  - `BASE_PATH` and `PORT` are required by `artifacts/viorelvar-market/vite.config.ts` (it throws if missing). For Vercel we serve at the root, so `BASE_PATH=/`. `PORT` is unused in build but must be set.
- Install command: `pnpm install --no-frozen-lockfile`
- Output directory: `artifacts/viorelvar-market/dist/public`
- SPA rewrites send all non-asset, non-`/api/` paths to `/index.html`.
- `/api/*` requests are proxied to an externally-hosted API server via the first rewrite rule in `vercel.json`. Replace `https://your-api-host.example.com` with the real Render/Railway/Fly URL of the API host before deploying. Same-origin from the browser → no CORS preflight.

### Frontend env vars (set in Vercel → Project → Settings → Environment Variables)

- `VITE_DOWNLOAD_URL` (optional) — absolute URL the admin "Download Project" button should point to (e.g. a CDN, R2, or GitHub Release asset). When unset, the button auto-generates an absolute URL using `window.location.origin + BASE_URL + viorelvar-project.tar.gz`, so it always points back at the deployed site.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
