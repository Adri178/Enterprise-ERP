# Penyelesaian rancangan Enterprise ERP

> Prioritas terbaru: fungsionalitas sistem dan web desktop didahulukan. Mobile akan dibuat terpisah oleh pemilik project; review visual mobile ditunda. Ikuti [roadmap fungsional](functional-roadmap.md). Attendance dan RFQ sudah memiliki backend operasional; rincian di bawah yang menyebut data browser berlaku pada mode demo.

Keputusan 3 November 2026: fokus pada rancangan UI/UX dan alur aplikasi lokal. Deployment ditunda. Backend, database, aturan Company, dan workflow yang sudah dibuat tetap dipertahankan.

## URL dan preview

| Kebutuhan | URL |
| --- | --- |
| Entry | `http://localhost:3000/` → `/dashboard` |
| Dashboard | `http://localhost:3000/dashboard` |
| Company | `http://localhost:3000/companies` |
| Suppliers | `http://localhost:3000/suppliers` |
| Purchase Order | `http://localhost:3000/purchase-orders` |
| Journal Entries | `http://localhost:3000/journal-entries` |
| API melalui frontend, mode live | `http://localhost:3000/api/...` |
| NestJS lokal, mode live | `http://127.0.0.1:4010/api/...` |

Tidak memakai prefix `/erp` atau `/erp-api` pada konfigurasi kerja lokal. `NEXT_PUBLIC_BASE_PATH` dan `API_BASE_PATH` kosong; cookie session memakai Path `/`. Dukungan subpath opsional tetap ada, tetapi bukan konfigurasi kerja saat ini. Contoh environment produksi juga kembali ke root; panduan subfolder/cPanel lama merupakan catatan deployment yang ditunda.

```sh
npm run dev:design
```

Perintah tersebut membuild shared package, lalu membuka Next.js development pada loopback port 3000 dengan data demo dan URL root, tanpa membutuhkan database. Override hanya berlaku pada child process: `.env.local` dan mode live biasa tidak ditimpa. Gunakan Ctrl+C untuk menghentikannya. Jika port 3000 sudah dipakai preview lain, hentikan preview tersebut terlebih dahulu.

Preview memakai tiga Company fiktif dan localStorage browser. CRUD katalog dan draft demo berbeda dari workflow database. Accounting, HR, Manufacturing dan fitur live tertentu menampilkan batasan demo; halaman yang memerlukan API tidak menjadi operasional hanya karena preview berjalan. `npm run dev` dan `npm run dev:api` tetap tersedia untuk pemeriksaan live dengan PostgreSQL lokal.

## Dasar rancangan

- Workspace enterprise yang tenang: sidebar tetap, header ringkas, hierarki teks jelas, tabel padat tetapi terbaca, satu warna aksen hijau, dan panel untuk kelompok informasi yang bermakna.
- Konten dimulai dari Company aktif, judul, aksi utama, filter dan data. Tidak menambahkan hero pemasaran pada halaman operasional.
- Interaksi memakai navigasi aktif, dropdown Company, pencarian global, drawer sidebar mobile dan dialog form/detail. Transisi singkat mendukung orientasi; hormati reduced motion.
- Sebelas nama navigasi utama tetap mengikuti permintaan awal. Tindakan/status menggunakan Bahasa Indonesia dan enterprise nouns tetap dalam English melalui dictionary bersama.

## Status halaman rancangan

Shell, Dashboard, Company/katalog dan halaman domain utama sudah memiliki komponen khusus. Workflow backend yang telah diuji tidak perlu dibuat ulang untuk menyelesaikan UI. Pemeriksaan ini adalah pembacaan source dan status implementasi, bukan klaim audit visual desktop/mobile selesai.

Tiga route yang sebelumnya memakai `DocumentPage` generik sekarang memiliki halaman domain khusus. Semuanya menggunakan fixture demo, bukan data operasional dari API:

| Route | Interaksi rancangan yang tersedia | Batas fungsi saat ini |
| --- | --- | --- |
| `/leads` | Form kontak/organisasi, penanggung jawab, sumber, potensi, detail, pipeline Baru → Dihubungi → Memenuhi Kriteria atau Tidak Dilanjutkan, edit/hapus dengan konfirmasi, tautan Quotations | Belum mengonversi Lead menjadi Customer atau Quotation; backend CRM belum ada |
| `/requests-for-quotation` | Mode demo memakai contoh terpisah. Mode live memakai Purchase Request/Supplier riil, penawaran lengkap, perbandingan, Approval User lain, pembatalan, audit, ekspor dan pembuatan Purchase Order | Email/portal Supplier, attachment dan pemilihan sebagian Items belum tersedia; lihat [RFQ](rfq.md) |
| `/attendance` | Mode demo memakai contoh terpisah. Mode live sekarang memakai Employee riil, database, list/filter/form/detail, audit koreksi, dan validasi Leave Approval | Shift lintas malam, kalender Attendance dan payroll belum tersedia; lihat [Attendance](attendance.md) |

