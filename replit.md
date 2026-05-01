# Workspace

## Overview

pnpm workspace monorepo using TypeScript. TECHGEMING — a digital gaming product store app (React + Vite) with full frontend features.

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

## Artifacts

### TECHGEMING (`artifacts/techgeming`)
- **Type**: React + Vite web app
- **Preview path**: `/`
- **Port**: 19742
- **Description**: Gaming digital product store with product listings, QRIS & USDT payments, admin panel, live chat, order history, leaderboard, referral system, and multi-language (i18n) support.
- **Data sync**: Uses `lib/cloud-sync.ts` to sync all `pinz_*` localStorage keys to the API server every 2 seconds (Last-Writer-Wins). On load, `primeCloudSync()` pulls server snapshot before first render.
- **Key pages**: Home, Product Detail, Payment (QRIS/USDT), Admin, Login, History, Chat, Leaderboard, Wishlist, My Keys, Notifications, Referral, Developer, FAQ, Contact, Garansi

### API Server (`artifacts/api-server`)
- **Type**: Express API
- **Path**: `/api`
- **Key endpoints**:
  - `GET /api/sync` — returns full snapshot of all synced key-value pairs
  - `POST /api/sync` — stores a single key with Last-Writer-Wins logic (`{ key, value, v }`)

### Database
- **Table**: `sync_store` — key (PK), value (TEXT nullable), v (BIGINT timestamp)
- All admin config (products, payment settings, categories) and user data (users, orders, stock) are persisted here via the sync layer

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
