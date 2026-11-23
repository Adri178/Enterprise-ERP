import type { Company } from "@erp/shared";
import { type Lead, type Rfq, type Attendance, todayInJakarta } from "./models";
type Scope = Pick<Company, "id" | "code">;
const base = (company: Scope, kind: string, index: number) => ({ id: `demo-${kind}-${company.id}-${index}`, companyId: company.id, number: `DEMO-${kind}-${company.code}-${String(index).padStart(3, "0")}`, updatedAt: "2026-11-01T02:00:00.000Z" });
export function leadFixtures(company: Scope): Lead[] {
  return [
    { ...base(company, "LD", 1), contact: "Nadia Lestari", organization: "PT Arunika Retail (Demo)", email: "nadia@example.com", phone: "081200001001", owner: "Aditya Pratama", source: "WEBSITE", potential: 45000000, description: "Kebutuhan distribusi untuk pembukaan tiga outlet baru.", status: "NEW" },
    { ...base(company, "LD", 2), contact: "Raka Wibowo", organization: "CV Pilar Mandiri (Demo)", email: "raka@example.com", phone: "081200001002", owner: "Sari Wijaya", source: "REFERRAL", potential: 28000000, description: "Diskusi spesifikasi dan jadwal pengiriman sudah dilakukan.", status: "CONTACTED" },
    { ...base(company, "LD", 3), contact: "Tania Kusuma", organization: "PT Cakrawala Niaga (Demo)", email: "tania@example.com", phone: "081200001003", owner: "Aditya Pratama", source: "EVENT", potential: 67000000, description: "Kebutuhan dan anggaran telah dikonfirmasi untuk rancangan penawaran.", status: "QUALIFIED" },
  ];
}
export function rfqFixtures(company: Scope): Rfq[] {
  return [
    { ...base(company, "RFQ", 1), title: "Kemasan untuk distribusi bulanan", requestReference: "DEMO-PR-001", deadline: todayInJakarta(), description: "Kemasan harus sesuai spesifikasi contoh.", lines: [{ itemId: "carton", quantity: 250 }, { itemId: "tape", quantity: 40 }], supplierIds: ["nusantara", "mitra"], status: "DRAFT", offers: [], selectedSupplierId: "" },
    { ...base(company, "RFQ", 2), title: "Kebutuhan panel area Warehouse", requestReference: "DEMO-PR-002", deadline: todayInJakarta(), description: "Bandingkan total harga dan waktu pengiriman sebelum memilih Supplier.", lines: [{ itemId: "panel", quantity: 20 }], supplierIds: ["mitra", "sentosa"], status: "SENT", offers: [{ supplierId: "mitra", reference: "DEMO-QT-MTR-012", prices: [285000], leadDays: 7 }, { supplierId: "sentosa", reference: "DEMO-QT-SNT-028", prices: [295000], leadDays: 3 }], selectedSupplierId: "" },
  ];
}
export function attendanceFixtures(company: Scope): Attendance[] {
  const date = todayInJakarta();
  return [
    { ...base(company, "AT", 1), employeeId: "emp-01", date, status: "PRESENT", checkIn: "08:00", checkOut: "17:00", description: "Catatan kehadiran contoh.", corrections: [] },
    { ...base(company, "AT", 2), employeeId: "emp-02", date, status: "PRESENT", checkIn: "08:15", checkOut: "17:10", description: "Penugasan area Warehouse.", corrections: [] },
    { ...base(company, "AT", 3), employeeId: "emp-03", date, status: "PERMIT", checkIn: "", checkOut: "", description: "Keperluan pribadi (contoh).", corrections: [] },
  ];
}
