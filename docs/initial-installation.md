# Penyiapan ADMIN pertama

Perintah ini untuk instalasi ERP baru yang **belum memiliki User atau Company**. Ini bukan seed development, alat reset password, atau endpoint registrasi publik. Operasi dijalankan lewat Terminal pemilik hosting setelah migrasi dan build berhasil.

## Hasil setup

- Satu User ADMIN memakai nama, email dan password yang dimasukkan sendiri melalui Terminal.
- Tiga Company fiktif kosong: PT Alpha Distribusi, PT Beta Industri dan PT Gamma Digital, dengan mata uang IDR. User awal memperoleh akses ADMIN pada ketiganya untuk konfigurasi pertama.
- Audit Company/akses dan event pembuatan akun. Password maupun hash password tidak dimasukkan ke audit.
- Wajib ganti password saat login pertama. Setelah diganti, sesi lama dibatalkan dan pengguna diminta login kembali.

Tidak ada Items, Supplier, Customer, Employee, Invoice, saldo Stock, Journal atau transaksi contoh yang dibuat oleh perintah ini. Dashboard awal bernilai nol sesuai database yang kosong. Company dapat diedit melalui UI setelah setup. Untuk kebutuhan perusahaan nyata, fungsi internal menerima profil Company tervalidasi; CLI yang disertakan memang menyiapkan tiga Company fiktif sesuai proyek portfolio.

## Menjalankan di hosting

1. Pastikan source berada di luar `public_html`, environment Node panel telah diaktifkan dan `apps/api/.env` privat berisi koneksi database hosting. Environment pada panel saja belum tentu diwariskan ke Terminal.
2. Dari root workspace, jalankan Prisma `migrate deploy`, lalu build sesuai [panduan cPanel](cpanel-nodejs.md). File `apps/api/dist/setup/installation.js` harus sudah dihasilkan oleh build.
3. Jalankan langsung di Terminal interaktif:

```sh
NODE_ENV=production npm run db:bootstrap
```

4. Isi nama ADMIN, email dan password awal minimal 12 karakter, maksimal 72 byte, lalu ulangi password. Karakter password tidak ditampilkan. Tidak ada password bawaan dan tidak perlu menuliskannya pada argumen command, shell history, `.env` atau chat.
5. Setelah pesan berhasil, buka `/login` pada URL aplikasi. Gunakan email/password yang baru diisi. Ikuti halaman ganti password, lalu login kembali dengan password baru. Company Switcher akan menampilkan tiga Company.

CLI memerlukan `NODE_ENV=production`, koneksi database dan Terminal TTY. Input melalui pipe/file ditolak. Skrip membaca `.env` API dari lokasi proyek, bukan dari folder kebetulan tempat shell dibuka. Nilai secret tidak dicetak oleh penanganan error setup.

## Perlindungan data

Seluruh pembuatan User, Company, akses dan audit menggunakan satu transaksi database. Lock transaksi PostgreSQL menyerialkan dua proses setup bersamaan. Setelah instalasi memiliki User atau Company, pengulangan ditolak tanpa mengubah akun, password, akses atau data lama. Kegagalan pada salah satu Company membatalkan seluruh setup.

Tidak diperlukan migrasi database baru untuk fitur ini. Pengujian lokal memakai database sementara yang dibuat dan dihapus khusus untuk tes pada cluster development port 55432; tidak menggunakan database hosting atau mereset database development utama. PostgreSQL 13.23 dilaporkan oleh pemilik hosting, tetapi pengujian lokal dilakukan pada PostgreSQL 18. Verifikasi migrasi dan operasi nyata pada server hosting tetap diperlukan.
