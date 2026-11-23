# Penerapan desain Dashboard ke web ERP

Desain desktop Apple-inspired dari `designs/enterprise-erp-dashboard-prototype.figcraft` diterapkan pada frontend ERP pada 6 November 2026. Sidebar dan toolbar menggunakan transparansi, backdrop blur, tepian terang, dan elevasi halus. Financial metrics, grafik, tabel, dan form tetap menggunakan permukaan solid. Efek kaca CSS mengadaptasi material prototype; refraksi native FigCraft bukan efek yang identik dengan backdrop blur browser.

## Cakupan

- Shell seluruh workspace: sidebar mengambang, hierarki navigasi tetap, nested navigation, indikator aktif, collapse, Company Switcher header/sidebar, breadcrumbs, global search, Notifications, Settings, bantuan, serta menu profil di bagian bawah sidebar.
- Dashboard live: enam KPI Company aktif dalam satu permukaan ringkasan, Revenue & Expenses berbasis Invoice, rentang grafik enam bulan, Approval Purchase Request dengan loading/error/empty state, dokumen terbaru, dan detail baca/tindak lanjut melalui komponen operasional yang sudah ada.
- Buat Transaksi membuka `TradeForm` yang sudah ada untuk Purchase Request dan Quotation. Form memakai Master Data, validasi, permissions, dan API nyata. Simulasi preset dari prototype tidak dipindahkan menjadi perilaku produksi.
- Kontrol Seluruh periode menjelaskan cakupan summary dan menautkan Reports untuk pemilihan periode. Ringkasan Dashboard belum mempunyai filter tanggal sendiri; label grafik enam bulan terpisah dari scope KPI.
- Tombol, status badges, menu, dan dialog mengikuti radius, tipografi, warna, serta focus ring yang konsisten. Responsivitas web yang sudah ada dipertahankan; ini bukan implementasi aplikasi mobile terpisah.
- Demo browser memakai shell dan grouped metrics yang sama, dengan penanda demo dan nilai Inventory ilustratif. Penyimpanan browser dan draft tetap mengikuti perilaku sebelumnya.

Tidak ada perubahan API, schema database, data bisnis, Role, metode autentikasi, basePath, atau hierarki modul. Root URL tetap `/dashboard`, `/suppliers`, dan seterusnya. Pencarian benar-benar menggunakan sumber aplikasi yang sudah tersedia; tidak memakai hasil pencarian statis prototype. Company Beta/Gamma pada web memakai konteks yang nyata untuk mode aplikasi, bukan skenario kosong yang dipaksakan dari file desain.

## Lokasi implementasi

| Bagian | File |
| --- | --- |
| Token warna | `apps/web/src/app/globals.css` |
| Shell, layout, material, responsivitas | `apps/web/src/app/workspace.css` |
| Struktur workspace dan pencarian | `apps/web/src/components/app-shell.tsx` |
| Company Switcher dan menu User yang dapat dipakai ulang | `apps/web/src/components/workspace-controls.tsx` |
| Dashboard operasional | `apps/web/src/components/operational-dashboard.tsx` |
| Dashboard demo | `apps/web/src/components/dashboard.tsx` |
| Komponen UI bersama | `apps/web/src/components/ui/` |
| Teks baru | `apps/web/src/lib/i18n-workspace.ts`, diakses melalui `id.workspaceUi` |

Glass memakai fallback solid untuk browser tanpa backdrop-filter dan preferensi reduced transparency. Focus ring tetap terlihat; animasi/transisi mengikuti aturan reduced motion global. Angka mempertahankan format `id-ID` dan mata uang Company. Warna hijau tetap berarti status positif; biru digunakan untuk aksi dan navigasi.

## Verifikasi

### Konsistensi modul — 10 November 2026

Suppliers dan Items kini memakai header daftar, format jumlah record, toolbar/filter, serta kontrol pencarian yang konsisten. Procurement dan Sales memakai `SummaryStrip` empat kolom dan navigasi Workflow yang tetap terhubung ke route operasional. Accounting memakai komponen ringkasan yang sama serta shortcut modul dan panel Invoice/Payment yang lebih terstruktur. Shortcut Organization/Master Data juga menggunakan komponen bersama `ModuleShortcut`.