List prototipe menggunakan TanStack Table: pencarian, filter status, sorting, pagination, empty/loading/error state dan ekspor CSV seluruh hasil filter. Form menggunakan React Hook Form dan Zod. Teks dan status prototipe berada pada dictionary `id.design`; Attendance operasional memakai `id.attendance`, sedangkan RFQ operasional memakai `id.rfq`. Field memiliki label dan hubungan pesan error melalui ARIA; layout mengikuti table scroll, grid responsive dan dialog yang sudah ada.

Data prototipe terpisah pada `enterprise-erp-design-v1:<modul>:<companyId>` di localStorage. Membaca fixture tidak menulis storage; perubahan pertama menyimpan snapshot Company tersebut. Pergantian Company mereset dialog, pilihan dan filter; Gamma yang read-only tidak dapat menulis. Data tersimpan divalidasi ulang, termasuk Company dan ID unik. Data rusak tidak ditimpa; error/retry ditampilkan. Gagal menulis storage mempertahankan isian form dan data sebelumnya. Ketentuan storage ini tidak berlaku pada Attendance mode live yang memakai PostgreSQL.

Banner **Demo rancangan** tetap tampil pada Leads juga dalam mode live, serta pada RFQ/Attendance mode demo. Pilihan Items, Supplier dan Employee pada form demo menggunakan contoh tersendiri; tidak mengubah Master Data, Stock atau Accounting. RFQ dan Attendance mode live memakai record dan audit database melalui API. Pengujian visual menyeluruh belum selesai; prioritas saat ini adalah fungsi desktop dan backend, dengan mobile dikerjakan terpisah.

## Backlog review rancangan

Daftar ini dilanjutkan setelah prioritas pada [roadmap fungsional](functional-roadmap.md). Cakupan review web berikutnya adalah desktop; aplikasi mobile terpisah dikerjakan pemilik project.

1. **Review visual tiga halaman yang baru dilengkapi.** Periksa list, form, detail, perbandingan Supplier dan riwayat koreksi pada desktop. Pertahankan label demo dan batas backend yang jelas.
2. **Samakan pola halaman yang sudah ada.** Tinjau Company, Suppliers, Purchase Order, Stock Transfer, Sales Invoice dan Journal sebagai contoh list → form → detail. Pastikan aksi, validasi, status, pagination, loading/error dan dialog konfirmasi konsisten. Jelaskan aksi nonaktif sesuai Role atau mode data.
3. **Periksa perpindahan antar-modul.** Purchase Request → Approval → Purchase Order → Receipt → Invoice → Payment; Quotation → Sales Order → Delivery → Invoice → Payment; Stock posting → ledger. Detail dokumen harus mempertahankan Company dan menunjukkan sumber/tujuan yang relevan.
4. **Periksa layout desktop dan aksesibilitas.** Uji desktop 1366×768/1920×1080; periksa overflow tabel, sidebar, Company Switcher, search dan dialog. Tinjau ukuran teks/kontras, keyboard, focus return, label field, required feedback dan reduced motion dari tampilan nyata.
5. **Review akhir rancangan.** Simpan bukti screenshot dan hasil interaksi per route/state penting. Dokumentasikan perbedaan demo/live dan sisa business functionality sebelum kembali membahas deployment.

## Kriteria rancangan selesai

- Semua route navigasi memiliki konten sesuai domain; tidak ada tabel generik yang menyamarkan halaman belum tersedia.
- List, detail dan form yang masuk cakupan dapat dinavigasi; aksi prototipe menggunakan feedback demo yang jelas.
- Empty/loading/error/validation/destructive confirmation dapat diperiksa, dengan istilah konsisten.
- Company switching tidak menampilkan data/seleksi Company sebelumnya; Role read-only terlihat dan tetap ditegakkan backend dalam mode live.
- Pemeriksaan desktop dan keyboard memiliki bukti, bukan hanya hasil build atau jsdom. Mobile mengikuti project terpisah milik pemilik.
- Lint, typecheck, test dan build yang relevan lolos. URL, aset dan redirect tetap pada root.

Rancangan selesai tidak berarti advanced Accounting, payroll, backend CRM, custom Permissions/Approval atau deployment selesai. Attendance dan RFQ dasar sudah tersedia melalui API; kebutuhan bisnis tambahan dibahas sebagai milestone terpisah.
