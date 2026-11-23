# Pemeriksaan portfolio dan persiapan hosting ERP

Tanggal: 22 Oktober 2026. Sumber diperiksa secara read-only di `PROJECT/portfolio`. Tidak ada koneksi ke server hosting, upload, perubahan portfolio, atau pembacaan `.env`, konfigurasi koneksi lokal, password maupun data pribadi.

Pembaruan pemilik: database/user PostgreSQL sudah dibuat, dan kolom panel Node yang diberikan cocok dengan Setup Node.js App. Lanjutkan dengan [panduan pengisian panel Passenger](cpanel-nodejs.md). Hubungan user/database, koneksi serta hak migrasi belum diuji di server.

## Hasil pemeriksaan lokal

| Bagian | Bukti lokal | Implikasi |
| --- | --- | --- |
| Portfolio utama | [package.json](../../portfolio/package.json), [astro.config.mjs](../../portfolio/astro.config.mjs) dan [README](../../portfolio/README.md) | Astro statis, hasil build `dist/`, domain `https://adzr.my.id`. Tidak memerlukan proses Node produksi untuk menyajikan halaman statisnya. |
| Gemilang | [panduan cPanel](../../portfolio/hosting/PANDUAN-CPANEL.md) dan [API PHP](../../portfolio/hosting/gemilang-private/api.php) | Aplikasi terpisah memakai PHP/PDO dan MySQL/MariaDB. Konfigurasi privat berada di luar `public_html`. Database ini tetap dapat dipakai oleh Gemilang. |
| Deployment yang didokumentasikan | [panduan deploy](../../portfolio/hosting/PANDUAN-DEPLOY.md) | Menggunakan cPanel dan SFTP. Nama penyedia dan konfigurasi server aktif belum diverifikasi. |
| Skrip deploy Gemilang | [deploy-gemilang.mjs](../../portfolio/scripts/deploy-gemilang.mjs) | Daftar upload dibatasi ke backend, halaman dan aset Gemilang; tidak mencakup ERP. Jangan menggunakan perintah ini sebagai deployment ERP. |
| ERP | [schema.prisma](../apps/api/prisma/schema.prisma) dan [next.config.ts](../apps/web/next.config.ts) | PostgreSQL, NestJS API dan Next.js. Jalur `/erp` telah disiapkan melalui konfigurasi build; tidak cukup dengan menyalin folder ERP ke `dist/`. |

Tidak ditemukan konfigurasi routing tingkat domain di sumber portfolio yang diperiksa. `.htaccess` endpoint Gemilang hanya mengatur direktori/headers, bukan routing `/erp`. Aturan yang sudah ada pada server dapat berbeda dan harus diperiksa saat deployment.

## Database yang perlu dibuat

phpMyAdmin mengelola MySQL/MariaDB; phpPgAdmin mengelola PostgreSQL. phpPgAdmin adalah antarmuka administrasi, bukan database atau akun layanan ERP. Untuk ERP diperlukan **database PostgreSQL dan user/role PostgreSQL yang dapat login dan memiliki akses ke database tersebut**. User PostgreSQL berbeda dari user MySQL, akun cPanel dan User yang login ke ERP.