Komponen baru berada di `summary-strip.tsx`, `list-panel-heading.tsx`, dan `module-shortcut.tsx`. Metrik tetap berasal dari API Company aktif. Saat data sedang dimuat atau tidak tersedia, ringkasan menampilkan tanda kosong, bukan angka nol yang dapat disalahartikan. API, schema, Role, status dokumen, export, pagination, dan operasi bisnis tidak diubah.

Toolbar kini dapat membungkus kontrol pada ruang sempit; ikon hapus pencarian dipisahkan dari aturan posisi ikon utama. Ringkasan empat kolom menjadi dua kolom pada desktop sempit, sedangkan shortcut dan teks panjang dapat membungkus. Tombol outline diberi border yang lebih jelas pada permukaan putih. Notice informasional menggunakan warna netral; warna hijau tetap untuk status positif. Pengembangan aplikasi mobile terpisah tetap di luar cakupan.

Koneksi browser interaktif dicoba kembali pada 10 November, tetapi host akses browser melaporkan tidak tersedia. Tidak ada klaim visual browser atau perbandingan pixel yang sudah lulus. Pengujian live baru `workspace-modules-live.integration.tsx` memeriksa halaman Suppliers/Items, nilai ringkasan Procurement/Sales/Accounting terhadap respons API, tujuan Workflow/shortcut, dan konteks Sales setelah berpindah ke Beta. Skenario ini hanya membaca data bisnis yang sudah ada.

`npm run verify` kembali lulus pada 10 November: lint, seluruh typecheck, **59 tes dasar** dan production build shared/Next.js/NestJS. Ketiga skenario live terarah (modul, Dashboard, dan Company resource) lulus bersama tanpa peringatan. Percobaan awal terkena reset proxy lalu timeout regresi Company resource ketika server development memuat ulang setelah build; pengulangan setelah API stabil lulus seluruhnya. Log lokal tersimpan di `.local/module-ui-verify.log` dan `.local/module-ui-live.log`.

### Hasil awal — 6 November 2026

`npm run verify` lulus pada 6 November 2026: lint, seluruh workspace typecheck, **44 tes API/shared + 15 tes web**, serta production build shared/Next.js/NestJS. Dua live React DOM/API scenario terarah juga lulus tanpa peringatan: Dashboard baru dan Company resource. Build Next.js menghasilkan 54 entri prerender. Token biru/canvas, aturan workspace, grouped metrics, dan fallback reduced transparency terkonfirmasi berada di CSS produksi yang dihasilkan.

Pengujian `workspace-shell.test.tsx` mencakup kedua Company Switcher, seluruh primary navigation, nested navigation, collapse, pencarian dan Escape/Ctrl+K, profil, serta navigasi Settings. Pengujian live `workspace-dashboard-live.integration.tsx` membandingkan keenam nilai KPI Alpha dan Beta dengan API sebenarnya, lalu membuka dan membatalkan form Purchase Request serta membuka detail dokumen yang ada. Pemeriksaan tidak menyimpan dokumen bisnis. Regresi Company resource juga memverifikasi bahwa data Company lama langsung disembunyikan saat konteks berubah.

Pengujian DOM tidak memverifikasi layout: chart host diberi ukuran tetap di JSDOM hanya untuk menghindari peringatan ukuran nol. Pemeriksaan visual browser pada 1920/1440/1024/768/390 px masih perlu dilakukan. Dua upaya menjalankan Chrome headless gagal sebelum halaman dimuat: proses GPU keluar dengan kode akses ditolak dan CDP `Page.enable` kehabisan waktu. Tidak ada klaim pixel-perfect atau browser visual QA yang telah lulus. Kegagalan browser ini terpisah dari hasil build, typecheck, lint, dan DOM/API tests.

## Menjalankan

Gunakan instruksi instalasi di README. Dengan API development dan PostgreSQL lokal sudah aktif, jalankan `npm run dev` dan buka **http://localhost:3000/dashboard**. Untuk demo tanpa database, jalankan `npm run dev:design`. Jangan menjalankan dua frontend pada port yang sama.

Pemeriksaan umum: `npm run verify`. Pengujian live terarah setelah kompilasi test: `node scripts/run-live-ui.mjs .local/test-build/web/test/workspace-dashboard-live.integration.js .local/test-build/web/test/company-resource-live.integration.js`.
