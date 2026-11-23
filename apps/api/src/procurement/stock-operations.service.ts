import { requireCompanyWrite } from "../auth/write-access";
import { postOperationalAccounting } from "../accounting/automatic-posting";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  stockOperationSchema,
  stockOperationActionSchema,
  stockOperationQuerySchema,
} from "@erp/shared";
import { PrismaService } from "../prisma/prisma.module";
import { validate } from "../common/validation";
import {
  assertStockDate,
  outgoingStockCost,
  postStockMovement,
} from "./stock-posting";
const include = {
  lines: { orderBy: { id: "asc" as const } },
} satisfies Prisma.StockOperationInclude;
function serialize(
  row: Prisma.StockOperationGetPayload<{ include: typeof include }>,
) {
  return {
    id: row.id,
    companyId: row.companyId,
    number: row.number,
    kind: row.kind,
    status: row.status,
    date: row.date.toISOString().slice(0, 10),
    warehouseId: row.warehouseId,
    warehouseName: row.warehouseName,
    targetWarehouseId: row.targetWarehouseId,
    targetWarehouseName: row.targetWarehouseName,
    description: row.description,
    currency: row.currency,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lines: row.lines.map((line) => ({
      ...line,
      unitPrice: line.unitPrice.toNumber(),
      value: line.value?.toNumber() ?? null,
    })),
  };
}
@Injectable()
export class StockOperationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private async access(tx: Prisma.TransactionClient, companyId: string, actorId: string) { return requireCompanyWrite(tx, companyId, actorId); }
  async list(companyId: string, body: unknown) {
    const query = validate(stockOperationQuerySchema, body);
    const where: Prisma.StockOperationWhereInput = {
      companyId,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.status === "ALL" ? {} : { status: query.status }),
      ...(query.q
        ? {
            OR: [
              { number: { contains: query.q, mode: "insensitive" } },
              { description: { contains: query.q, mode: "insensitive" } },
              { warehouseName: { contains: query.q, mode: "insensitive" } },
              {
                targetWarehouseName: { contains: query.q, mode: "insensitive" },
              },
            ],
          }
        : {}),
    };
    return this.prisma.$transaction(
      async (tx) => {
        const total = await tx.stockOperation.count({ where });
        const pageCount = Math.max(1, Math.ceil(total / query.pageSize)),
          page = Math.min(query.page, pageCount);
        const rows = await tx.stockOperation.findMany({
          where,
          include,
          orderBy: [
            { date: query.direction },
            { createdAt: query.direction },
            { id: "asc" },
          ],
          take: query.pageSize,
          skip: (page - 1) * query.pageSize,
        });
        return {
          data: rows.map(serialize),
          meta: { total, page, pageSize: query.pageSize, pageCount },
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async detail(companyId: string, id: string) {
    const row = await this.prisma.stockOperation.findFirst({
      where: { companyId, id },
      include,
    });
    if (!row) throw new NotFoundException("Dokumen Stock tidak ditemukan");
    return serialize(row);
  }
  async create(companyId: string, actorId: string, body: unknown) {
    const input = validate(stockOperationSchema, body);
    const requestHash = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
    return this.prisma.$transaction(
      async (tx) => {
        const member = await this.access(tx, companyId, actorId);
        const existing = await tx.stockOperation.findUnique({
          where: {
            companyId_requestKey: { companyId, requestKey: input.requestKey },
          },
          include,
        });
        if (existing) {
          if (
            existing.requestHash !== requestHash ||
            existing.createdBy !== actorId
          )
            throw new ConflictException(
              "Kunci permintaan sudah digunakan dengan data berbeda",
            );
          return serialize(existing);
        }
        const warehouseIds = [
          input.warehouseId,
          ...(input.targetWarehouseId ? [input.targetWarehouseId] : []),
        ];
        const warehouses = await tx.warehouse.findMany({
          where: {
            companyId,
            id: { in: warehouseIds },
            record: { status: "ACTIVE" },
          },
          include: { record: true },
        });
        if (warehouses.length !== warehouseIds.length)
          throw new BadRequestException(
            "Pilih Warehouse aktif dari company yang sama",
          );
        const items = await tx.item.findMany({
          where: {
            companyId,
            id: { in: input.lines.map((l) => l.itemId) },
            trackStock: true,
            record: { status: "ACTIVE" },
          },
          include: { record: true },
        });
        if (items.length !== input.lines.length)
          throw new BadRequestException(
            "Pilih Items aktif yang dilacak Stock-nya dari company yang sama",
          );
        const year = Number(input.date.slice(0, 4)),
          prefix = input.kind === "TRANSFER" ? "ST" : "SA";
        const sequence = await tx.documentSequence.upsert({
          where: { companyId_prefix_year: { companyId, prefix, year } },
          create: { companyId, prefix, year, value: 1 },
          update: { value: { increment: 1 } },
        });
        const operation = await tx.stockOperation.create({
          data: {
            companyId,
            requestKey: input.requestKey,
            requestHash,
            kind: input.kind,
            date: new Date(input.date),
            number: `${prefix}-${member.company.code}-${year}-${String(sequence.value).padStart(5, "0")}`,
            currency: member.company.currency,
            warehouseId: input.warehouseId,
            warehouseName: warehouses.find((w) => w.id === input.warehouseId)!
              .record.name,
            targetWarehouseId: input.targetWarehouseId || null,
            targetWarehouseName:
              warehouses.find((w) => w.id === input.targetWarehouseId)?.record
                .name || null,
            description: input.description,
            createdBy: actorId,
            lines: {
              create: input.lines.map((line) => {
                const item = items.find((i) => i.id === line.itemId)!;
                return {
                  itemId: line.itemId,
                  itemCode: item.record.code,
                  itemName: item.record.name,
                  unit: item.unit,
                  quantity: line.quantity,
                  unitPrice: new Prisma.Decimal(line.unitPrice),
                };
              }),
            },
          },
          include,
        });
        await tx.auditLog.create({
          data: {
            companyId,
            actorId,
            entity: "stock-operations",
            entityId: operation.id,
            action: "CREATE",
            changes: { kind: operation.kind, number: operation.number },
          },
        });
        return serialize(operation);
      },
      { isolationLevel: "Serializable" },
    );
  }
  async action(companyId: string, actorId: string, id: string, body: unknown) {
    const input = validate(stockOperationActionSchema, body);
    return this.prisma.$transaction(
      async (tx) => {
        const member = await this.access(tx, companyId, actorId);
        const operation = await tx.stockOperation.findFirst({
          where: { companyId, id },
          include,
        });
        if (!operation)
          throw new NotFoundException("Dokumen Stock tidak ditemukan");
        if (
          input.action === "post" &&
          operation.kind === "ADJUSTMENT" &&
          member.role !== "ADMIN"
        )
          throw new ForbiddenException(
            "Hanya ADMIN yang dapat membukukan Stock Adjustment",
          );
        if (operation.updatedAt.toISOString() !== input.expectedUpdatedAt)
          throw new ConflictException(
            "Dokumen telah berubah. Muat ulang sebelum melanjutkan.",
          );
        if (operation.status !== "DRAFT")
          throw new ConflictException(
            "Hanya dokumen Draft yang dapat dibukukan atau dibatalkan",
          );
        if (input.action === "post") {
          const warehouseIds = [
            operation.warehouseId,
            ...(operation.targetWarehouseId
              ? [operation.targetWarehouseId]
              : []),
          ];
          const warehouseCount = await tx.warehouse.count({
            where: {
              companyId,
              id: { in: warehouseIds },
              record: { status: "ACTIVE" },
            },
          });
          const itemCount = await tx.item.count({
            where: {
              companyId,
              id: { in: operation.lines.map((l) => l.itemId) },
              trackStock: true,
              record: { status: "ACTIVE" },
            },
          });
          if (
            warehouseCount !== warehouseIds.length ||
            itemCount !== operation.lines.length
          )
            throw new ConflictException(
              "Items dan Warehouse harus aktif serta menggunakan pelacakan Stock",
            );
          let totalValue = new Prisma.Decimal(0);
          for (const line of operation.lines) {
            await assertStockDate(
              tx,
              companyId,
              line.itemId,
              warehouseIds,
              operation.date,
            );
            const outgoing = operation.kind === "TRANSFER" || line.quantity < 0;
            const balance = outgoing
              ? await tx.stockBalance.findUnique({
                  where: {
                    companyId_itemId_warehouseId: {
                      companyId,
                      itemId: line.itemId,
                      warehouseId: operation.warehouseId,
                    },
                  },
                })
              : null;
            const cost = outgoing
              ? outgoingStockCost(balance, Math.abs(line.quantity))
              : {
                  unitPrice: line.unitPrice,
                  value: line.unitPrice.mul(line.quantity),
                };
            totalValue = totalValue.add(cost.value.abs());
            if (totalValue.gt(1e12))
              throw new ConflictException(
                "Nilai dokumen maksimal 1.000.000.000.000",
              );
            const value = outgoing ? cost.value.negated() : cost.value;
            const movement = {
              companyId,
              operationId: id,
              itemId: line.itemId,
              date: operation.date,
              unitPrice: cost.unitPrice,
            };
            await postStockMovement(tx, {
              ...movement,
              warehouseId: operation.warehouseId,
              quantity:
                operation.kind === "TRANSFER" ? -line.quantity : line.quantity,
              value,
            });
            if (operation.kind === "TRANSFER")
              await postStockMovement(tx, {
                ...movement,
                warehouseId: operation.targetWarehouseId!,
                quantity: line.quantity,
                value: cost.value,
              });
            await tx.stockOperationLine.update({
              where: { id: line.id },
              data: {
                unitPrice: cost.unitPrice,
                value: operation.kind === "TRANSFER" ? cost.value : value,
              },
            });
          }
        }
        const updated = await tx.stockOperation.update({
          where: { companyId_id: { companyId, id } },
          data: {
            status: input.action === "post" ? "POSTED" : "CANCELLED",
            updatedAt: new Date(
              Math.max(Date.now(), operation.updatedAt.getTime() + 1),
            ),
          },
          include,
        });
        await tx.auditLog.create({
          data: {
            companyId,
            actorId,
            entity: "stock-operations",
            entityId: id,
            action: input.action.toUpperCase(),
            changes: {
              number: operation.number,
              kind: operation.kind,
              before: operation.status,
              after: updated.status,
            },
          },
        });
        if (input.action === "post") await postOperationalAccounting(tx, companyId, actorId, { operationId: id });
        return serialize(updated);
      },
      { isolationLevel: "Serializable" },
    );
  }
}