Pada cPanel, buat database/user melalui **PostgreSQL Database Wizard** atau **PostgreSQL Databases**, bukan melalui phpPgAdmin. Ini sesuai [petunjuk resmi cPanel](https://docs.cpanel.net/cpanel/databases/postgresql-databases/). phpPgAdmin dapat digunakan sesudahnya untuk memeriksa tabel; pemasangannya tidak menjadi syarat runtime ERP.

Langkah pemilik hosting:

1. Buka cPanel → **PostgreSQL Database Wizard**. Jika menu tidak tersedia, minta penyedia mengaktifkan PostgreSQL untuk paket/akun ini; kehadiran phpMyAdmin tidak membuktikan PostgreSQL tersedia.
2. Buat database khusus, misalnya `erp`, lalu user khusus, misalnya `erp_app`, dengan password acak. Catat nama lengkap yang diberi panel, termasuk prefix akun. Nama contoh tersebut bukan database yang sudah dibuat.
3. Selesaikan hubungan user ke database pada Wizard. Jika menggunakan menu terpisah **PostgreSQL Databases**, lakukan **Add User to Database**. [Wizard cPanel](https://docs.cpanel.net/cpanel/databases/postgresql-database-wizard/) mengatur akses pada langkah terakhirnya.
4. Catat host, port, nama database, nama user, versi PostgreSQL dan persyaratan TLS dari penyedia. Jangan mengasumsikan port lokal pengembangan `55432` berlaku di hosting.
5. Masukkan koneksi secara privat ke `DATABASE_URL` pada environment API/migrasi. Gunakan format PostgreSQL dan percent-encode karakter khusus pada username/password sesuai format URL; jangan menggunakan DSN `mysql:` milik Gemilang.

Contoh format, seluruh nilai adalah placeholder:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD_URL_ENCODED@HOST:PORT/DB_NAME?schema=public
```

Tambahkan parameter TLS sesuai penyedia. Password cukup disimpan di pengaturan hosting/password manager, tidak perlu dikirim melalui chat. Ketiga Company ERP memakai **satu database ERP** dengan pembatasan akses Company di aplikasi; tidak perlu membuat database per Company.

Migrasi ERP membuat tabel, index, foreign key, fungsi PL/pgSQL dan constraint trigger. User yang menjalankan migrasi harus diizinkan membuat objek tersebut di schema `public` serta mengelola objek migrasinya sendiri. User yang hanya dapat login atau membaca tabel belum cukup. Ketersediaan dan hak akses ini belum diuji di hosting. Tidak ada perintah pemasangan extension atau permintaan superuser pada migrasi yang diperiksa.

## Penempatan aplikasi

Susunan target berikut adalah rancangan, bukan keadaan server yang sudah diverifikasi:

```text
/home/AKUN/
  public_html/                  portfolio Astro yang sudah ada
    gemilang/                   halaman Gemilang
    api/gemilang/               entry point PHP Gemilang
  gemilang-private/             backend/konfigurasi Gemilang yang sudah ada
  enterprise-erp/               workspace ERP, di luar document root
    apps/web/                   proses Next.js
    apps/api/                   proses NestJS
    packages/shared/
```

| URL publik | Layanan |
| --- | --- |
| `/` dan halaman portfolio | File statis Astro |
| `/gemilang/` dan `/api/gemilang/` | Gemilang yang sudah ada |
| `/erp` dan seluruh child path | Next.js ERP, prefix `/erp` dipertahankan |
| `/erp/api/...` | Next.js meneruskan ke NestJS `/api/...` |

Sumber ERP tidak perlu dipindahkan ke folder sumber portfolio. Panel/proxy menghubungkan URL `/erp` dengan proses aplikasi. Sebelum memilih startup file, pastikan apakah hosting menggunakan **Application Manager/Passenger**, **Setup Node.js App**, atau perintah/proses biasa. [Application Manager cPanel](https://docs.cpanel.net/cpanel/software/application-manager/) memiliki pengaturan domain, Base Application URL, Application Path dan environment, tetapi kontrak startup/port server ini belum diketahui.

ERP saat ini membutuhkan **dua proses Node**. Pastikan batas aplikasi, versi Node (proyek menggunakan tooling Node 22.18+), metode startup, dukungan npm workspace/build Prisma dan koneksi antara Next.js dan API. Passenger dapat memakai mekanisme port/socket sendiri; jangan langsung mengisi port numerik contoh sebelum model hosting jelas. Belum ada adapter Passenger khusus yang dinyatakan teruji.

## Urutan setelah database siap

1. Verifikasi model startup/routing dengan penyedia, termasuk dua proses Node dan prefix `/erp` yang dipertahankan. Informasi yang masih diperlukan hanya nama penyedia dan jenis menu Node yang tersedia; kredensial tidak diperlukan untuk menentukan langkah ini.
2. Pasang source ERP dan dependency untuk sistem operasi hosting di luar `public_html`.
3. Atur environment produksi sesuai [panduan subfolder](deployment-subpath.md): `NEXT_PUBLIC_BASE_PATH=/erp`, `NEXT_PUBLIC_DATA_MODE=live`, `FRONTEND_ORIGIN=https://adzr.my.id`, `SESSION_COOKIE_PATH=/erp`, koneksi PostgreSQL dan JWT secret baru. `API_URL` harus menunjuk API yang benar-benar dapat dijangkau dari proses Next.js.
4. Jalankan Prisma `migrate deploy` dan build menggunakan environment hosting. Rebuild frontend dengan alamat API hosting; artefak verifikasi lokal sebelumnya memakai API sementara dan tidak boleh dianggap paket hosting siap upload.
5. Setelah build, jalankan [setup ADMIN pertama](initial-installation.md), `NODE_ENV=production npm run db:bootstrap`, langsung di Terminal pada instalasi yang belum memiliki User/Company. Skrip seed pengembangan tetap menolak mode produksi. Setup privat meminta password sendiri dan menyiapkan tiga Company fiktif kosong, tanpa transaksi demo.
6. Jalankan frontend/API, lalu periksa HTTPS, refresh deep link, aset, login/logout, Company Switcher, serta akses portfolio dan Gemilang. Setelah route ERP tersedia, tautan demo portfolio dapat diarahkan ke `/erp` melalui data project Astro.

Saat pemeriksaan ini hanya dokumentasi ERP yang diperbarui. Website publik, database hosting dan source portfolio tidak diubah. Build `/erp` serta pemeriksaan runtime development lokal sudah lulus; startup produksi lokal sebelumnya ditolak kebijakan persetujuan lingkungan, sehingga pengujian runtime produksi dan konfigurasi host tetap belum terverifikasi.
