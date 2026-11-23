import { Prisma } from "@prisma/client";
export const salesInclude = {
  lines: { orderBy: { id: "asc" as const } },
  source: { select: { number: true } },
  successors: {
    select: { id: true, number: true, kind: true, status: true },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.SalesDocumentInclude;
export function serializeSales(
  row: Prisma.SalesDocumentGetPayload<{ include: typeof salesInclude }>,
) {
  return {
    id: row.id,
    companyId: row.companyId,
    number: row.number,
    kind: row.kind,
    status: row.status,
    date: row.date.toISOString().slice(0, 10),
    description: row.description,
    customerId: row.customerId,
    customerName: row.customerName,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouseName,
    currency: row.currency,
    amount: row.amount.toNumber(),
    sourceId: row.sourceId,
    sourceNumber: row.source?.number || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    successors: row.successors,
    lines: row.lines.map((line) => ({
      ...line,
      unitPrice: line.unitPrice.toNumber(),
      amount: line.amount.toNumber(),
      stockCost: line.stockCost?.toNumber() ?? null,
    })),
  };
}
