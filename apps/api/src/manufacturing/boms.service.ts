import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { bomSchema, bomActionSchema, manufacturingQuerySchema, manufacturingVersionSchema } from "@erp/shared";
import { PrismaService } from "../prisma/prisma.module";
import { validate } from "../common/validation";
import { bomInclude, productionAccess, productionAudit, productionItems, productionPaging, serializeBom } from "./manufacturing-common";
@Injectable()
export class BomsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async list(companyId: string, body: unknown) {
    const q = validate(manufacturingQuerySchema, body);
    const where: Prisma.BillOfMaterialsWhereInput = { companyId, ...(q.status !== "ALL" ? { status: { in: ["DRAFT", "ACTIVE", "INACTIVE"].includes(q.status) ? [q.status as "DRAFT" | "ACTIVE" | "INACTIVE"] : [] } } : {}), ...(q.q ? { OR: ["code", "name", "outputCode", "outputName"].map((field) => ({ [field]: { contains: q.q, mode: "insensitive" } })) } : {}) };
    return this.prisma.$transaction(async (tx) => { const meta = productionPaging(await tx.billOfMaterials.count({ where }), q.page, q.pageSize); const rows = await tx.billOfMaterials.findMany({ where, include: bomInclude, orderBy: [{ code: q.direction }, { id: "asc" }], take: meta.pageSize, skip: (meta.page - 1) * meta.pageSize }); return { data: rows.map(serializeBom), meta }; }, { isolationLevel: "RepeatableRead" });
  }
  async detail(companyId: string, id: string) { const row = await this.prisma.billOfMaterials.findFirst({ where: { companyId, id }, include: bomInclude }); if (!row) throw new NotFoundException("BOM tidak ditemukan"); return serializeBom(row); }
  async save(companyId: string, actorId: string, body: unknown, id?: string) {
    const input = validate(bomSchema, body), version = id ? validate(manufacturingVersionSchema, body).expectedUpdatedAt : undefined;
    return this.prisma.$transaction(async (tx) => {
      await productionAccess(tx, companyId, actorId);
      const before = id ? await tx.billOfMaterials.findFirst({ where: { companyId, id }, include: bomInclude }) : null;
      if (id && !before) throw new NotFoundException("BOM tidak ditemukan");
      if (before && (before.status !== "DRAFT" || before.updatedAt.toISOString() !== version)) throw new ConflictException("Hanya draft BOM dengan versi terkini yang dapat diedit.");
      if (before && before.code !== input.code) throw new ConflictException("Kode BOM tidak dapat diubah setelah dibuat.");
      const items = await productionItems(tx, companyId, [input.outputItemId, ...input.lines.map((l) => l.itemId)]), output = items.find((i) => i.id === input.outputItemId)!;
      if (before) await tx.bomLine.deleteMany({ where: { companyId, bomId: before.id } });
      const data = { code: input.code, name: input.name, description: input.description, outputItemId: output.id, outputCode: output.record.code, outputName: output.record.name, outputUnit: output.unit, outputQuantity: input.outputQuantity, lines: { create: input.lines.map((l) => { const item = items.find((i) => i.id === l.itemId)!; return { itemId: item.id, itemCode: item.record.code, itemName: item.record.name, unit: item.unit, quantity: l.quantity }; }) } };
      const row = before ? await tx.billOfMaterials.update({ where: { id: before.id }, data: { ...data, updatedAt: new Date(Math.max(Date.now(), before.updatedAt.getTime() + 1)) }, include: bomInclude }) : await tx.billOfMaterials.create({ data: { ...data, companyId, createdBy: actorId }, include: bomInclude });
      const after = serializeBom(row); await productionAudit(tx, companyId, actorId, "boms", row.id, before ? "UPDATE" : "CREATE", { before: before ? serializeBom(before) : null, after }); return after;
    }, { isolationLevel: "Serializable" });
  }
  async action(companyId: string, actorId: string, id: string, body: unknown) {
    const input = validate(bomActionSchema, body);
    return this.prisma.$transaction(async (tx) => {
      await productionAccess(tx, companyId, actorId); const row = await tx.billOfMaterials.findFirst({ where: { companyId, id }, include: bomInclude });
      if (!row) throw new NotFoundException("BOM tidak ditemukan");
      if (row.updatedAt.toISOString() !== input.expectedUpdatedAt || (input.action === "activate" ? row.status !== "DRAFT" : row.status !== "ACTIVE")) throw new ConflictException("Status atau versi BOM telah berubah. Muat ulang sebelum melanjutkan.");
      if (input.action === "activate") await productionItems(tx, companyId, [row.outputItemId, ...row.lines.map((l) => l.itemId)]);
      const saved = await tx.billOfMaterials.update({ where: { id }, data: { status: input.action === "activate" ? "ACTIVE" : "INACTIVE", updatedAt: new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1)) }, include: bomInclude });
      const after = serializeBom(saved); await productionAudit(tx, companyId, actorId, "boms", id, input.action.toUpperCase(), { before: serializeBom(row), after }); return after;
    }, { isolationLevel: "Serializable" });
  }
}
