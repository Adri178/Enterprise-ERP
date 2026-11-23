import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.module";
import { validate } from "../common/validation";
const querySchema = z.object({
  q: z.string().trim().max(120).default(""),
  warehouseId: z.string().max(100).optional(),
  itemId: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
const include = {
  item: { include: { record: true } },
  warehouse: { include: { record: true } },
} satisfies Prisma.StockBalanceInclude;
function serializeStock(
  row: Prisma.StockBalanceGetPayload<{ include: typeof include }>,
) {
  return {
    id: row.id,
    itemId: row.itemId,
    itemCode: row.item.record.code,
    itemName: row.item.record.name,
    unit: row.item.unit,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouse.record.name,
    quantity: row.quantity,
    value: row.value.toNumber(),
  };
}
@Injectable()
export class StockService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async list(companyId: string, input: unknown, ledger: boolean) {
    const query = validate(querySchema, input);
    const where = {
      companyId,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.itemId ? { itemId: query.itemId } : {}),
      ...(query.q
        ? {
            item: {
              record: {
                OR: [
                  { name: { contains: query.q, mode: "insensitive" as const } },
                  { code: { contains: query.q, mode: "insensitive" as const } },
                ],
              },
            },
          }
        : {}),
    };
    return this.prisma.$transaction(
      async (tx) => {
        const total = ledger
          ? await tx.stockLedger.count({ where })
          : await tx.stockBalance.count({ where });
        const pageCount = Math.max(1, Math.ceil(total / query.pageSize)),
          page = Math.min(query.page, pageCount);
        const args = {
          where,
          skip: (page - 1) * query.pageSize,
          take: query.pageSize,
        };
        const rows = ledger
          ? (
              await tx.stockLedger.findMany({
                ...args,
                include: {
                  ...include,
                  document: { select: { number: true } },
                  operation: { select: { number: true, kind: true } },
                  salesDocument: { select: { number: true } },
                  workOrder: { select: { number: true } },
                },
                orderBy: [{ createdAt: "desc" }, { id: "asc" }],
              })
            ).map((row) => ({
              ...serializeStock(row),
              documentId:
                row.documentId || row.operationId || row.salesDocumentId || row.workOrderId!,
              documentKind: row.workOrderId ? "WORK_ORDER" : row.salesDocumentId
                ? "DELIVERY_NOTE"
                : row.operation?.kind || "PURCHASE_RECEIPT",
              documentNumber:
                row.document?.number ||
                row.operation?.number ||
                row.salesDocument?.number || row.workOrder!.number,
              date: row.date.toISOString().slice(0, 10),
              createdAt: row.createdAt,
              unitPrice: row.unitPrice.toNumber(),
            }))
          : (
              await tx.stockBalance.findMany({
                ...args,
                include,
                orderBy: [{ itemId: "asc" }, { warehouseId: "asc" }],
              })
            ).map(serializeStock);
        return {
          data: rows,
          meta: { total, page, pageSize: query.pageSize, pageCount },
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
}
