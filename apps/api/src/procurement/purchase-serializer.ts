import { Prisma } from "@prisma/client";
export const purchaseInclude = {
  lines: { orderBy: { id: "asc" as const } },
  source: { select: { number: true } },
  rfq: { select: { number: true } },
  rfqRequests: { select: { id: true, number: true, status: true }, orderBy: { createdAt: "asc" as const } },
  successors: {
    select: { id: true, number: true, kind: true, status: true },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.PurchaseDocumentInclude;
export type PurchaseRow = Prisma.PurchaseDocumentGetPayload<{
  include: typeof purchaseInclude;
}>;
export function serializePurchase(row: PurchaseRow) {
  return {
    id: row.id,
    companyId: row.companyId,
    number: row.number,
    kind: row.kind,
    status: row.status,
    description: row.description,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouseName,
    currency: row.currency,
    sourceId: row.sourceId,
    rfqId: row.rfqId,
    rfqNumber: row.rfq?.number || null,
    rfqs: row.rfqRequests,
    successors: row.successors,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    amount: row.amount.toNumber(),
    date: row.date.toISOString().slice(0, 10),
    sourceNumber: row.source?.number || null,
    lines: row.lines.map((line) => ({
      ...line,
      unitPrice: line.unitPrice.toNumber(),
      amount: line.amount.toNumber(),
    })),
  };
}
