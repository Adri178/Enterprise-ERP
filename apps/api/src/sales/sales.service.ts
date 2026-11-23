import { requireCompanyWrite } from "../auth/write-access";
import { postOperationalAccounting } from "../accounting/automatic-posting";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  quotationSchema,
  salesFromSourceSchema,
  salesActionSchema,
  salesQuerySchema,
  nextSalesKind,
  type SalesKind,
} from "@erp/shared";
import { PrismaService } from "../prisma/prisma.module";
import { validate } from "../common/validation";
import {
  assertStockDate,
  outgoingStockCost,
  postStockMovement,
} from "../procurement/stock-posting";
import { salesInclude, serializeSales } from "./sales-serializer";
type Tx = Prisma.TransactionClient;
const prefixes: Record<SalesKind, string> = {
  QUOTATION: "QTN",
  SALES_ORDER: "SO",
  DELIVERY_NOTE: "DN",
  SALES_INVOICE: "SINV",
  PAYMENT: "RCV",
};
@Injectable()
export class SalesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private async access(tx: Tx, companyId: string, actorId: string) { return (await requireCompanyWrite(tx, companyId, actorId)).company; }
  private async number(
    tx: Tx,
    companyId: string,
    code: string,
    kind: SalesKind,
    date: string,
  ) {
    const year = Number(date.slice(0, 4)),
      prefix = prefixes[kind];
    const seq = await tx.documentSequence.upsert({
      where: { companyId_prefix_year: { companyId, prefix, year } },
      create: { companyId, prefix, year, value: 1 },
      update: { value: { increment: 1 } },
    });
    return `${prefix}-${code}-${year}-${String(seq.value).padStart(5, "0")}`;
  }
  async list(companyId: string, body: unknown) {
    const query = validate(salesQuerySchema, body);
    const where: Prisma.SalesDocumentWhereInput = {
      companyId,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.status === "ALL" ? {} : { status: query.status }),
      ...(query.q
        ? {
            OR: [
              { number: { contains: query.q, mode: "insensitive" } },
              { customerName: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    return this.prisma.$transaction(
      async (tx) => {
        const total = await tx.salesDocument.count({ where }),
          pageCount = Math.max(1, Math.ceil(total / query.pageSize)),
          page = Math.min(query.page, pageCount);
        const rows = await tx.salesDocument.findMany({
          where,
          include: salesInclude,
          orderBy: [
            { date: query.direction },
            { createdAt: query.direction },
            { id: "asc" },
          ],
          take: query.pageSize,
          skip: (page - 1) * query.pageSize,
        });
        return {
          data: rows.map(serializeSales),
          meta: { total, page, pageSize: query.pageSize, pageCount },
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async detail(companyId: string, id: string) {
    const doc = await this.prisma.salesDocument.findFirst({
      where: { companyId, id },
      include: salesInclude,
    });
    if (!doc) throw new NotFoundException("Dokumen Sales tidak ditemukan");
    return serializeSales(doc);
  }
  async create(companyId: string, actorId: string, body: unknown) {
    const input = validate(quotationSchema, body),
      requestHash = createHash("sha256")
        .update(JSON.stringify(input))
        .digest("hex");
    return this.prisma.$transaction(
      async (tx) => {
        const company = await this.access(tx, companyId, actorId);
        const retry = await tx.salesDocument.findUnique({
          where: {
            companyId_requestKey: { companyId, requestKey: input.requestKey },
          },
          include: salesInclude,
        });
        if (retry) {
          if (retry.requestHash !== requestHash || retry.createdBy !== actorId)
            throw new ConflictException(
              "Kunci permintaan sudah digunakan dengan data berbeda",
            );
          return serializeSales(retry);
        }
        const customer = await tx.customer.findFirst({
          where: {
            id: input.customerId,
            companyId,
            record: { status: "ACTIVE" },
          },
          include: { record: true },
        });
        const warehouse = await tx.warehouse.findFirst({
          where: {
            id: input.warehouseId,
            companyId,
            record: { status: "ACTIVE" },
          },
          include: { record: true },
        });
        const items = await tx.item.findMany({
          where: {
            companyId,
            id: { in: input.lines.map((l) => l.itemId) },
            trackStock: true,
            record: { status: "ACTIVE" },
          },
          include: { record: true },
        });
        if (!customer || !warehouse || items.length !== input.lines.length)
          throw new BadRequestException(
            "Pilih Customer, Warehouse, dan Items aktif yang dilacak Stock-nya dari company yang sama",
          );
        const lines = input.lines.map((line) => {
          const item = items.find((i) => i.id === line.itemId)!,
            unitPrice = new Prisma.Decimal(line.unitPrice);
          return {
            itemId: item.id,
            itemCode: item.record.code,
            itemName: item.record.name,
            unit: item.unit,
            quantity: line.quantity,
            unitPrice,
            amount: unitPrice.mul(line.quantity),
          };
        });
        const doc = await tx.salesDocument.create({
          data: {
            companyId,
            number: await this.number(
              tx,
              companyId,
              company.code,
              "QUOTATION",
              input.date,
            ),
            kind: "QUOTATION",
            requestKey: input.requestKey,
            requestHash,
            date: new Date(input.date),
            description: input.description,
            customerId: customer.id,
            customerName: customer.record.name,
            warehouseId: warehouse.id,
            warehouseName: warehouse.record.name,
            currency: company.currency,
            amount: lines.reduce(
              (sum, l) => sum.add(l.amount),
              new Prisma.Decimal(0),
            ),
            createdBy: actorId,
            lines: { create: lines },
          },
          include: salesInclude,
        });
        await tx.auditLog.create({
          data: {
            companyId,
            actorId,
            entity: "sales",
            entityId: doc.id,
            action: "CREATE",
            changes: { number: doc.number, kind: doc.kind },
          },
        });
        return serializeSales(doc);
      },
      { isolationLevel: "Serializable" },
    );
  }
  async fromSource(companyId: string, actorId: string, body: unknown) {
    const input = validate(salesFromSourceSchema, body),
      requestHash = createHash("sha256")
        .update(JSON.stringify(input))
        .digest("hex");
    return this.prisma.$transaction(
      async (tx) => {
        const company = await this.access(tx, companyId, actorId);
        const retry = await tx.salesDocument.findUnique({
          where: {
            companyId_requestKey: { companyId, requestKey: input.requestKey },
          },
          include: salesInclude,
        });
        if (retry) {
          if (retry.requestHash !== requestHash || retry.createdBy !== actorId)
            throw new ConflictException(
              "Kunci permintaan sudah digunakan dengan data berbeda",
            );
          return serializeSales(retry);
        }
        const source = await tx.salesDocument.findFirst({
          where: { companyId, id: input.sourceId },
          include: salesInclude,
        });
        if (!source)
          throw new NotFoundException("Dokumen sumber tidak ditemukan");
        if (
          nextSalesKind[source.kind] !== input.kind ||
          source.status !== "POSTED"
        )
          throw new ConflictException(
            "Status atau jenis dokumen sumber belum memenuhi Workflow",
          );
        if (
          source.successors.some(
            (s) => s.kind === input.kind && s.status !== "CANCELLED",
          )
        )
          throw new ConflictException(
            "Dokumen lanjutan sudah dibuat. Buka dokumen yang tersedia.",
          );
        if (input.date < source.date.toISOString().slice(0, 10))
          throw new BadRequestException(
            "Tanggal tidak boleh mendahului dokumen sumber",
          );
        const doc = await tx.salesDocument.create({
          data: {
            companyId,
            number: await this.number(
              tx,
              companyId,
              company.code,
              input.kind,
              input.date,
            ),
            kind: input.kind,
            requestKey: input.requestKey,
            requestHash,
            sourceId: source.id,
            customerId: source.customerId,
            customerName: source.customerName,
            warehouseId: source.warehouseId,
            warehouseName: source.warehouseName,
            date: new Date(input.date),
            description: input.description,
            currency: source.currency,
            amount: source.amount,
            createdBy: actorId,
            lines:
              input.kind === "PAYMENT"
                ? undefined
                : {
                    create: source.lines.map((l) => ({
                      itemId: l.itemId,
                      itemCode: l.itemCode,
                      itemName: l.itemName,
                      unit: l.unit,
                      quantity: l.quantity,
                      unitPrice: l.unitPrice,
                      amount: l.amount,
                      stockCost: l.stockCost,
                    })),
                  },
          },
          include: salesInclude,
        });
        await tx.auditLog.create({
          data: {
            companyId,
            actorId,
            entity: "sales",
            entityId: doc.id,
            action: "CREATE",
            changes: {
              number: doc.number,
              sourceId: source.id,
              kind: doc.kind,
            },
          },
        });
        return serializeSales(doc);
      },
      { isolationLevel: "Serializable" },
    );
  }
  async action(companyId: string, actorId: string, id: string, body: unknown) {
    const input = validate(salesActionSchema, body);
    return this.prisma.$transaction(
      async (tx) => {
        await this.access(tx, companyId, actorId);
        const doc = await tx.salesDocument.findFirst({
          where: { companyId, id },
          include: salesInclude,
        });
        if (!doc) throw new NotFoundException("Dokumen Sales tidak ditemukan");
        if (doc.updatedAt.toISOString() !== input.expectedUpdatedAt)
          throw new ConflictException(
            "Dokumen telah berubah. Muat ulang sebelum melanjutkan.",
          );
        if (doc.status !== "DRAFT")
          throw new ConflictException(
            "Hanya dokumen Draft yang dapat dibukukan atau dibatalkan",
          );
        if (input.action === "post") {
          if (doc.sourceId) {
            const source = await tx.salesDocument.findFirst({
              where: { companyId, id: doc.sourceId, status: "POSTED" },
            });
            if (!source || nextSalesKind[source.kind] !== doc.kind)
              throw new ConflictException("Dokumen sumber tidak valid");
          }
          const customer = await tx.customer.findFirst({
            where: { companyId, id: doc.customerId },
            include: { record: true },
          });
          if (
            !customer ||
            (doc.kind !== "PAYMENT" && customer.record.status !== "ACTIVE")
          )
            throw new ConflictException(
              "Customer harus berstatus Aktif untuk memproses dokumen baru",
            );
          if (doc.kind === "DELIVERY_NOTE") {
            const warehouse = await tx.warehouse.count({
              where: {
                companyId,
                id: doc.warehouseId,
                record: { status: "ACTIVE" },
              },
            });
            const itemCount = await tx.item.count({
              where: {
                companyId,
                id: { in: doc.lines.map((l) => l.itemId) },
                trackStock: true,
                record: { status: "ACTIVE" },
              },
            });
            if (!warehouse || itemCount !== doc.lines.length)
              throw new ConflictException(
                "Items dan Warehouse harus aktif serta menggunakan pelacakan Stock",
              );
            let totalCost = new Prisma.Decimal(0);
            for (const line of doc.lines) {
              await assertStockDate(
                tx,
                companyId,
                line.itemId,
                [doc.warehouseId],
                doc.date,
              );
              const balance = await tx.stockBalance.findUnique({
                  where: {
                    companyId_itemId_warehouseId: {
                      companyId,
                      itemId: line.itemId,
                      warehouseId: doc.warehouseId,
                    },
                  },
                }),
                cost = outgoingStockCost(balance, line.quantity);
              totalCost = totalCost.add(cost.value);
              if (totalCost.gt(1e12))
                throw new ConflictException(
                  "Nilai Stock dokumen maksimal 1.000.000.000.000",
                );
              await postStockMovement(tx, {
                companyId,
                salesDocumentId: id,
                itemId: line.itemId,
                warehouseId: doc.warehouseId,
                date: doc.date,
                quantity: -line.quantity,
                value: cost.value.negated(),
                unitPrice: cost.unitPrice,
              });
              await tx.salesLine.update({
                where: { id: line.id },
                data: { stockCost: cost.value },
              });
            }
          }
          if (doc.kind === "SALES_INVOICE" && customer.creditLimit.gt(0)) {
            const totals = await tx.salesDocument.groupBy({
              by: ["kind"],
              where: {
                companyId,
                customerId: customer.id,
                status: "POSTED",
                kind: { in: ["SALES_INVOICE", "PAYMENT"] },
              },
              _sum: { amount: true },
            });
            const sum = (kind: SalesKind) =>
              totals.find((t) => t.kind === kind)?._sum.amount ||
              new Prisma.Decimal(0);
            if (
              sum("SALES_INVOICE")
                .sub(sum("PAYMENT"))
                .add(doc.amount)
                .gt(customer.creditLimit)
            )
              throw new ConflictException(
                "Credit Limit Customer tidak mencukupi. Catat Payment Invoice sebelumnya atau perbarui Credit Limit sebelum membukukan Invoice ini.",
              );
          }
        }
        const updated = await tx.salesDocument.update({
          where: { companyId_id: { companyId, id } },
          data: {
            status: input.action === "post" ? "POSTED" : "CANCELLED",
            updatedAt: new Date(
              Math.max(Date.now(), doc.updatedAt.getTime() + 1),
            ),
          },
          include: salesInclude,
        });
        await tx.auditLog.create({
          data: {
            companyId,
            actorId,
            entity: "sales",
            entityId: id,
            action: input.action.toUpperCase(),
            changes: {
              number: doc.number,
              before: doc.status,
              after: updated.status,
            },
          },
        });
        if (input.action === "post") await postOperationalAccounting(tx, companyId, actorId, { salesId: id });
        return serializeSales(updated);
      },
      { isolationLevel: "Serializable" },
    );
  }
  async summary(companyId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const groups = await tx.salesDocument.groupBy({
          by: ["kind"],
          where: { companyId, status: "POSTED" },
          _sum: { amount: true },
          _count: true,
        });
        const sum = (kind: SalesKind) =>
            groups.find((g) => g.kind === kind)?._sum.amount ||
            new Prisma.Decimal(0),
          sales = sum("SALES_INVOICE"),
          received = sum("PAYMENT");
        const cost = await tx.salesLine.aggregate({
          where: {
            companyId,
            document: { kind: "DELIVERY_NOTE", status: "POSTED" },
          },
          _sum: { stockCost: true },
        });
        return {
          sales: sales.toNumber(),
          received: received.toNumber(),
          outstanding: sales.sub(received).toNumber(),
          ordersPosted:
            groups.find((g) => g.kind === "SALES_ORDER")?._count || 0,
          deliveredValue: cost._sum.stockCost?.toNumber() || 0,
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async analytics(companyId: string) {
    const now = new Date(),
      start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1),
      ),
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const groups = await this.prisma.salesDocument.groupBy({
      by: ["date", "kind"],
      where: {
        companyId,
        status: "POSTED",
        kind: { in: ["SALES_INVOICE", "PAYMENT"] },
        date: { gte: start, lt: end },
      },
      _sum: { amount: true },
    });
    return Array.from({ length: 6 }, (_, index) => {
      const month = new Date(
          Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1),
        )
          .toISOString()
          .slice(0, 7),
        sum = (kind: SalesKind) =>
          groups
            .filter(
              (g) => g.kind === kind && g.date.toISOString().startsWith(month),
            )
            .reduce((s, g) => s.add(g._sum.amount || 0), new Prisma.Decimal(0))
            .toNumber();
      return { month, sales: sum("SALES_INVOICE"), payment: sum("PAYMENT") };
    });
  }
}
