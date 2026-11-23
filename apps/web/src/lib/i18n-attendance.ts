import { designId } from "./i18n-design";
export const attendanceText = {
  title: "Attendance",
  description: "Kehadiran Employee dan riwayat koreksi pada Company aktif.",
  scope: "Satu catatan per Employee per tanggal. Jam mengikuti Asia/Jakarta, tanpa shift lintas malam. Durasi tercatat belum memperhitungkan istirahat, lembur atau payroll.",
  leaveHint: "Status Cuti mengikuti Leave Request Disetujui pada hari kerja Senin–Jumat. Catatan yang bertentangan dengan cuti ditolak.",
  add: "Tambah Attendance", correct: "Koreksi Attendance", saved: "Attendance berhasil dicatat", corrected: "Attendance berhasil dikoreksi",
  period: "Periode Attendance", search: "Cari nomor, kode, nama Employee, atau Department…", allEmployees: "Semua Employee", filterEmployee: "Filter Employee",
  checkIn: "Jam Masuk", checkOut: "Jam Pulang", duration: "Durasi Tercatat", minutes: "menit", hours: "jam", statusLabels: designId.attendanceStatus,
  reason: "Alasan Koreksi", history: "Riwayat Koreksi", historyEmpty: "Belum ada koreksi pada catatan ini.",
  historyCount: (shown: number, total: number) => `${shown} dari ${total} koreksi terbaru`,
  identity: "Employee dan tanggal tetap setelah pencatatan. Koreksi menyimpan alasan serta nilai sebelum dan sesudah perubahan.",
  before: "Sebelum", after: "Sesudah", creator: "Dicatat oleh", editor: "Terakhir Dikoreksi oleh", updated: "Terakhir Diperbarui",
  summary: "Ringkasan sesuai filter", readOnly: "Attendance pada Company ini hanya dapat dibaca. Periksa Role dan status Company.",
  empty: "Belum ada Attendance untuk filter ini", emptyHint: "Pilih periode atau Employee lain, atau catat kehadiran Employee aktif.",
  export: "Ekspor CSV", exportHint: "Ekspor seluruh hasil filter, maksimal 10.000 catatan.", reload: "Muat Ulang", employeesLink: "Buka Employees", leaveLink: "Buka Leave Requests",
} as const;
