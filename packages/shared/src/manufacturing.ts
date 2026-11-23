import { z } from "zod";
import { accountingPeriodSchema } from "./accounting";
const reference = z.string().min(1, "Pilih record terkait").max(100);
const quantity = z.number({ error: "Jumlah harus berupa angka" }).int("Jumlah harus berupa bilangan bulat").min(1, "Jumlah minimal 1").max(1000000, "Jumlah maksimal 1.000.000");
const version = { expectedUpdatedAt: z.iso.datetime("Versi data wajib disertakan") };
export const bomSchema = z.object({
  code: z.string().trim().min(2, "Kode minimal 2 karakter").max(30, "Kode maksimal 30 karakter").regex(/^[A-Za-z0-9-]+$/, "Gunakan huruf, angka, atau tanda -").transform((v) => v.toUpperCase()),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(120, "Nama maksimal 120 karakter"),
  outputItemId: reference, outputQuantity: quantity,
  description: z.string().trim().max(1000, "Deskripsi maksimal 1.000 karakter"),
  lines: z.array(z.object({ itemId: reference, quantity })).min(1, "Tambahkan minimal satu bahan baku").max(50, "Maksimal 50 bahan baku"),
}).superRefine((v, ctx) => {
  if (new Set(v.lines.map((l) => l.itemId)).size !== v.lines.length) ctx.addIssue({ code: "custom", path: ["lines"], message: "Bahan baku tidak boleh berulang" });
  if (v.lines.some((l) => l.itemId === v.outputItemId)) ctx.addIssue({ code: "custom", path: ["lines"], message: "Hasil produksi tidak boleh menjadi bahan baku dalam BOM yang sama" });
});
export const bomActionSchema = z.object({ ...version, action: z.enum(["activate", "retire"]) });
export const manufacturingVersionSchema = z.object(version);
export const workOrderSchema = z.object({ requestKey: z.uuid(), bomId: reference, batches: quantity, warehouseId: reference, date: z.iso.date("Tanggal tidak valid").refine((v) => !v.startsWith("0000"), "Tahun minimal 0001"), description: z.string().trim().max(1000, "Deskripsi maksimal 1.000 karakter") });
export const workOrderActionSchema = z.object({ ...version, action: z.enum(["release", "complete", "cancel"]), postingDate: z.iso.date("Tanggal tidak valid").refine((v) => !v.startsWith("0000"), "Tahun minimal 0001").optional() }).superRefine((v, ctx) => { if (v.action === "complete" && !v.postingDate) ctx.addIssue({ code: "custom", path: ["postingDate"], message: "Isi tanggal pencatatan produksi" }); });
export const manufacturingQuerySchema = z.object({ q: z.string().trim().max(120).default(""), status: z.enum(["ALL", "DRAFT", "ACTIVE", "INACTIVE", "RELEASED", "COMPLETED", "CANCELLED"]).default("ALL"), page: z.coerce.number().int().min(1).max(1000000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(10), direction: z.enum(["asc", "desc"]).default("desc") });
export const productionPlanQuerySchema = accountingPeriodSchema.safeExtend({ warehouseId: z.string().max(100).default(""), page: z.coerce.number().int().min(1).max(1000000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(10) });
export type BomInput = z.output<typeof bomSchema>;
export type BomFormInput = z.input<typeof bomSchema>;
export type WorkOrderInput = z.output<typeof workOrderSchema>;
export interface BomLine { id: string; itemId: string; itemCode: string; itemName: string; unit: string; quantity: number }
export interface Bom extends BomInput { id: string; companyId: string; status: "DRAFT" | "ACTIVE" | "INACTIVE"; outputCode: string; outputName: string; outputUnit: string; lines: BomLine[]; createdAt: string; updatedAt: string }
export interface WorkOrderLine extends BomLine { cost: number | null }
export interface WorkOrder {
  id: string; companyId: string; number: string; bomId: string; bomCode: string; bomName: string; batches: number;
  date: string; status: "DRAFT" | "RELEASED" | "COMPLETED" | "CANCELLED"; outputItemId: string; outputCode: string; outputName: string; outputUnit: string; outputQuantity: number;
  warehouseId: string; warehouseName: string; currency: string; description: string; amount: number | null; createdAt: string; updatedAt: string;
  completedAt: string | null; completedDate: string | null; creatorName: string; completerName: string | null; lines: WorkOrderLine[];
  availability?: { itemId: string; available: number; required: number; shortage: number }[];
}
export interface ProductionPlan {
  period: { from: string; to: string }; generatedAt: string; orders: number;
  data: { itemId: string; itemCode: string; itemName: string; unit: string; warehouseId: string; warehouseName: string; required: string; available: string; shortage: string }[];
  meta: { total: number; page: number; pageSize: number; pageCount: number };
}
