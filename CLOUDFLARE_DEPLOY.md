# Deploy Viorelvar Market ke Cloudflare Pages

Panduan setup Cloudflare Pages dari repo GitHub `jeryyah/Dolpay`, lengkap
dengan Cloudflare KV untuk fitur Live Chat dan Cross-Device Sync.

## 1. Buat KV namespace dulu

Live Chat (`/api/chat`) dan sync data antar perangkat (`/api/sync`) butuh
penyimpanan. Di Cloudflare pakai KV.

1. Login ke <https://dash.cloudflare.com/>.
2. Sidebar → **Workers & Pages** → **KV**.
3. Klik **Create a namespace**.
4. Beri nama bebas, contoh: `viorelvar-store`.
5. Salin **Namespace ID** (akan dipakai saat binding di langkah 3).

## 2. Buat project Pages

1. Sidebar → **Workers & Pages** → **Create application** → tab **Pages** →
   **Connect to Git**.
2. Authorize GitHub, pilih repo **`jeryyah/Dolpay`** → **Begin setup**.
3. Isi build settings:

| Field | Value |
| --- | --- |
| Project name | `viorelvar-market` (bebas) |
| Production branch | `main` |
| Framework preset | **None** |
| Build command | `pnpm install --no-frozen-lockfile && BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/viorelvar-market run build` |
| Build output directory | `artifacts/viorelvar-market/dist/public` |
| Root directory | *(kosongkan)* |

4. **Environment variables** (klik **Add variable**):

| Name | Value |
| --- | --- |
| `NODE_VERSION` | `24` |
| `PNPM_VERSION` | `10.26.1` |
| `VITE_DOWNLOAD_URL` | `https://github.com/jeryyah/Dolpay/releases/download/v1.0.0/viorelvar-project.tar.gz` |

5. Klik **Save and Deploy**. Tunggu build pertama (~2–4 menit).

## 3. Bind KV namespace ke Pages

Tanpa binding ini, `/api/chat` dan `/api/sync` akan error 500.

1. Buka project Pages yang baru dibuat → tab **Settings** → **Functions**
   (atau **Bindings** di UI baru).
2. Scroll ke **KV namespace bindings** → **Add binding**.
3. Isi:
   - **Variable name:** `STORE` (harus persis ini, sudah dipakai di code)
   - **KV namespace:** pilih `viorelvar-store` yang dibuat di langkah 1.
4. Save. Cloudflare akan me-redeploy otomatis dalam ~30 detik.

## 4. Selesai

Situs hidup di `https://<project-name>.pages.dev`. Tiap push ke `main` di
GitHub akan auto-rebuild & redeploy.

Verifikasi:

- `https://<domain>/admin` — buka admin panel, pastikan kategori cuma
  `APKMOD` & `ROOT`.
- `https://<domain>/api/sync` — harusnya return JSON `{}` (kosong, tapi
  bukan 500). Kalau error, cek binding KV.
- Buka 2 tab/perangkat → tambah produk di admin → pastikan muncul juga di
  perangkat lain dalam 1–2 detik.

## Custom domain

Tab **Custom domains** di project Pages → tambahkan domain milikmu →
ikuti instruksi DNS-nya.

## File-file yang sudah disiapkan di repo

- `functions/api/chat.ts` — Cloudflare Pages Function untuk live chat.
- `functions/api/sync.ts` — Cloudflare Pages Function untuk sync data.
- `artifacts/viorelvar-market/public/_redirects` — SPA fallback routing.
- `artifacts/viorelvar-market/public/_headers` — cache header untuk aset.

> Catatan: file `netlify/functions/*` dan `netlify.toml` masih di repo —
> dipertahankan biar Netlify tetap bisa kamu pakai sebagai backup. Tidak
> dipakai oleh Cloudflare.
