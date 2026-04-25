# Deploy Viorelvar Market ke Cloudflare Pages

Panduan singkat untuk men-deploy proyek ini ke Cloudflare Pages dari repo
GitHub `jeryyah/Dolpay`.

## 1. Login & buat project

1. Login ke <https://dash.cloudflare.com/>.
2. Pilih **Workers & Pages** → **Create application** → tab **Pages** →
   **Connect to Git**.
3. Pilih GitHub, authorize Cloudflare, pilih repo **`jeryyah/Dolpay`** →
   **Begin setup**.

## 2. Build settings

| Field | Value |
| --- | --- |
| Project name | `viorelvar-market` (atau apa saja) |
| Production branch | `main` |
| Framework preset | **None** |
| Build command | `pnpm install --no-frozen-lockfile && BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/viorelvar-market run build` |
| Build output directory | `artifacts/viorelvar-market/dist/public` |
| Root directory | *(kosongkan, biarkan default)* |

## 3. Environment variables

Klik **Add variable** dan tambahkan:

| Name | Value |
| --- | --- |
| `NODE_VERSION` | `24` |
| `PNPM_VERSION` | `10.26.1` |
| `VITE_DOWNLOAD_URL` | `https://github.com/jeryyah/Dolpay/releases/download/v1.0.0/viorelvar-project.tar.gz` |

## 4. Deploy

Klik **Save and Deploy**. Build pertama sekitar 2–4 menit.
Setelah selesai, situsmu hidup di `https://<project-name>.pages.dev`.

Tiap kali kamu push ke branch `main` di GitHub, Cloudflare akan otomatis
re-build & re-deploy.

## Catatan

- File `_redirects` dan `_headers` sudah disiapkan di
  `artifacts/viorelvar-market/public/`, jadi SPA routing dan caching aset
  langsung jalan.
- Fitur live chat & cross-device sync (`/api/chat`, `/api/sync`) saat ini
  pakai Netlify Functions. Di Cloudflare, endpoint itu belum tersedia,
  jadi fitur tersebut perlu di-port ke Cloudflare Pages Functions kalau
  mau dipakai. Storefront, admin panel, dan katalog produk tetap jalan
  normal tanpa itu.
- Custom domain bisa ditambahkan dari tab **Custom domains** project Pages.
