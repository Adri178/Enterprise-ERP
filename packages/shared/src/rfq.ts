import { z } from "zod";
import { purchaseLineSchema, type PurchaseDocument } from "./procurement";

export const rfqStatuses = ["DRAFT", "OPEN", "PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type RfqStatus = typeof rfqStatuses[number];
export const rfqToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
const ref = z.string().min(1, "Pilih record terkait").max(100);
const day = z.iso.date("Tanggal tidak valid").refine(value => !value.startsWith("0000"), "Tanggal tidak valid");
const version = z.iso.datetime();
const reason = z.string().trim().min(5, "Alasan minimal 5 karakter").max(500);
export const rfqCreateSchema = z.strictObject({
  requestKey: z.uuid().transform(value => value.toLowerCase()), sourceId: ref, date: day, deadline: day,
  supplierIds: z.array(ref).min(2, "Pilih minimal dua Supplier").max(10, "Maksimal sepuluh Supplier").refine(values => new Set(values).size === values.length, "Supplier tidak boleh berulang").transform(values => [...values].sort()),
  description: z.string().trim().max(1000).default(""),
}).refine(value => value.deadline >= value.date, { path: ["deadline"], message: "Batas penawaran tidak boleh mendahului tanggal RFQ" });
export type RfqCreate = z.infer<typeof rfqCreateSchema>;
export const rfqOfferSchema = z.strictObject({
  expectedUpdatedAt: version, supplierId: ref, reference: z.string().trim().min(1, "Isi nomor penawaran Supplier").max(100),
  date: day, validUntil: day, deliveryDays: z.number().int().min(0).max(3650),
  description: z.string().trim().max(1000).default(""),
  lines: z.array(z.strictObject({ itemId: ref, unitPrice: purchaseLineSchema.shape.unitPrice })).min(1).max(50)
    .refine(lines => new Set(lines.map(line => line.itemId)).size === lines.length, "Items tidak boleh berulang")
    .transform(lines => [...lines].sort((a, b) => a.itemId.localeCompare(b.itemId))),
}).superRefine((value, ctx) => {
  if (value.validUntil < value.date) ctx.addIssue({ code: "custom", path: ["validUntil"], message: "Masa berlaku tidak boleh mendahului tanggal penawaran" });
  if (value.date > rfqToday()) ctx.addIssue({ code: "custom", path: ["date"], message: "Tanggal penawaran tidak boleh melewati hari ini" });
});
export type RfqOfferInput = z.infer<typeof rfqOfferSchema>;
export const rfqActionSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("open"), expectedUpdatedAt: version }),
  z.strictObject({ action: z.literal("propose"), expectedUpdatedAt: version, offerId: ref, reason }),
  z.strictObject({ action: z.enum(["approve", "reject", "cancel"]), expectedUpdatedAt: version, reason }),
]);
export type RfqActionInput = z.infer<typeof rfqActionSchema>;
export const rfqOrderSchema = z.strictObject({ requestKey: z.uuid().transform(value => value.toLowerCase()), expectedUpdatedAt: version, date: day, description: z.string().trim().max(1000).default("") });
export const rfqQuerySchema = z.strictObject({ q: z.string().trim().max(120).default(""), status: z.enum([...rfqStatuses, "ALL"]).default("ALL"), sourceId: ref.optional(), page: z.coerce.number().int().min(1).max(100000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(10), direction: z.enum(["asc", "desc"]).default("desc") });
export interface RfqEntry {
  id: string; companyId: string; number: string; sourceId: string; sourceNumber: string; date: string; deadline: string; currency: string; budget: string; description: string; status: RfqStatus;
  supplierCount: number; offerCount: number; selectedOfferId: string | null; selectedSupplierName: string | null;
  proposedBy: string | null; proposerName: string | null; proposedAt: string | null; proposalReason: string;
  reviewedBy: string | null; reviewerName: string | null; reviewedAt: string | null; reviewNote: string; cancelReason: string;
  creatorName: string; createdAt: string; updatedAt: string;
  orders: Array<{ id: string; number: string; status: string }>;
}
export interface RfqOffer {
  id: string; supplierId: string; supplierName: string; reference: string; date: string; validUntil: string; deliveryDays: number; description: string; amount: string; updatedAt: string;
  lines: Array<{ itemId: string; unitPrice: string; amount: string }>;
}
export interface RfqDetail extends RfqEntry {
  source: PurchaseDocument;
  suppliers: Array<{ supplierId: string; supplierName: string }>;
  offers: RfqOffer[];
  history: Array<{ id: string; action: string; actorName: string; createdAt: string; changes: Record<string, unknown> | null }>;
  historyTotal: number;
}
export interface RfqResult { data: RfqEntry[]; meta: { total: number; page: number; pageSize: number; pageCount: number } }
