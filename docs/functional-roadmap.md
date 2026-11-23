# Prioritas fungsionalitas Enterprise ERP

Keputusan terbaru, 3 November 2026: dahulukan fungsionalitas sistem dan web desktop. Aplikasi mobile akan dibuat terpisah oleh pemilik project. Deployment dan review visual mobile ditunda.

## Status milestone

| Bagian | Status |
| --- | --- |
| Company dan Master Data | CRUD, relasi, Company/RBAC dan audit sudah tersedia |
| Procurement, Inventory, Sales | Workflow dokumen terhubung, posting ledger dan transaksi database sudah tersedia |
| Accounting, Manufacturing, Reports, Permissions | Fondasi operasional tersedia dengan batas masing-masing modul |
| Attendance | Sekarang terhubung ke Employee, PostgreSQL, koreksi/audit dan Leave Approval dalam mode live; lihat [kontrak dan batas](attendance.md) |
| RFQ | Purchase Request riil, perbandingan penawaran, Approval User lain dan Purchase Order atomik tersedia di mode live; lihat [RFQ](rfq.md) |
| Leads | Halaman interaktif masih demo browser; backend dan konversi antar-dokumen belum tersedia |

## Urutan berikutnya

1. **CRM Leads operasional:** simpan pipeline dan aktivitas di database, lalu hubungkan Lead yang memenuhi kriteria ke Customer/Quotation dengan pemetaan dan konfirmasi yang jelas. Cegah duplikasi Customer dan perpindahan Company implisit.
2. **Penguatan lintas-modul:** uji versi/idempotency/concurrency, alur Approval, referensi dokumen, laporan/export, dan akses lintas Company berdasarkan transaksi yang nyata. Selesaikan kekurangan fungsi sebelum memperluas modul baru.
3. **Kebutuhan lanjutan:** pilih scope Accounting/HR/Manufacturing berikutnya berdasarkan workflow yang dibutuhkan. Payroll, financial statements/closing, transaksi parsial dan configurable Approval tidak otomatis termasuk fondasi yang sudah selesai.

Rancangan tetap dipakai untuk mendukung operasi: tombol, form, detail, loading/error dan feedback harus bekerja. Kontrak REST backend dipertahankan terpisah dari komponen Next.js agar client lain dapat dikembangkan kemudian. Integrasi/authentication client mobile akan dibahas saat client tersebut mulai dikerjakan.
