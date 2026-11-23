import { z } from "zod";
export const stockOperationKinds = ["TRANSFER", "ADJUSTMENT"] as const;
export type StockOperationKind = (typeof stockOperationKinds)[number];
export const stockOperationStatuses = ["DRAFT", "POSTED", "CANCELLED"] as const;
const reference = z.string().min(1, "Pilih record terkait").max(100);
const lineSchema = z.object({
  itemId: reference,
  quantity: z
    .number({ error: "Jumlah harus berupa angka" })
    .int("Jumlah harus berupa bilangan bulat")
    .min(-1000000, "Jumlah minimal -1.000.000")
    .max(1000000, "Jumlah maksimal 1.000.000")
    .refine((v) => v !== 0, "Perubahan jumlah tidak boleh nol"),
  unitPrice: z
    .number({ error: "Harga harus berupa angka" })
    .min(0, "Harga tidak boleh negatif")
    .max(1e10, "Harga terlalu besar")
    .refine(
      (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.0001,
      "Harga maksimal 2 desimal",
    ),
});
export const stockOperationSchema = z
  .object({
    requestKey: z.uuid(),
    kind: z.enum(stockOperationKinds),
    date: z.iso.date("Tanggal tidak valid"),
    warehouseId: reference,
    targetWarehouseId: z.string().max(100).default(""),
    description: z
      .string()
      .trim()
      .min(5, "Alasan minimal 5 karakter")
      .max(1000, "Alasan maksimal 1.000 karakter"),
    lines: z
      .array(lineSchema)
      .min(1, "Tambahkan minimal satu Items")
      .max(50, "Maksimal 50 baris Items")
      .refine(
        (lines) => new Set(lines.map((l) => l.itemId)).size === lines.length,
        "Items tidak boleh berulang",
      ),
  })
  .superRefine((value, context) => {
    if (
      value.kind === "TRANSFER" &&
      (!value.targetWarehouseId ||
        value.targetWarehouseId === value.warehouseId)
    )
      context.addIssue({
        code: "custom",
        path: ["targetWarehouseId"],
        message: "Pilih Warehouse tujuan yang berbeda",
      });
    if (value.kind === "ADJUSTMENT" && value.targetWarehouseId)
      context.addIssue({
        code: "custom",
        path: ["targetWarehouseId"],
        message: "Stock Adjustment hanya menggunakan satu Warehouse",
      });
    value.lines.forEach((line, index) => {
      if (value.kind === "TRANSFER" && line.quantity < 1)
        context.addIssue({
          code: "custom",
          path: ["lines", index, "quantity"],
          message: "Jumlah Transfer harus lebih dari nol",
        });
      if (
        value.kind === "ADJUSTMENT" &&
        line.quantity > 0 &&
        line.unitPrice <= 0
      )
        context.addIssue({
          code: "custom",
          path: ["lines", index, "unitPrice"],
          message: "Isi harga untuk penambahan Stock",
        });
      if (
        (value.kind === "TRANSFER" || line.quantity < 0) &&
        line.unitPrice !== 0
      )
        context.addIssue({
          code: "custom",
          path: ["lines", index, "unitPrice"],
          message: "Biaya Stock keluar dihitung saat posting. Isi harga nol.",
        });
    });
    if (
      value.lines.reduce(
        (sum, line) => sum + Math.max(0, line.quantity) * line.unitPrice,
        0,
      ) > 1e12
    )
      context.addIssue({
        code: "custom",
        path: ["lines"],
        message: "Nilai dokumen maksimal 1.000.000.000.000",
      });
  });
export type StockOperationInput = z.infer<typeof stockOperationSchema>;
export const stockOperationActionSchema = z.object({
  action: z.enum(["post", "cancel"]),
  expectedUpdatedAt: z.iso.datetime(),
});
export const stockOperationQuerySchema = z.object({
  kind: z.enum(stockOperationKinds).optional(),
  status: z.enum([...stockOperationStatuses, "ALL"]).default("ALL"),
  q: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  direction: z.enum(["asc", "desc"]).default("desc"),
});
export interface StockOperationLine {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  value: number | null;
}
export interface StockOperation {
  id: string;
  companyId: string;
  number: string;
  kind: StockOperationKind;
  status: (typeof stockOperationStatuses)[number];
  date: string;
  warehouseId: string;
  warehouseName: string;
  targetWarehouseId: string | null;
  targetWarehouseName: string | null;
  currency: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  lines: StockOperationLine[];
}
