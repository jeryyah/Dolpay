# Workspace — Dolpay / Viorelvar Market

## Overview

Imported from https://github.com/jeryyah/Dolpay. pnpm workspace monorepo with:
- **viorelvar-market**: React + Vite frontend (gaming topup/cheat marketplace, login + admin)
- **api-server**: Express 5 backend with chat, sync, backup, health routes
- **mockup-sandbox**: design canvas

## Stack

- pnpm workspaces, Node 24, TypeScript 5.9
- Express 5 + pino logging
- React 18 + Vite, TailwindCSS, Radix UI, wouter routing, react-i18next, framer-motion
- Drizzle ORM (PostgreSQL) — schema not yet provisioned
- Orval-generated API hooks/Zod from `lib/api-spec/openapi.yaml`

## Key Commands

- `pnpm run typecheck` — full typecheck
- `pnpm run build` — typecheck + build everything
- `pnpm --filter @workspace/viorelvar-market run dev` — frontend dev
- `pnpm --filter @workspace/api-server run dev` — API dev
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks/zod

## Routing

- `/` — viorelvar-market (web)
- `/api/*` — api-server
