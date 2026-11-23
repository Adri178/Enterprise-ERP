import { z } from "zod";
import { designId as d } from "../i18n-design";

const text = z.string().trim().min(1, d.required).max(160, d.textTooLong);
const note = z.string().trim().max(1200, d.textTooLong);
const amount = z.number({ error: d.invalidNumber }).min(0, d.invalidNumber).max(100_000_000, d.invalidNumber);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, d.invalidDate).refine(value => !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, d.invalidDate);
const time = z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, d.invalidTime)]);
const identity = { id: text, companyId: text, number: text, updatedAt: z.string().datetime() };
export const leadStages = ["NEW", "CONTACTED", "QUALIFIED", "LOST"] as const;
export const leadFormSchema = z.object({
  contact: text, organization: text,
  email: z.union([z.literal(""), z.email(d.invalidEmail)]), phone: z.string().trim().max(40),
  owner: text, source: z.enum(["WEBSITE", "REFERRAL", "EVENT", "OTHER"]),
  potential: amount, description: note,
});
export const leadSchema = leadFormSchema.extend({ ...identity, status: z.enum(leadStages) });
export type LeadInput = z.infer<typeof leadFormSchema>;
export type Lead = z.infer<typeof leadSchema>;
export function transitionLead(record: Lead, status: Lead["status"]): Lead {
  const allowed: Record<Lead["status"], Lead["status"][]> = { NEW: ["CONTACTED", "LOST"], CONTACTED: ["QUALIFIED", "LOST"], QUALIFIED: [], LOST: [] };
  if (!allowed[record.status].includes(status)) throw new Error(d.invalidTransition);
  return { ...record, status, updatedAt: new Date().toISOString() };
}

export const demoItems = [
  { id: "carton", code: "DEMO-ITM-001", name: "Kemasan Karton", unit: "pcs" },
  { id: "tape", code: "DEMO-ITM-002", name: "Pita Perekat", unit: "roll" },
  { id: "panel", code: "DEMO-ITM-003", name: "Panel Aluminium", unit: "pcs" },
] as const;
export const demoSuppliers = [
  { id: "nusantara", name: "PT Nusantara Kemasan (Demo)" },
  { id: "mitra", name: "CV Mitra Sejahtera (Demo)" },
  { id: "sentosa", name: "PT Sentosa Teknik (Demo)" },
] as const;
export const rfqFormSchema = z.object({
  title: text, requestReference: z.string().trim().max(80), deadline: isoDate, description: note,
  lines: z.array(z.object({ itemId: z.enum(["carton", "tape", "panel"]), quantity: z.number({ error: d.itemRequired }).int(d.itemRequired).min(1, d.itemRequired).max(10000) })).min(1, d.itemRequired).max(10)
    .refine(lines => new Set(lines.map(line => line.itemId)).size === lines.length, d.duplicateItem),
  supplierIds: z.array(z.enum(["nusantara", "mitra", "sentosa"])).min(1, d.supplierRequired).max(3).refine(ids => new Set(ids).size === ids.length, d.supplierRequired),
});
export const offerSchema = z.object({ supplierId: text, reference: text, prices: z.array(amount.min(0.01, d.invalidNumber)).min(1).max(10), leadDays: z.number({ error: d.invalidNumber }).int(d.invalidNumber).min(1, d.invalidNumber).max(90, d.invalidNumber) });
export const rfqSchema = rfqFormSchema.extend({ ...identity, status: z.enum(["DRAFT", "SENT", "SELECTED", "CANCELLED"]), offers: z.array(offerSchema).max(3), selectedSupplierId: z.string() })
  .refine(record => record.offers.every(offer => record.supplierIds.includes(offer.supplierId as RfqInput["supplierIds"][number]) && offer.prices.length === record.lines.length) && new Set(record.offers.map(offer => offer.supplierId)).size === record.offers.length, d.offerInvalid)
  .refine(record => record.status === "SELECTED" ? record.offers.some(offer => offer.supplierId === record.selectedSupplierId) : record.selectedSupplierId === "", d.offerInvalid);
export type RfqInput = z.infer<typeof rfqFormSchema>;
export type Offer = z.infer<typeof offerSchema>;
export type Rfq = z.infer<typeof rfqSchema>;
export const offerTotal = (rfq: Rfq, offer: Offer) => Math.round(rfq.lines.reduce((sum, line, index) => sum + line.quantity * offer.prices[index], 0) * 100) / 100;
export function selectOffer(record: Rfq, supplierId: string): Rfq {
  if (record.status !== "SENT" || !record.offers.some(offer => offer.supplierId === supplierId)) throw new Error(d.offerInvalid);
  return rfqSchema.parse({ ...record, status: "SELECTED", selectedSupplierId: supplierId, updatedAt: new Date().toISOString() });
}

export const demoEmployees = [
  { id: "emp-01", name: "Alya Putri", department: "Operations" },
  { id: "emp-02", name: "Bima Prakoso", department: "Warehouse" },
  { id: "emp-03", name: "Citra Maharani", department: "Sales" },
  { id: "emp-04", name: "Dimas Saputra", department: "Finance" },
] as const;
export function todayInJakarta() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta" }).format(new Date());
}
export const attendanceFields = z.object({ employeeId: z.enum(["emp-01", "emp-02", "emp-03", "emp-04"]), date: isoDate, status: z.enum(["PRESENT", "ABSENT", "PERMIT", "LEAVE"]), checkIn: time, checkOut: time, description: note });
export const attendanceFormSchema = attendanceFields.extend({ reason: z.string().trim().max(500) }).superRefine((value, ctx) => {
  if (value.date > todayInJakarta()) ctx.addIssue({ code: "custom", path: ["date"], message: d.attendanceFuture });
  if (value.status === "PRESENT") {
    if (!value.checkIn || !value.checkOut) ctx.addIssue({ code: "custom", path: ["checkOut"], message: d.attendanceTimesRequired });
    else if (value.checkOut <= value.checkIn) ctx.addIssue({ code: "custom", path: ["checkOut"], message: d.attendanceTimeError });
  } else if (value.checkIn || value.checkOut) ctx.addIssue({ code: "custom", path: ["checkIn"], message: d.attendanceTimesEmpty });
});
export const attendanceSchema = attendanceFields.extend({ ...identity, corrections: z.array(z.object({ at: z.string().datetime(), actor: text, reason: text, before: attendanceFields, after: attendanceFields })).max(50, d.textTooLong) })
  .refine(value => value.status === "PRESENT" ? !!value.checkIn && !!value.checkOut && value.checkOut > value.checkIn : !value.checkIn && !value.checkOut, d.attendanceTimeError);
export type AttendanceInput = z.infer<typeof attendanceFormSchema>;
export type Attendance = z.infer<typeof attendanceSchema>;
export function attendanceMinutes(record: Pick<Attendance, "checkIn" | "checkOut">) {
  if (!record.checkIn || !record.checkOut) return 0;
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  return minutes(record.checkOut) - minutes(record.checkIn);
}
export function checkAttendanceUnique(records: Attendance[], input: AttendanceInput, editingId?: string) {
  if (records.some(record => record.id !== editingId && record.employeeId === input.employeeId && record.date === input.date)) throw new Error(d.attendanceDuplicate);
}
export function nextDesignNumber(kind: string, companyCode: string, records: { number: string }[]) {
  const last = records.reduce((max, record) => Math.max(max, Number(record.number.match(/-(\d+)$/)?.[1]) || 0), 0);
  return `DEMO-${kind}-${companyCode}-${String(last + 1).padStart(3, "0")}`;
}
