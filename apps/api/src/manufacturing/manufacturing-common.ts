import { requireCompanyWrite } from "../auth/write-access";
import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
export async function productionAccess(tx: Prisma.TransactionClient, companyId: string, actorId: string) {
  return (await requireCompanyWrite(tx, companyId, actorId)).company;
}
export async function productionItems(tx: Prisma.TransactionClient, companyId: string, ids: string[]) {
  const rows = await tx.item.findMany({ where: { companyId, id: { in: ids }, trackStock: true, record: { status: "ACTIVE" } }, include: { record: true } });
  if (rows.length !== new Set(ids).size) throw new BadRequestException("Pilih Items aktif dengan pelacakan Stock dari company yang sama.");
  return rows;
}
export async function productionWarehouse(tx: Prisma.TransactionClient, companyId: string, id: string) {
  const row = await tx.warehouse.findFirst({ where: { companyId, id, record: { status: "ACTIVE" } }, include: { record: true } });
  if (!row) throw new BadRequestException("Pilih Warehouse aktif dari company yang sama.");
  return row;
}
export async function productionAudit(tx: Prisma.TransactionClient, companyId: string, actorId: string, entity: string, entityId: string, action: string, changes: unknown) {
  await tx.auditLog.create({ data: { companyId, actorId, entity, entityId, action, changes: JSON.parse(JSON.stringify(changes)) as Prisma.InputJsonValue } });
}
export const bomInclude = { lines: { orderBy: { itemCode: "asc" as const } } } satisfies Prisma.BillOfMaterialsInclude;
export const workOrderInclude = { lines: { orderBy: { itemCode: "asc" as const } }, creator: { select: { name: true } }, completer: { select: { name: true } } } satisfies Prisma.WorkOrderInclude;
export function serializeBom(row: Prisma.BillOfMaterialsGetPayload<{ include: typeof bomInclude }>) {
  const { createdBy: _creator, createdAt, updatedAt, lines, ...fields } = row; void _creator;
  return { ...fields, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString(), lines: lines.map(({ companyId: _c, bomId: _b, ...line }) => { void _c; void _b; return line; }) };
}
export function serializeWorkOrder(row: Prisma.WorkOrderGetPayload<{ include: typeof workOrderInclude }>) {
  const { requestKey: _key, requestHash: _hash, createdBy: _creator, completedBy: _completer, creator, completer, date, completedAt, completedDate, createdAt, updatedAt, amount, lines, ...fields } = row;
  void _key; void _hash; void _creator; void _completer;
  return { ...fields, date: date.toISOString().slice(0, 10), completedDate: completedDate?.toISOString().slice(0, 10) || null, completedAt: completedAt?.toISOString() || null, creatorName: creator.name, completerName: completer?.name || null, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString(), amount: amount?.toNumber() ?? null, lines: lines.map(({ companyId: _c, workOrderId: _w, cost, ...line }) => { void _c; void _w; return { ...line, cost: cost?.toNumber() ?? null }; }) };
}
export function productionPaging(total: number, requested: number, pageSize: number) { const pageCount = Math.max(1, Math.ceil(total / pageSize)); return { total, page: Math.min(requested, pageCount), pageSize, pageCount }; }
