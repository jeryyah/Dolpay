# Deploy Dolpay (Viorelvar Market) ke Railway

Panduan langkah-demi-langkah deploy proyek `jeryyah/Dolpay` ke
[Railway](https://railway.app). Hasil akhirnya: situs hidup di domain
`*.up.railway.app` (atau custom domain milikmu) dengan fitur Live Chat
& cross-device sync yang persisten antar restart.

> **Beda dari Netlify / Cloudflare Pages?**
> Railway menjalankan **satu proses Node.js** yang melayani sekaligus:
> - file static frontend (`viorelvar-market` build)
> - endpoint `/api/chat` & `/api/sync`
>
> Storage untuk chat & sync pakai **file JSON di disk** (folder `/data`),
> jadi kita perlu **Volume** Railway supaya data tidak hilang saat redeploy.

---

## Prasyarat

- Akun Railway (login pakai GitHub paling mudah).
- Repo `jeryyah/Dolpay` sudah include semua file dari folder
  `dolpay-railway-patch/` (lihat bagian **Cara apply patch** di bawah).

---

## Cara apply patch ke repo Dolpay

Folder `dolpay-railway-patch/` berisi semua file baru/ganti yang dibutuhkan.
Strukturnya **persis sama** dengan struktur repo Dolpay, jadi kamu tinggal
copy semua isinya ke root repo (overwrite file lama yang ada).

File yang akan dibuat/diganti:

| Path | Aksi | Fungsi |
| --- | --- | --- |
| `Dockerfile` | **baru** | Build & runtime image untuk Railway |
| `.dockerignore` | **baru** | Skip file yang tidak perlu masuk image |
| `railway.json` | **baru** | Config Railway (builder + healthcheck) |
| `RAILWAY_DEPLOY.md` | **baru** | File ini |
| `artifacts/api-server/src/app.ts` | **ganti** | Tambah static serve + SPA fallback |
| `artifacts/api-server/src/routes/index.ts` | **ganti** | Daftarkan route chat & sync |
| `artifacts/api-server/src/routes/chat.ts` | **baru** | Live chat backend |
| `artifacts/api-server/src/routes/sync.ts` | **baru** | Cross-device sync backend |
| `artifacts/api-server/src/lib/store.ts` | **baru** | File-based JSON KV store |

Cara cepat (lokal di komputermu):

```bash
git clone https://github.com/jeryyah/Dolpay.git
cd Dolpay

# salin semua isi patch ke root repo
cp -r /path/ke/dolpay-railway-patch/. .

git add .
git commit -m "chore: add Railway deployment setup"
git push origin main
```

---

## Setup di Railway (sekali saja)

### 1. Buat project baru

1. Buka <https://railway.app/new> → **Deploy from GitHub repo**.
2. Authorize Railway ke akun GitHub-mu (kalau belum).
3. Pilih repo **`jeryyah/Dolpay`**.
4. Railway akan auto-detect `Dockerfile` di root → klik **Deploy**.

Build pertama makan waktu **3–6 menit** (install + build frontend + build server).

### 2. Set environment variables

Buka tab **Variables** project Railway-mu, tambahkan:

| Name | Value | Wajib? |
| --- | --- | --- |
| `NODE_ENV` | `production` | ✅ |
| `PORT` | `8080` | ✅ (Railway juga otomatis set, tapi aman ditulis) |
| `DATA_DIR` | `/data` | ✅ |
| `STATIC_DIR` | `/app/public` | ✅ |
| `VITE_DOWNLOAD_URL` | `https://github.com/jeryyah/Dolpay/releases/download/v1.0.0/viorelvar-project.tar.gz` | opsional |

> `VITE_DOWNLOAD_URL` cuma dipakai saat **build** (Vite inline-kan ke
> bundle JS). Kalau berubah, harus trigger **rebuild** (bukan cuma restart).

### 3. Tambah Volume (PENTING — jangan dilewat)

Tanpa volume, semua data chat & sync hilang setiap kali Railway redeploy
(misal habis push commit baru).

1. Tab **Settings** → scroll ke **Volumes** → klik **+ Add Volume**.
2. **Mount path:** `/data`
3. **Size:** 1 GB cukup banget (chat + sync biasanya <50 MB).
4. Klik **Add**. Railway akan auto-restart service dengan volume terpasang.

### 4. Generate domain publik

1. Tab **Settings** → **Networking** → klik **Generate Domain**.
2. Railway kasih domain gratis: `dolpay-production.up.railway.app` (atau
   sejenisnya).
3. Mau pakai custom domain? Klik **+ Custom Domain**, ikuti instruksi DNS-nya.

---

## Verifikasi

Buka beberapa URL untuk pastikan semua hidup:

- `https://<domainmu>/` — landing page Viorelvar Market.
- `https://<domainmu>/admin` — panel admin (login dulu).
- `https://<domainmu>/api/healthz` — harusnya return `{"status":"ok"}`.
- `https://<domainmu>/api/sync` — harusnya return JSON `{}` (kosong, **bukan** 500).
- `https://<domainmu>/api/chat` — harusnya return JSON `{}`.

Test cross-device sync:

1. Buka 2 tab/perangkat.
2. Login admin di tab A → tambah produk baru.
3. Tab B (sebagai pengguna) → produk baru muncul dalam ~1–2 detik.

Test live chat:

1. Tab pengguna → buka chat, kirim pesan.
2. Tab admin → pesan masuk di inbox dalam ~1–2 detik.

---

## Auto-deploy

Setiap `git push` ke branch `main` akan otomatis trigger build & deploy
ulang di Railway. Build progress + log bisa dilihat di tab **Deployments**.

---

## Update bundle download

Tombol "Download Project" di admin panel pakai `VITE_DOWNLOAD_URL`. Cara
update:

1. Cut release baru di GitHub (misal `v1.1.0`), upload `viorelvar-project.tar.gz`.
2. Update `VITE_DOWNLOAD_URL` di **Variables** Railway → simpan.
3. Klik **Deployments** → **Redeploy** (karena variable build-time).

---

## Troubleshooting

**Build gagal di step `pnpm install`**
→ Pastikan `pnpm-lock.yaml` ter-commit ke repo. Kalau lockfile drift,
hapus dulu dari repo lalu push ulang biar regenerate.

**`/api/sync` return 500**
→ Cek tab **Logs**. Biasanya karena volume belum di-mount. Pastikan
`DATA_DIR=/data` & volume sudah dipasang di mount path `/data`.

**Halaman blank atau 404 di `/admin`**
→ SPA fallback nggak jalan. Pastikan `STATIC_DIR=/app/public` dan
build frontend sukses (cek `Build Logs` ada baris
`Built artifacts/viorelvar-market/dist/public`).

**Memory limit kena (OOM)**
→ Plan free Railway 512 MB. Kalau OOM saat build, upgrade ke Hobby
plan ($5/bln) atau aktifkan **Build only** image dengan resource
lebih besar di Settings.

**Data hilang setiap deploy**
→ Volume belum nempel. Ulangi langkah **3. Tambah Volume**, pastikan
mount path tepat `/data`.

---

## File-file lama (Netlify/Cloudflare) — biarkan saja

`netlify.toml`, `netlify/functions/*`, `functions/api/*`, dan
`CLOUDFLARE_DEPLOY.md` tidak dipakai Railway. Aman dibiarkan di repo —
kalau suatu saat mau balik ke Netlify atau Cloudflare, tinggal connect
repo-mu ke service-nya.
