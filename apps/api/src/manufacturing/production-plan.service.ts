import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { productionPlanQuerySchema } from "@erp/shared";
import { validate } from "../common/validation";
import { PrismaService } from "../prisma/prisma.module";
import { productionPaging } from "./manufacturing-common";
@Injectable()
export class ProductionPlanService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async summary(companyId: string) { return this.prisma.$transaction(async (tx) => ({ activeBoms: await tx.billOfMaterials.count({ where: { companyId, status: "ACTIVE" } }), released: await tx.workOrder.count({ where: { companyId, status: "RELEASED" } }), completed: await tx.workOrder.count({ where: { companyId, status: "COMPLETED" } }) }), { isolationLevel: "RepeatableRead" }); }
  async plan(companyId: string, body: unknown) {
    const q = validate(productionPlanQuerySchema, body);
    return this.prisma.$transaction(async (tx) => {
      if (q.warehouseId && !(await tx.warehouse.findFirst({ where: { companyId, id: q.warehouseId } }))) throw new NotFoundException("Warehouse tidak ditemukan pada company ini");
      const where: Prisma.WorkOrderWhereInput = { companyId, status: "RELEASED", date: { gte: new Date(q.from), lte: new Date(q.to) }, ...(q.warehouseId ? { warehouseId: q.warehouseId } : {}) };
      const orders = await tx.workOrder.count({ where });
      const cte = Prisma.sql`WITH demand AS (
        SELECT l."itemId", w."warehouseId", SUM(l.quantity)::bigint AS required
        FROM "WorkOrderLine" l JOIN "WorkOrder" w ON w."companyId" = l."companyId" AND w.id = l."workOrderId"
        WHERE w."companyId" = ${companyId} AND w.status = 'RELEASED' AND w.date BETWEEN ${q.from}::date AND ${q.to}::date
        ${q.warehouseId ? Prisma.sql`AND w."warehouseId" = ${q.warehouseId}` : Prisma.empty}
        GROUP BY l."itemId", w."warehouseId"
      )`;
      const [count] = await tx.$queryRaw<{ count: bigint }[]>(Prisma.sql`${cte} SELECT COUNT(*) AS count FROM demand`), meta = productionPaging(Number(count.count), q.page, q.pageSize);
      const rows = await tx.$queryRaw<{ itemId: string; itemCode: string; itemName: string; unit: string; warehouseId: string; warehouseName: string; required: bigint; available: bigint; shortage: bigint }[]>(Prisma.sql`${cte}
        SELECT d."itemId", r.code AS "itemCode", r.name AS "itemName", i.unit, d."warehouseId", wr.name AS "warehouseName", d.required, COALESCE(b.quantity, 0)::bigint AS available, GREATEST(d.required - COALESCE(b.quantity, 0), 0)::bigint AS shortage
        FROM demand d JOIN "Item" i ON i."companyId" = ${companyId} AND i.id = d."itemId" JOIN "MasterRecord" r ON r.id = i.id AND r."companyId" = i."companyId"
        JOIN "MasterRecord" wr ON wr.id = d."warehouseId" AND wr."companyId" = ${companyId}
        LEFT JOIN "StockBalance" b ON b."companyId" = ${companyId} AND b."itemId" = d."itemId" AND b."warehouseId" = d."warehouseId"
        ORDER BY r.code, wr.code, d."itemId", d."warehouseId" LIMIT ${meta.pageSize} OFFSET ${(meta.page - 1) * meta.pageSize}`);
      return { period: { from: q.from, to: q.to }, generatedAt: new Date().toISOString(), orders, data: rows.map((r) => ({ ...r, required: String(r.required), available: String(r.available), shortage: String(r.shortage) })), meta };
    }, { isolationLevel: "RepeatableRead" });
  }
}
