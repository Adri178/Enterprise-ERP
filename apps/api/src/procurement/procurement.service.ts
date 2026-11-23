import { requireCompanyWrite } from "../auth/write-access";
import { postOperationalAccounting } from "../accounting/automatic-posting";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import {
  allowedPurchaseActions,
  nextPurchaseKind,
  purchaseRequestSchema,
  purchaseFromSourceSchema,
  purchaseActionSchema,
  type PurchaseQuery,
  type PurchaseKind,
} from "@erp/shared";
import { PrismaService } from "../prisma/prisma.module";
import { validate } from "../common/validation";
import { purchaseInclude, serializePurchase } from "./purchase-serializer";
import { assertStockDate, postStockMovement } from "./stock-posting";
type Tx = Prisma.TransactionClient;
const prefixes: Record<PurchaseKind, string> = {
  PURCHASE_REQUEST: "PR",
  PURCHASE_ORDER: "PO",
  PURCHASE_RECEIPT: "GRN",
  PURCHASE_INVOICE: "PINV",
  PAYMENT: "PAY",
};
@Injectable()
export class ProcurementService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private async company(tx: Tx, companyId: string, actorId: string) { return (await requireCompanyWrite(tx, companyId, actorId)).company; }
  private async number(
    tx: Tx,
    companyId: string,
    code: string,
    kind: PurchaseKind,
    date: string,
  ) {
    const prefix = prefixes[kind],
      year = Number(date.slice(0, 4));
    const sequence = await tx.documentSequence.upsert({
      where: { companyId_prefix_year: { companyId, prefix, year } },
      create: { companyId, prefix, year, value: 1 },
      update: { value: { increment: 1 } },
    });
    return `${prefix}-${code}-${year}-${String(sequence.value).padStart(5, "0")}`;
  }
  private async audit(
    tx: Tx,
    companyId: string,
    actorId: string,
    entityId: string,
    action: string,
    changes: Prisma.InputJsonValue,
  ) {
    await tx.auditLog.create({
      data: {
        companyId,
        actorId,
        entityId,
        entity: "procurement",
        action,
        changes,
      },
    });
  }
  async list(companyId: string, query: PurchaseQuery) {
    const where: Prisma.PurchaseDocumentWhereInput = {
      companyId,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.status === "ALL" ? {} : { status: query.status }),
      ...(query.q
        ? {
            OR: [
              { number: { contains: query.q, mode: "insensitive" } },
              { supplierName: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    return this.prisma.$transaction(
      async (tx) => {
        const total = await tx.purchaseDocument.count({ where });
        const pageCount = Math.max(1, Math.ceil(total / query.pageSize)),
          page = Math.min(query.page, pageCount);
        const rows = await tx.purchaseDocument.findMany({
          where,
          include: purchaseInclude,
          orderBy: [
            { date: query.direction },
            { createdAt: query.direction },
            { id: "asc" },
          ],
          skip: (page - 1) * query.pageSize,
          take: query.pageSize,
        });
        return {
          data: rows.map(serializePurchase),
          meta: { total, page, pageSize: query.pageSize, pageCount },
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async detail(companyId: string, id: string) {
    const row = await this.prisma.purchaseDocument.findFirst({
      where: { companyId, id },
      include: purchaseInclude,
    });
    if (!row) throw new NotFoundException("Dokumen tidak ditemukan");
    return serializePurchase(row);
  }
  async createRequest(companyId: string, actorId: string, body: unknown) {
    const input = validate(purchaseRequestSchema, body);
    const requestHash = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
    return this.prisma.$transaction(
      async (tx) => {
        const company = await this.company(tx, companyId, actorId);
        const retry = await tx.purchaseDocument.findUnique({
          where: {
            companyId_requestKey: { companyId, requestKey: input.requestKey },
          },
          include: purchaseInclude,
        });
        if (retry) {
          if (retry.requestHash !== requestHash || retry.createdBy !== actorId)
            throw new ConflictException(
              "Kunci permintaan sudah digunakan dengan data berbeda",
            );
          return serializePurchase(retry);
        }
        const supplier = await tx.supplier.findFirst({
          where: {
            id: input.supplierId,
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
        if (!supplier || !warehouse)
          throw new BadRequestException(
            "Pilih Supplier dan Warehouse aktif dari company yang sama",
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
        const lines = input.lines.map((line) => {
          const item = items.find((i) => i.id === line.itemId)!;
          const unitPrice = new Prisma.Decimal(line.unitPrice),
            amount = unitPrice.mul(line.quantity);
          return {
            itemId: item.id,
            itemCode: item.record.code,
            itemName: item.record.name,
            unit: item.unit,
            quantity: line.quantity,
            unitPrice,
            amount,
          };
        });
        const amount = lines.reduce(
          (sum, l) => sum.add(l.amount),
          new Prisma.Decimal(0),
        );
        const document = await tx.purchaseDocument.create({
          data: {
            companyId,
            requestKey: input.requestKey,
            requestHash,
            number: await this.number(
              tx,
              companyId,
              company.code,
              "PURCHASE_REQUEST",
              input.date,
            ),
            kind: "PURCHASE_REQUEST",
            date: new Date(input.date),
            description: input.description,
            supplierId: supplier.id,
            supplierName: supplier.record.name,
            warehouseId: warehouse.id,
            warehouseName: warehouse.record.name,
            currency: company.currency,
            amount,
            createdBy: actorId,
            lines: { create: lines },
          },
          include: purchaseInclude,
        });
        await this.audit(tx, companyId, actorId, document.id, "CREATE", {
          number: document.number,
          kind: document.kind,
          amount: amount.toString(),
        });
        return serializePurchase(document);
      },
      { isolationLevel: "Serializable" },
    );
  }
  async createFromSource(companyId: string, actorId: string, body: unknown) {
    const input = validate(purchaseFromSourceSchema, body);
    const requestHash = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
    return this.prisma.$transaction(
      async (tx) => {
        const company = await this.company(tx, companyId, actorId);
        const retry = await tx.purchaseDocument.findUnique({
          where: {
            companyId_requestKey: { companyId, requestKey: input.requestKey },
          },
          include: purchaseInclude,
        });
        if (retry) {
          if (retry.requestHash !== requestHash || retry.createdBy !== actorId)
            throw new ConflictException(
              "Kunci permintaan sudah digunakan dengan data berbeda",
            );
          return serializePurchase(retry);
        }
        await tx.$queryRaw`SELECT id FROM "PurchaseDocument" WHERE "companyId" = ${companyId} AND id = ${input.sourceId} FOR UPDATE`;
        const source = await tx.purchaseDocument.findFirst({
          where: { companyId, id: input.sourceId },
          include: purchaseInclude,
        });
        if (!source)
          throw new NotFoundException("Dokumen sumber tidak ditemukan");
        if (source.kind === "PURCHASE_REQUEST" && await tx.rfq.count({ where: { companyId, sourceId: source.id, status: { notIn: ["CANCELLED", "REJECTED"] } } }))
          throw new ConflictException("Purchase Request memiliki RFQ aktif. Buat Purchase Order melalui RFQ yang Disetujui.");
        if (
          nextPurchaseKind[source.kind] !== input.kind ||
          source.status !==
            (source.kind === "PURCHASE_REQUEST" ? "APPROVED" : "POSTED")
        )
          throw new ConflictException(
            "Status atau jenis dokumen sumber belum memenuhi Workflow",
          );
        if (
          source.successors.some(
            (d) => d.kind === input.kind && d.status !== "CANCELLED",
          )
        )
          throw new ConflictException(
            "Dokumen lanjutan sudah dibuat. Buka dokumen yang tersedia.",
          );
        if (input.date < source.date.toISOString().slice(0, 10))
          throw new BadRequestException(
            "Tanggal tidak boleh mendahului dokumen sumber",
          );
        const document = await tx.purchaseDocument.create({
          data: {
            companyId,
            requestKey: input.requestKey,
            requestHash,
            number: await this.number(
              tx,
              companyId,
              company.code,
              input.kind,
              input.date,
            ),
            kind: input.kind,
            date: new Date(input.date),
            description: input.description,
            sourceId: source.id,
            supplierId: source.supplierId,
            supplierName: source.supplierName,
            warehouseId: source.warehouseId,
            warehouseName: source.warehouseName,
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
                    })),
                  },
          },
          include: purchaseInclude,
        });
        await this.audit(tx, companyId, actorId, document.id, "CREATE", {
          number: document.number,
          sourceId: source.id,
          kind: document.kind,
        });
        return serializePurchase(document);
      },
      { isolationLevel: "Serializable" },
    );
  }
  async action(companyId: string, actorId: string, id: string, body: unknown) {
    const input = validate(purchaseActionSchema, body);
    return this.prisma.$transaction(
      async (tx) => {
        await this.company(tx, companyId, actorId);
        const document = await tx.purchaseDocument.findFirst({
          where: { companyId, id },
          include: purchaseInclude,
        });
        if (!document) throw new NotFoundException("Dokumen tidak ditemukan");
        if (document.updatedAt.toISOString() !== input.expectedUpdatedAt)
          throw new ConflictException(
            "Dokumen telah berubah. Muat ulang sebelum melanjutkan.",
          );
        if (
          !allowedPurchaseActions(document.kind, document.status).includes(
            input.action,
          )
        )
          throw new ConflictException("Perubahan status tidak diizinkan");
        if (input.action === "post") {
          const source = await tx.purchaseDocument.findFirst({
            where: { companyId, id: document.sourceId! },
          });
          if (
            !source ||
            source.status !==
              (source.kind === "PURCHASE_REQUEST" ? "APPROVED" : "POSTED")
          )
            throw new ConflictException("Dokumen sumber tidak valid");
          if (document.kind === "PURCHASE_RECEIPT") {
            const ids = document.lines.map((l) => l.itemId);
            const valid = await tx.item.count({
              where: {
                companyId,
                id: { in: ids },
                trackStock: true,
                record: { status: "ACTIVE" },
              },
            });
            const warehouse = await tx.warehouse.count({
              where: {
                companyId,
                id: document.warehouseId,
                record: { status: "ACTIVE" },
              },
            });
            if (valid !== ids.length || !warehouse)
              throw new ConflictException(
                "Items dan Warehouse harus aktif serta menggunakan pelacakan Stock",
              );
            for (const line of document.lines) {
              await assertStockDate(
                tx,
                companyId,
                line.itemId,
                [document.warehouseId],
                document.date,
              );
              await postStockMovement(tx, {
                companyId,
                documentId: id,
                itemId: line.itemId,
                warehouseId: document.warehouseId,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                value: line.amount,
                date: document.date,
              });
            }
          }
        }
        const statuses = {
          submit: "PENDING",
          approve: "APPROVED",
          reject: "REJECTED",
          post: "POSTED",
          cancel: "CANCELLED",
        } as const;
        const updated = await tx.purchaseDocument.update({
          where: { companyId_id: { companyId, id } },
          data: {
            status: statuses[input.action],
            updatedAt: new Date(
              Math.max(Date.now(), document.updatedAt.getTime() + 1),
            ),
          },
          include: purchaseInclude,
        });
        await this.audit(
          tx,
          companyId,
          actorId,
          id,
          input.action.toUpperCase(),
          {
            number: document.number,
            before: document.status,
            after: updated.status,
          },
        );
        if (input.action === "post") await postOperationalAccounting(tx, companyId, actorId, { purchaseId: id });
        return serializePurchase(updated);
      },
      { isolationLevel: "Serializable" },
    );
  }
  async summary(companyId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const groups = await tx.purchaseDocument.groupBy({
          by: ["kind", "status"],
          where: { companyId },
          _count: true,
          _sum: { amount: true },
        });
        const group = (kind: PurchaseKind, status: "POSTED" | "PENDING") =>
          groups.find((g) => g.kind === kind && g.status === status);
        const purchases =
            group("PURCHASE_INVOICE", "POSTED")?._sum.amount ||
            new Prisma.Decimal(0),
          paid =
            group("PAYMENT", "POSTED")?._sum.amount || new Prisma.Decimal(0);
        const stock = await tx.stockBalance.aggregate({
          where: { companyId },
          _sum: { quantity: true, value: true },
        });
        return {
          requestsPending: group("PURCHASE_REQUEST", "PENDING")?._count || 0,
          ordersPosted: group("PURCHASE_ORDER", "POSTED")?._count || 0,
          purchases: purchases.toNumber(),
          paid: paid.toNumber(),
          outstanding: purchases.sub(paid).toNumber(),
          inventoryValue: stock._sum.value?.toNumber() || 0,
          inventoryQuantity: stock._sum.quantity || 0,
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async analytics(companyId: string) {
    const today = new Date();
    const start = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5, 1),
    );
    const end = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1),
    );
    const groups = await this.prisma.purchaseDocument.groupBy({
      by: ["date", "kind"],
      where: {
        companyId,
        status: "POSTED",
        kind: { in: ["PURCHASE_INVOICE", "PAYMENT"] },
        date: { gte: start, lt: end },
      },
      _sum: { amount: true },
    });
    return Array.from({ length: 6 }, (_, index) => {
      const month = new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1),
      )
        .toISOString()
        .slice(0, 7);
      const sum = (kind: PurchaseKind) =>
        groups
          .filter(
            (g) => g.kind === kind && g.date.toISOString().startsWith(month),
          )
          .reduce(
            (total, g) => total.add(g._sum.amount || 0),
            new Prisma.Decimal(0),
          )
          .toNumber();
      return {
        month,
        purchases: sum("PURCHASE_INVOICE"),
        payment: sum("PAYMENT"),
      };
    });
  }
}
