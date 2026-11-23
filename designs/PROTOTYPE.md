# Prototype Dashboard desktop

Buka [enterprise-erp-dashboard-prototype.figcraft](enterprise-erp-dashboard-prototype.figcraft) di FigCraft, lalu gunakan **Present / Play** dan pilih flow **Enterprise ERP · Desktop interaktif**. Titik awalnya adalah frame **02 / Apple-inspired — Liquid Glass**, berukuran **1920 × 1440**.

File prototype dibuat dari Dashboard Apple-inspired yang sedang terbuka. File perbandingan sebelumnya tetap tersedia terpisah. Ini merupakan desain native yang dapat diedit, bukan perubahan pada aplikasi web ERP.

## Interaksi yang disiapkan

| Kontrol | Perilaku |
| --- | --- |
| Company Switcher pada header atau sidebar | Pilih Alpha, Beta, atau Gamma; nama Company, KPI, pencarian dokumen, dan kondisi kosong mengikuti konteks Company. |
| Sidebar | Buka submenu dari seluruh nama modul utama yang diminta. Halaman di luar cakupan prototype menampilkan penjelasan cakupan. |
| Procurement / Lihat Semua | Buka daftar dokumen dan kembali ke Dashboard. |
| Filter daftar | Pilih Semua dokumen, Procurement, atau Sales; kelompok baris yang ditampilkan berubah. |
| Baris dokumen | Buka detail baca saja, termasuk Items, jumlah, nilai, status, dan dokumen terkait yang tersedia. |
| Cari / Ctrl+K | Buka contoh hasil pencarian; pilih modul atau contoh dokumen. Pencarian memakai hasil preset, tanpa input teks bebas. |
| Buat Transaksi | Pilih Purchase Request atau Quotation. |
| Form simulasi | Pilih preset Supplier/Customers, ubah jumlah antara 1 dan 2, lihat total berubah, lalu Simpan Simulasi atau Batal. |
| Notifications / profil / bantuan | Buka panel terkait. |
| Periode laporan | Tampilkan penjelasan cakupan snapshot; filter tanggal belum disimulasikan. |
| Tutup / Escape / klik area luar | Tutup modal; detail terkait memakai pergantian modal. |

Alur mencoba yang disarankan:

1. Dashboard → Company Beta → lihat KPI dan kondisi kosong → kembali ke Alpha.
2. Lihat Semua → Filter Sales → buka Sales Invoice → tutup → kembali ke Dashboard.
3. Buat Transaksi → Purchase Request → pilih Supplier Contoh B → tekan `+` → total Rp194.000 → Simpan Simulasi → kembali ke Dashboard.
4. Sidebar Procurement → submenu → daftar dokumen; coba pencarian dan panel bantuan.

## Batasan dan verifikasi

Data Alpha berasal dari snapshot baca saja tanggal 4 November 2026. Beta/Gamma merupakan skenario prototype kosong; angka nol bukan hasil query database kedua Company tersebut. Form memakai data contoh dan pilihan preset. Simpan Simulasi tidak membuat dokumen, tidak mengubah Stock, dan tidak mengirim permintaan ke API ERP. Search dan rentang tanggal belum merupakan kontrol input penuh.

Prototype berisi **308 definisi interaksi native**, termasuk aksi klik dan Escape, dengan transisi dissolve 180 ms. Ini tidak berarti 308 fitur bisnis telah diimplementasikan.

Sebelas pemeriksaan MCP lulus: tujuan navigasi dan overlay tersedia, bindings dan mode variables valid, seluruh modal mempunyai Tutup/Escape, hierarki modul lengkap, setiap state Company menghasilkan label/KPI/kondisi kosong yang sesuai, setiap filter menampilkan satu kelompok baris, dan pilihan form menghasilkan nilai yang benar. Hasilnya ada di [dashboard-prototype-verification.json](dashboard-prototype-verification.json).

Render Alpha, Beta, daftar, detail, dan form telah diperiksa secara visual. **Uji klik playback langsung belum dijalankan karena persetujuan akses aplikasi FigCraft kedaluwarsa.** Verifikasi ini memeriksa struktur interaksi dan state yang dirender lewat MCP; perilaku klik, pengelolaan fokus, dan keyboard playback masih perlu dicoba di Present. Tidak ada perubahan pada source aplikasi, API, database, atau desain mobile.

## File pendukung

- `enterprise-erp-dashboard-prototype.png`: Dashboard Alpha.
- `enterprise-erp-prototype-company-beta.png`: kondisi kosong Company Beta.
- `enterprise-erp-prototype-documents.png`: daftar dokumen.
- `enterprise-erp-prototype-detail.png`: detail Purchase Order.
- `enterprise-erp-prototype-form.png`: form dengan preset Supplier B dan jumlah 2.
- `dashboard-prototype-manifest.json`: ID flow, frame, dan peta interaksi.
- `dashboard-prototype.commands.json` dan `refine-prototype.commands.json`: batch native MCP yang dijalankan.
- `verify-dashboard-prototype.mjs`: verifikasi struktur dan bindings; kembalikan state default setelah selesai.

Script MCP memakai koneksi aplikasi FigCraft pada port 7979 dan ID dokumen sesi saat pembuatan. Sesuaikan ID dari `doc.list` saat menjalankan kembali pada sesi baru. Generator menolak menambahkan prototype kedua ke dokumen yang sudah mempunyai frame prototype.
