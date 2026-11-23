# Setup Node.js App — ERP pada adzr.my.id/erp

> Ditunda per 3 November 2026. Panduan ini menyimpan riwayat persiapan hosting; bukan konfigurasi kerja saat ini. URL lokal kembali ke root dan contoh environment produksi telah disesuaikan ke root. Ikuti [rencana penyelesaian rancangan](design-completion.md) untuk pekerjaan aktif.

Panduan ini mengikuti kolom Node.js version, Application mode, Application root, Application URL, Application startup file dan Environment variables yang dilaporkan pemilik hosting. Kolom tersebut cocok dengan [CloudLinux Node.js Selector](https://docs.cloudlinux.com/cloudlinuxos/lve_manager/#node-js-selector-client-plugin). Server hosting belum diakses atau diuji oleh Codex.

## Dua aplikasi

Gunakan versi Node yang sama untuk kedua aplikasi. Pilih Node **24.x jika tersedia**, atau **22.18+**. Source workspace ditempatkan di `/home/AKUN/enterprise-erp`, di luar `public_html`. Application root pada Selector relatif terhadap home akun; sesuaikan jika workspace diunggah ke nama direktori berbeda.

| Kolom panel | Frontend | API |
| --- | --- | --- |
| Node.js version | 24.x atau 22.18+ | Sama dengan frontend |
| Application mode | Production | Production |
| Application root | `enterprise-erp/apps/web` | `enterprise-erp/apps/api` |
| Application URL — domain | `adzr.my.id` | `adzr.my.id` |
| Application URL — path | `erp` | `erp-api` |
| Application startup file | `server.js` | `server.js` |

URL lengkapnya adalah `https://adzr.my.id/erp` dan `https://adzr.my.id/erp-api`. Jika panel menyediakan satu kolom URL lengkap, gunakan alamat lengkap tersebut. Jangan memilih domain root `/` untuk kedua aplikasi: root domain tetap menyajikan portfolio.

Kedua `server.js` sudah berada di source. Frontend memuat Next.js production build, API memuat hasil build `dist/main.js`. File startup bukan perintah `npm start`, dan bukan file TypeScript. Normal deployment dengan process manager biasa tetap dapat memakai script `start` lama.

## Environment frontend

Tambahkan satu variable per baris pada aplikasi frontend:

| Nama | Nilai |
| --- | --- |
| `NEXT_PUBLIC_BASE_PATH` | `/erp` |
| `NEXT_PUBLIC_DATA_MODE` | `live` |
| `API_URL` | `https://adzr.my.id/erp-api` |

Production mode mengatur `NODE_ENV=production`. Nilai ini dan environment frontend juga harus tersedia saat build di Terminal, bukan hanya saat Passenger menjalankan aplikasi.

## Environment API

| Nama | Nilai |
| --- | --- |
| `DATABASE_URL` | Koneksi PostgreSQL database ERP yang sudah dibuat |
| `JWT_SECRET` | Secret acak baru minimal 32 karakter |
| `FRONTEND_ORIGIN` | `https://adzr.my.id` |
| `SESSION_COOKIE_PATH` | `/erp` |
| `API_BASE_PATH` | `/erp-api` |

Gunakan nama lengkap database/user beserta prefix akun. Format koneksi:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD_URL_ENCODED@HOST:PORT/DB_NAME?schema=public
```

Host, port dan TLS mengikuti penyedia. Password yang mengandung karakter khusus harus di-percent-encode sesuai [format koneksi Prisma](https://www.prisma.io/docs/orm/reference/connection-urls). Secret dan koneksi cukup diisi privat di hosting.

Tidak perlu menetapkan `PORT=4010` agar frontend dapat mengakses API pada setup ini. [Passenger mengatur socket aplikasinya sendiri](https://www.phusionpassenger.com/docs/advanced_guides/in_depth/node/reverse_port_binding.html); port numerik dalam `listen()` tidak menjadi endpoint API yang dapat diasumsikan tersedia di localhost. Frontend menghubungi URL HTTPS API yang didaftarkan di panel.

Nest tetap memakai route internal `/api/...`. Middleware mount menghapus `/erp-api` jika Passenger meneruskannya, dan membiarkan `/api/...` jika Passenger sudah menghapus mount. Startup frontend memulihkan `/erp` hanya pada runtime Passenger jika prefix dihilangkan; prefix yang sudah ada tidak diduplikasi. Query string dan URL encoding dipertahankan.

Cookie login dikirim kepada browser lewat `/erp/api/...` dan memiliki Path `/erp`; frontend meneruskannya ke API melalui proxy. API URL yang tersedia secara publik tetap memerlukan autentikasi dan pemeriksaan Company/Role. Health endpoint saja bersifat publik; responsnya tidak membuktikan koneksi database berhasil.

## Upload, install dan build

1. Unggah paket source ERP, lalu ekstrak di **home akun**, misalnya `/home/iicxhwse`, sehingga terbentuk `/home/iicxhwse/enterprise-erp/package.json` dan dua `server.js` di root app yang didaftarkan. ZIP source memuat prefix `enterprise-erp/`; jangan mengekstraknya ke dalam `public_html` atau ke dalam folder `enterprise-erp` lagi. Paket mencakup manifest workspace, source dan migrasi, tanpa `.local`, `node_modules`, `.next`, `dist` atau `.env` aktual. Portfolio dan Gemilang tidak perlu dibuild ulang untuk langkah ini. Root app pada panel harus sama dengan penempatan source.
2. Setelah pendaftaran aplikasi, panel biasanya menampilkan perintah aktivasi environment Node. Salin perintah yang benar-benar diberikan panel ke **cPanel Terminal/SSH**, lalu pindah ke root workspace ERP, bukan hanya `apps/web`. Gunakan versi Node yang sama pada kedua aplikasi.
3. Pastikan `DATABASE_URL` tersedia untuk Prisma CLI di Terminal. Environment yang disimpan pada UI aplikasi belum tentu tersedia pada shell Terminal. Salah satu cara: buat `apps/api/.env` secara privat di hosting dan isi dari contoh produksi; Prisma membaca `.env` di lokasi schema, dan Nest membaca `.env` saat cwd-nya `apps/api`. File ini tetap di luar `public_html`. Jangan menyalin kredensial development lokal.
4. Dari `/home/AKUN/enterprise-erp`, jalankan:

```sh
npm run install:hosting
npm run db:generate
node node_modules/prisma/build/index.js migrate deploy --schema apps/api/prisma/schema.prisma
NODE_ENV=production NEXT_PUBLIC_BASE_PATH=/erp NEXT_PUBLIC_DATA_MODE=live API_URL=https://adzr.my.id/erp-api npm run build
```

`install:hosting` memasang dependency tiga workspace aplikasi beserta tool build TypeScript/Prisma, tanpa dependency lint/test milik root. Ini memakai opsi workspace resmi [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/) dan lockfile yang sama; tidak menonaktifkan lifecycle scripts atau pemeriksaan tipe production. Jalankan install dari workspace root supaya `@erp/shared` diselesaikan dari workspace. Tombol Run npm install pada masing-masing child app tidak menggantikan pemasangan workspace ini. Untuk development/CI yang menjalankan lint dan test, tetap gunakan `npm ci --include=dev`. Jangan menjalankan `db:migrate` atau `db:seed` development pada database hosting.

5. Pada database baru yang masih kosong, siapkan ADMIN pertama melalui Terminal yang sama:

```sh
NODE_ENV=production npm run db:bootstrap
```

Isi nama, email dan password yang diminta. Password disembunyikan dan wajib diganti pada login pertama. Perintah membuat tiga Company fiktif kosong, bukan transaksi demo. Pengulangan pada instalasi yang sudah memiliki User/Company ditolak tanpa perubahan. Lihat [penyiapan ADMIN pertama](initial-installation.md).

6. Sesudah build dan setup berhasil, Restart aplikasi API dan frontend melalui panel. Migrations/build/setup dijalankan secara terpisah, bukan otomatis pada setiap startup worker.

Jika Terminal/SSH tidak tersedia, penyedia perlu menyediakan cara menjalankan perintah workspace dan migrasi tersebut. Membuat aplikasi Node di panel saja belum menginstal workspace, menghasilkan Prisma Client atau membuild frontend/API.

## Jika npm ci berhenti dengan Killed

Laporan operator: environment Node 24.21.0/npm 11.19.0 aktif, perintah dijalankan dari root workspace yang benar, tetapi `npm ci --include=dev` dihentikan dengan `Killed`. `prisma: command not found` pada langkah berikutnya merupakan akibat install yang belum selesai; koneksi database dan migrasi belum dapat dinilai dari error tersebut.

Pesan `Killed` menunjukkan proses dihentikan dari luar, tetapi tidak membuktikan sendiri jenis batas yang terlampaui. Pada [CloudLinux](https://docs.cloudlinux.com/cloudlinuxos/limits/), melewati PMEM dapat menyebabkan proses dalam akun dihentikan dan counter fPMEM bertambah. Periksa **cPanel → Resource Usage → Details** untuk batas Physical Memory/PMEM dan faults pada waktu kegagalan. Batas akun lebih relevan daripada angka RAM seluruh server dari `free`.

Pemilik melaporkan PMEM **756 MB**, pemakaian saat dilihat **15,53 MB**, NPROC **9/50**, Entry Processes **1/25**, dan kolom Fault `-`. Angka pemakaian saat ini bukan peak install dan kolom tersebut belum mengonfirmasi alasan kill. Percobaan berikutnya kembali `Killed`, exit **137**, dengan opsi salah ketik `--foreground--scripts` dan `--maxsocket=1`. Kesalahan ejaan bukan bukti penyebab SIGKILL.

Percobaan awal disebut berlangsung berjam-jam. Cuplikan log yang kemudian dibagikan hanya berisi baris `http cache ... 0ms (cache hit)`, termasuk dependency lint/test seperti ESLint dan jsdom. Baris itu tidak menunjukkan error, retry download atau install selesai. Waktu pada baris cache juga bukan durasi keseluruhan install. Alasan proses dihentikan masih memerlukan log/counter server; jangan menganggap download bermasalah dari cuplikan ini.

### Pembaruan dependency khusus hosting

Source sekarang menyediakan `install:hosting`: hanya workspace `@erp/shared`, `@erp/api`, `@erp/web`, dengan `--include-workspace-root=false`. TypeScript dan tipe Node dideklarasikan langsung pada setiap workspace yang memerlukannya; versi dan integrity paket tetap mengikuti lockfile semula. Build frontend mengecualikan folder `test`; konfigurasi test terpisah tetap mengompilasi dan menguji folder itu. Root dependency lint/test tetap ada untuk development.

Untuk source yang sudah diunggah, gunakan paket **`enterprise-erp-hosting-install-update-20261022.zip`** di `artifacts/deploy`. Paket pembaruan ini hanya memuat manifest, lockfile, konfigurasi TypeScript frontend dan dokumentasi. Tidak ada `.env`, dependency, engine native atau hasil build. Ekstrak ke **`/home/iicxhwse`**, gabungkan ke folder `enterprise-erp` yang ada dan izinkan overwrite file di dalam paket; jangan mengekstraknya satu tingkat lebih dalam. Environment privat hosting tetap di file/konfigurasi yang sudah dibuat.

Hentikan sementara hanya dua aplikasi ERP melalui **Stop App**. Dengan environment Node tetap aktif, lakukan satu percobaan yang memakai dependency lebih sedikit:

```sh
cd /home/iicxhwse/enterprise-erp
NODE_OPTIONS="--max-old-space-size=256" npm run install:hosting
echo $?
```

Heap V8 bukan seluruh RSS atau total PMEM akun. Native memory, buffers dan proses lain tetap memakai RAM tambahan. Assignment ini hanya untuk install; jangan memasangnya secara permanen pada panel atau menganggap batas ini sesuai untuk build Next.js. Script memakai `--foreground-scripts` yang benar dan tidak membatasi download menjadi satu socket. Menurut [konfigurasi npm](https://docs.npmjs.com/cli/v11/using-npm/config/), `maxsockets` membatasi koneksi jaringan per origin, bukan semua aktivitas ekstraksi/worker.

Lanjutkan `db:generate` dan langkah migrasi/build di atas **hanya setelah exit code 0**. Jika kembali `Killed`/137, jangan mengulang install yang sama. Catat waktu kejadian, tahap terakhir dan resource faults, lalu minta penyedia memeriksa log kill/LVE serta kecukupan limit untuk install, build dan dua proses runtime ERP. [Debug logs npm](https://docs.npmjs.com/cli/v11/using-npm/logging/) berada di `_logs` pada cache aktif; pilih log bertajuk `npm ci`, karena perintah lain juga menulis log. Samarkan secret sebelum membagikan log. Tidak perlu menghapus lockfile/cache atau menginstal Prisma secara global.

Opsi ini telah diuji pada salinan source bersih di Windows, Node 26/npm 11.20: install offline mencatat exit 0 dan 305 paket, tanpa ESLint/jsdom dari root. Prisma Client dibuat dengan engine lokal versi 6.19.0 yang sama karena download engine pada lingkungan uji tidak tersedia. Build shared/Next.js/NestJS berhasil dengan pemeriksaan TypeScript aktif; pemeriksaan artefak `/erp` juga berhasil untuk 54 halaman prerender, tautan/aset/redirect dan proxy HTTPS API yang tepat. Lint, typecheck dan 40 test development lulus. Uji lokal tersebut tidak membuktikan download engine Linux, kecukupan PMEM 756 MB, atau keberhasilan install pada Node 24/Passenger hosting.

Jika batas hosting memang tidak cukup dan tidak dapat disesuaikan, proses build/deployment perlu dirancang ulang berdasarkan kemampuan runtime yang dikonfirmasi. Dukungan menu Node.js saja belum membuktikan kapasitas untuk build dan menjalankan dua aplikasi ERP. Root cause, batas aktual, dan keberhasilan install hosting masih belum terverifikasi.

### Hasil percobaan hosting dan eskalasi

Pemilik kemudian menjalankan `NODE_OPTIONS="--max-old-space-size=256" npm run install:hosting`. Output menampilkan opsi workspace yang diharapkan dan `--foreground-scripts` yang benar, tetapi proses kembali `Killed` dengan 137 dilaporkan. Pembaruan dependency belum menyelesaikan kegagalan pada hosting. Jangan mengulang perintah yang sama atau melanjutkan Prisma/migrasi/build sebelum install berhasil.

Kirim permintaan berikut kepada penyedia melalui kanal support yang biasa digunakan, dengan waktu kejadian beserta zona waktunya:

> Pada akun iicxhwse, `npm ci` untuk workspace Next.js/NestJS berulang kali dihentikan dengan `Killed`/exit 137. Node 24.21.0, npm 11.19.0, batas PMEM 756 MB. Percobaan terbaru memakai `NODE_OPTIONS="--max-old-space-size=256" npm run install:hosting`, mengecualikan dependency lint/test root dan menampilkan lifecycle scripts. Mohon periksa log OOM/SIGKILL dan LVE pada waktu kejadian, termasuk proses yang dihentikan, peak PMEM, fPMEM, VMEM dan NPROC. Apakah penyebabnya limit akun atau kebijakan lain? Jika limit akun, apakah dapat disesuaikan untuk install/build dan apakah paket mendukung dua aplikasi Node (Next.js dan NestJS) berjalan bersamaan?

Jangan menganggap PMEM 756 MB sebagai penyebab pasti tanpa bukti server. Jika provider mengonfirmasi limit, tentukan penyesuaian resource dari data mereka. Build pada Linux terpisah dapat mengurangi kebutuhan resource saat build di hosting, tetapi tidak menyelesaikan limit runtime dan memerlukan kecocokan artefak dengan Linux hosting. Belum ada build Linux/deployment jarak jauh yang disiapkan atau diverifikasi. Bagian ini ditambahkan setelah ZIP pembaruan dibuat; ZIP dan manifest sebelumnya tetap tidak diubah.

## Pemeriksaan sebelum dibuka untuk pengguna

- `https://adzr.my.id/erp-api/api/health` memberikan respons API.
- `https://adzr.my.id/erp/api/health` memberikan respons API lewat proxy Next.
- `https://adzr.my.id/erp/login` memuat HTML, JS/CSS dan dapat direfresh.
- `/` serta `/gemilang/` tetap menampilkan aplikasi yang sudah ada.
- Jalankan `db:bootstrap` sekali pada instalasi kosong sebelum menguji login. Migrasi hanya membuat schema; seed development tetap ditolak dalam mode produksi. Tidak ada akun demo dengan password publik pada instalasi baru.
- Setelah akun awal tersedia, periksa login, Company switching, CRUD yang diizinkan, logout dan cookie Secure/HttpOnly/Path `/erp` melalui HTTPS.

Startup frontend dan mount API ini merupakan persiapan source untuk panel yang dilaporkan. Passenger/Linux dan hosting publik belum diverifikasi. Pengujian produksi Next lokal sebelumnya ditolak kebijakan persetujuan lingkungan; build dan tes fungsi tidak menggantikan smoke test pada panel sebenarnya. Catat log aplikasi ketika langkah instalasi/build/start gagal, dengan nilai secret disamarkan.

Jika routing/aset gagal, hentikan hanya dua aplikasi ERP dan pulihkan konfigurasi mount/build yang disimpan. Portfolio/Gemilang tetap dikelola terpisah. Jangan mereset database untuk menyelesaikan masalah routing. Panduan umum: [deployment subfolder](deployment-subpath.md).
