import { z } from "zod";

export const purchaseKinds = [
  "PURCHASE_REQUEST",
  "PURCHASE_ORDER",
  "PURCHASE_RECEIPT",
  "PURCHASE_INVOICE",
  "PAYMENT",
] as const;
export type PurchaseKind = (typeof purchaseKinds)[number];
export const purchaseStatuses = [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "POSTED",
  "CANCELLED",
] as const;
export type PurchaseStatus = (typeof purchaseStatuses)[number];
const reference = z.string().min(1, "Pilih record terkait").max(100);
const price = z
  .number({ error: "Harga harus berupa angka" })
  .positive("Harga harus lebih dari 0")
  .max(1e10, "Harga maksimal 10.000.000.000")
  .refine(
    (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.0001,
    "Harga maksimal 2 desimal",
  );
export const purchaseLineSchema = z.object({
  itemId: reference,
  quantity: z
    .number({ error: "Jumlah harus berupa angka" })
    .int("Jumlah harus berupa bilangan bulat")
    .min(1, "Jumlah minimal 1")
    .max(1000000, "Jumlah maksimal 1.000.000"),
  unitPrice: price,
});
export const purchaseRequestSchema = z.object({
  requestKey: z.uuid(),
  date: z.iso.date("Tanggal tidak valid"),
  supplierId: reference,
  warehouseId: reference,
  description: z.string().trim().max(1000).default(""),
  lines: z
    .array(purchaseLineSchema)
    .min(1, "Tambahkan minimal satu Items")
    .max(50, "Maksimal 50 baris Items")
    .refine(
      (lines) => new Set(lines.map((l) => l.itemId)).size === lines.length,
      "Items tidak boleh berulang",
    )
    .refine(
      (lines) =>
        lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0) <=
        1e12,
      "Nilai dokumen maksimal 1.000.000.000.000",
    ),
});
export type PurchaseRequestInput = z.infer<typeof purchaseRequestSchema>;
export const purchaseFromSourceSchema = z.object({
  requestKey: z.uuid(),
  sourceId: reference,
  kind: z.enum(purchaseKinds).exclude(["PURCHASE_REQUEST"]),
  date: z.iso.date("Tanggal tidak valid"),
  description: z.string().trim().max(1000).default(""),
});
export const purchaseActionSchema = z.object({
  action: z.enum(["submit", "approve", "reject", "post", "cancel"]),
  expectedUpdatedAt: z.iso.datetime(),
});
export type PurchaseAction = z.infer<typeof purchaseActionSchema>["action"];
export const purchaseQuerySchema = z.object({
  kind: z.enum(purchaseKinds).optional(),
  status: z.enum([...purchaseStatuses, "ALL"]).default("ALL"),
  q: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  direction: z.enum(["asc", "desc"]).default("desc"),
});
export type PurchaseQuery = z.infer<typeof purchaseQuerySchema>;
export const nextPurchaseKind: Partial<Record<PurchaseKind, PurchaseKind>> = {
  PURCHASE_REQUEST: "PURCHASE_ORDER",
  PURCHASE_ORDER: "PURCHASE_RECEIPT",
  PURCHASE_RECEIPT: "PURCHASE_INVOICE",
  PURCHASE_INVOICE: "PAYMENT",
};
export function allowedPurchaseActions(
  kind: PurchaseKind,
  status: PurchaseStatus,
): PurchaseAction[] {
  if (status === "DRAFT")
    return kind === "PURCHASE_REQUEST"
      ? ["submit", "cancel"]
      : ["post", "cancel"];
  if (kind === "PURCHASE_REQUEST" && status === "PENDING")
    return ["approve", "reject", "cancel"];
  return [];
}
export interface PurchaseLine {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}
export interface PurchaseDocument {
  id: string;
  companyId: string;
  number: string;
  kind: PurchaseKind;
  status: PurchaseStatus;
  date: string;
  description: string;
  supplierId: string;
  supplierName: string;
  warehouseId: string;
  warehouseName: string;
  currency: string;
  amount: number;
  sourceId: string | null;
  sourceNumber: string | null;
  rfqId?: string | null;
  rfqNumber?: string | null;
  rfqs?: Array<{ id: string; number: string; status: string }>;
  createdAt: string;
  updatedAt: string;
  lines: PurchaseLine[];
  successors: {
    id: string;
    number: string;
    kind: PurchaseKind;
    status: PurchaseStatus;
  }[];
}
export interface PurchaseSummary {
  requestsPending: number;
  ordersPosted: number;
  purchases: number;
  paid: number;
  outstanding: number;
  inventoryValue: number;
  inventoryQuantity: number;
}
export interface PurchaseAnalytics {
  month: string;
  purchases: number;
  payment: number;
}
export interface StockBalanceRow {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  unit: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  value: number;
}
export interface StockLedgerRow extends StockBalanceRow {
  documentId: string;
  documentKind:
    "PURCHASE_RECEIPT" | "TRANSFER" | "ADJUSTMENT" | "DELIVERY_NOTE" | "WORK_ORDER";
  documentNumber: string;
  date: string;
  createdAt: string;
  unitPrice: number;
}
