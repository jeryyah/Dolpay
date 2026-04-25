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
- `pnpm --filter @workspace/viorelvar-market run build` — build the Viorelvar Market frontend (deployed to Netlify)

## Netlify Deployment

The `viorelvar-market` artifact is deployed to Netlify using `netlify.toml` at the repo root.

- Build command (defined in `netlify.toml`): `pnpm install --no-frozen-lockfile && BASE_PATH=/ PORT=3000 NODE_ENV=production pnpm --filter @workspace/viorelvar-market run build`
  - `BASE_PATH` and `PORT` are required by `artifacts/viorelvar-market/vite.config.ts` (it throws if missing). For Netlify we serve at the root, so `BASE_PATH=/`. `PORT` is unused in build but must be set.
  - The explicit `pnpm install` is included because Netlify's auto-install can be flaky on monorepos; `--no-frozen-lockfile` allows lockfile drift.
- Publish directory: `artifacts/viorelvar-market/dist/public`
- Node version: `20` (set via `[build.environment] NODE_VERSION`); pnpm version comes from the root `package.json` `packageManager` field via Corepack.
- SPA fallback: all unmatched paths redirect to `/index.html` (status 200) so client-side routing works.
- **No backend deployment needed.** The `viorelvar-market` artifact is fully client-side: app state lives in browser `localStorage` (`src/lib/storage.ts`). Pembayaran QRIS pakai mode **manual sepenuhnya** — admin upload satu gambar QRIS statis di Pengaturan, pembeli scan dan transfer, lalu klik "Saya Sudah Membayar". Tidak ada integrasi gateway pihak ketiga (Rama API dll sudah dihapus). The `api-server` artifact in this monorepo is unused scaffold and is not deployed anywhere.

### Frontend env vars (already set in `netlify.toml`)

- `SKIP_BUNDLE = "1"` — tells `scripts/generate-version.mjs` to write `version.json` only and skip producing the heavy `viorelvar-project.tar.gz` archive on hosted builds. The script also auto-detects `NETLIFY === "true"` (set by Netlify itself) as an additional safety net.
- `VITE_DOWNLOAD_URL` — absolute URL the admin "Download Project" button points to. Currently set to the `v1.0.0` GitHub Release asset on `jeryyah/Dolpay`. When unset, the button falls back to `window.location.origin + BASE_URL + viorelvar-project.tar.gz` (which only works in local dev where the bundle is generated).

### Updating the downloadable bundle

When you cut a new release of the project source bundle:

1. Locally run `pnpm --filter @workspace/viorelvar-market run build` (without `SKIP_BUNDLE`) to regenerate `public/viorelvar-project.tar.gz`.
2. Create a new GitHub Release on `jeryyah/Dolpay` (e.g. `v1.1.0`) and upload the new tar.gz as a release asset.
3. Update `VITE_DOWNLOAD_URL` in `netlify.toml` to point at the new release URL, commit, push. Netlify auto-redeploys.

The local `artifacts/viorelvar-market/public/viorelvar-project.tar.gz` is gitignored so it never gets committed back to the repo.

## Recent Fixes

### Foto produk + varian gagal tersimpan (Apr 2026)

Bug: Saat admin menambah/mengedit produk dengan foto besar (kamera HP, biasanya 3–8MB),
upload base64-nya melewati kuota localStorage (~5MB), jadi `saveExtraProducts`
melempar `QuotaExceededError` tanpa pesan ke user.

Fix:
- Helper `compressImageFile` dipindah ke `src/lib/image-compress.ts` agar bisa dipakai bersama.
- `NewProductModal` & `EditProductModal` di `pages/admin.tsx` sekarang mengompres foto
  (max 720px, JPEG q=0.82) sebelum disimpan, sehingga blob akhir <120KB.
- `saveExtraProducts` & `saveProductOverrides` di `lib/storage.ts` pakai `safeSetItem` —
  drop cache prioritas rendah saat penuh, lalu lempar error yang ditangkap UI.
- Modal kini menampilkan banner merah "penyimpanan browser penuh" jika save gagal,
  dan tombol simpan di-disable selama foto sedang dikompres.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
