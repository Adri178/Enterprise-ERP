import { z } from "zod";
import {
  purchaseRequestSchema,
  purchaseQuerySchema,
  type PurchaseLine,
} from "./procurement";
export const salesKinds = [
  "QUOTATION",
  "SALES_ORDER",
  "DELIVERY_NOTE",
  "SALES_INVOICE",
  "PAYMENT",
] as const;
export type SalesKind = (typeof salesKinds)[number];
export const salesStatuses = ["DRAFT", "POSTED", "CANCELLED"] as const;
export type SalesStatus = (typeof salesStatuses)[number];
const reference = z.string().min(1, "Pilih record terkait").max(100);
export const quotationSchema = purchaseRequestSchema
  .omit({ supplierId: true })
  .extend({ customerId: reference });
export const tradeDraftSchema = purchaseRequestSchema
  .omit({ supplierId: true })
  .extend({ partyId: reference });
export type TradeDraftInput = z.infer<typeof tradeDraftSchema>;
export const salesFromSourceSchema = z.object({
  requestKey: z.uuid(),
  sourceId: reference,
  kind: z.enum(salesKinds).exclude(["QUOTATION"]),
  date: z.iso.date("Tanggal tidak valid"),
  description: z.string().trim().max(1000).default(""),
});
export const salesActionSchema = z.object({
  action: z.enum(["post", "cancel"]),
  expectedUpdatedAt: z.iso.datetime(),
});
export const salesQuerySchema = purchaseQuerySchema.extend({
  kind: z.enum(salesKinds).optional(),
  status: z.enum([...salesStatuses, "ALL"]).default("ALL"),
});
export const nextSalesKind: Partial<Record<SalesKind, SalesKind>> = {
  QUOTATION: "SALES_ORDER",
  SALES_ORDER: "DELIVERY_NOTE",
  DELIVERY_NOTE: "SALES_INVOICE",
  SALES_INVOICE: "PAYMENT",
};
export interface SalesDocument {
  id: string;
  companyId: string;
  number: string;
  kind: SalesKind;
  status: SalesStatus;
  date: string;
  description: string;
  customerId: string;
  customerName: string;
  warehouseId: string;
  warehouseName: string;
  currency: string;
  amount: number;
  sourceId: string | null;
  sourceNumber: string | null;
  createdAt: string;
  updatedAt: string;
  lines: (PurchaseLine & { stockCost: number | null })[];
  successors: {
    id: string;
    number: string;
    kind: SalesKind;
    status: SalesStatus;
  }[];
}
export interface SalesSummary {
  sales: number;
  received: number;
  outstanding: number;
  ordersPosted: number;
  deliveredValue: number;
}
export interface SalesAnalytics {
  month: string;
  sales: number;
  payment: number;
}
