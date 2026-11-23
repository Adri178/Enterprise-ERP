import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { workOrderSchema, workOrderActionSchema, manufacturingQuerySchema } from "@erp/shared";
import { validate } from "../common/validation";
import { PrismaService } from "../prisma/prisma.module";
import { assertStockDate, outgoingStockCost, postStockMovement } from "../procurement/stock-posting";
import { postOperationalAccounting } from "../accounting/automatic-posting";
import { bomInclude, productionAccess, productionAudit, productionItems, productionPaging, productionWarehouse, serializeWorkOrder, workOrderInclude } from "./manufacturing-common";
@Injectable()
export class WorkOrdersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async list(companyId: string, body: unknown) {
    const q = validate(manufacturingQuerySchema, body);
    const where: Prisma.WorkOrderWhereInput = { companyId, ...(q.status !== "ALL" ? { status: { in: ["DRAFT", "RELEASED", "COMPLETED", "CANCELLED"].includes(q.status) ? [q.status as "DRAFT" | "RELEASED" | "COMPLETED" | "CANCELLED"] : [] } } : {}), ...(q.q ? { OR: ["number", "bomCode", "outputCode", "outputName", "description"].map((field) => ({ [field]: { contains: q.q, mode: "insensitive" } })) } : {}) };
    return this.prisma.$transaction(async (tx) => { const meta = productionPaging(await tx.workOrder.count({ where }), q.page, q.pageSize); const rows = await tx.workOrder.findMany({ where, include: workOrderInclude, orderBy: [{ date: q.direction }, { createdAt: q.direction }, { id: "asc" }], take: meta.pageSize, skip: (meta.page - 1) * meta.pageSize }); return { data: rows.map(serializeWorkOrder), meta }; }, { isolationLevel: "RepeatableRead" });
  }
  async detail(companyId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.workOrder.findFirst({ where: { companyId, id }, include: workOrderInclude }); if (!row) throw new NotFoundException("Work Order tidak ditemukan");
      const balances = await tx.stockBalance.findMany({ where: { companyId, warehouseId: row.warehouseId, itemId: { in: row.lines.map((l) => l.itemId) } } });
      return { ...serializeWorkOrder(row), availability: row.lines.map((l) => { const available = balances.find((b) => b.itemId === l.itemId)?.quantity || 0; return { itemId: l.itemId, available, required: l.quantity, shortage: Math.max(0, l.quantity - available) }; }) };
    }, { isolationLevel: "RepeatableRead" });
  }
  async create(companyId: string, actorId: string, body: unknown) {
    const input = validate(workOrderSchema, body), requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    return this.prisma.$transaction(async (tx) => {
      const company = await productionAccess(tx, companyId, actorId);
      const existing = await tx.workOrder.findUnique({ where: { companyId_requestKey: { companyId, requestKey: input.requestKey } }, include: workOrderInclude });
      if (existing) { if (existing.requestHash !== requestHash || existing.createdBy !== actorId) throw new ConflictException("Kunci permintaan sudah digunakan dengan data berbeda"); return serializeWorkOrder(existing); }
      const bom = await tx.billOfMaterials.findFirst({ where: { companyId, id: input.bomId, status: "ACTIVE" }, include: bomInclude }); if (!bom) throw new BadRequestException("Pilih BOM aktif dari company yang sama.");
      const warehouse = await productionWarehouse(tx, companyId, input.warehouseId);
      await productionItems(tx, companyId, [bom.outputItemId, ...bom.lines.map((l) => l.itemId)]);
      if ([bom.outputQuantity, ...bom.lines.map((l) => l.quantity)].some((q) => q * input.batches > 1000000)) throw new BadRequestException("Jumlah hasil atau bahan baku setelah dikalikan batch maksimal 1.000.000.");
      const year = Number(input.date.slice(0, 4)), sequence = await tx.documentSequence.upsert({ where: { companyId_prefix_year: { companyId, prefix: "WO", year } }, create: { companyId, prefix: "WO", year, value: 1 }, update: { value: { increment: 1 } } });
      const row = await tx.workOrder.create({ data: { companyId, requestKey: input.requestKey, requestHash, number: `WO-${company.code}-${year}-${String(sequence.value).padStart(5, "0")}`, bomId: bom.id, bomCode: bom.code, bomName: bom.name, batches: input.batches, date: new Date(input.date), description: input.description, outputItemId: bom.outputItemId, outputCode: bom.outputCode, outputName: bom.outputName, outputUnit: bom.outputUnit, outputQuantity: bom.outputQuantity * input.batches, warehouseId: warehouse.id, warehouseName: warehouse.record.name, currency: company.currency, createdBy: actorId, lines: { create: bom.lines.map((l) => ({ itemId: l.itemId, itemCode: l.itemCode, itemName: l.itemName, unit: l.unit, quantity: l.quantity * input.batches })) } }, include: workOrderInclude });
      const after = serializeWorkOrder(row); await productionAudit(tx, companyId, actorId, "work-orders", row.id, "CREATE", { after }); return after;
    }, { isolationLevel: "Serializable" });
  }
  async action(companyId: string, actorId: string, id: string, body: unknown) {
    const input = validate(workOrderActionSchema, body);
    return this.prisma.$transaction(async (tx) => {
      await productionAccess(tx, companyId, actorId);
      const row = await tx.workOrder.findFirst({ where: { companyId, id }, include: workOrderInclude }); if (!row) throw new NotFoundException("Work Order tidak ditemukan");
      const allowed = input.action === "release" ? row.status === "DRAFT" : input.action === "complete" ? row.status === "RELEASED" : ["DRAFT", "RELEASED"].includes(row.status);
      if (!allowed || row.updatedAt.toISOString() !== input.expectedUpdatedAt) throw new ConflictException("Status atau versi Work Order telah berubah. Muat ulang sebelum melanjutkan.");
      let amount: Prisma.Decimal | null = null;
      if (input.action !== "cancel") {
        await productionItems(tx, companyId, [row.outputItemId, ...row.lines.map((l) => l.itemId)]); await productionWarehouse(tx, companyId, row.warehouseId);
        if (input.action === "release" && !(await tx.billOfMaterials.findFirst({ where: { companyId, id: row.bomId, status: "ACTIVE" } }))) throw new ConflictException("BOM sudah tidak aktif. Batalkan draft dan pilih BOM aktif.");
      }
      if (input.action === "complete") {
        const postingDate = new Date(input.postingDate!);
        const costs: { line: (typeof row.lines)[number]; unitPrice: Prisma.Decimal; value: Prisma.Decimal }[] = [];
        for (const line of [...row.lines].sort((a, b) => a.itemId.localeCompare(b.itemId))) {
          await assertStockDate(tx, companyId, line.itemId, [row.warehouseId], postingDate);
          const balance = await tx.stockBalance.findUnique({ where: { companyId_itemId_warehouseId: { companyId, itemId: line.itemId, warehouseId: row.warehouseId } } });
          costs.push({ line, ...outgoingStockCost(balance, line.quantity) });
        }
        await assertStockDate(tx, companyId, row.outputItemId, [row.warehouseId], postingDate);
        amount = costs.reduce((sum, c) => sum.add(c.value), new Prisma.Decimal(0));
        if (amount.gt(1e12)) throw new ConflictException("Nilai produksi maksimal 1.000.000.000.000.");
        for (const { line, unitPrice, value } of costs) {
          await tx.workOrderLine.update({ where: { id: line.id }, data: { cost: value } });
          await postStockMovement(tx, { companyId, workOrderId: id, itemId: line.itemId, warehouseId: row.warehouseId, date: postingDate, quantity: -line.quantity, value: value.neg(), unitPrice });
        }
        await postStockMovement(tx, { companyId, workOrderId: id, itemId: row.outputItemId, warehouseId: row.warehouseId, date: postingDate, quantity: row.outputQuantity, value: amount, unitPrice: amount.div(row.outputQuantity).toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP) });
      }
      const saved = await tx.workOrder.update({ where: { id }, data: { status: input.action === "complete" ? "COMPLETED" : input.action === "release" ? "RELEASED" : "CANCELLED", ...(input.action === "complete" ? { amount, completedBy: actorId, completedAt: new Date(), completedDate: new Date(input.postingDate!) } : {}), updatedAt: new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1)) }, include: workOrderInclude });
      if (input.action === "complete") await postOperationalAccounting(tx, companyId, actorId, { workOrderId: id });
      const after = serializeWorkOrder(saved); await productionAudit(tx, companyId, actorId, "work-orders", id, input.action.toUpperCase(), { before: serializeWorkOrder(row), after }); return after;
    }, { isolationLevel: "Serializable", timeout: 15000 });
  }
}
