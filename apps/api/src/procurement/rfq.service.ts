import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { rfqActionSchema, rfqCreateSchema, rfqOfferSchema, rfqOrderSchema, rfqQuerySchema, rfqToday, type RfqDetail, type RfqEntry } from "@erp/shared";
import { PrismaService } from "../prisma/prisma.module";
import { requireCompanyWrite } from "../auth/write-access";
import { validate } from "../common/validation";
import { purchaseInclude, serializePurchase } from "./purchase-serializer";

type Tx = Prisma.TransactionClient;
const registerInclude = {
  source: { select: { number: true, currency: true, amount: true } },
  creator: { select: { name: true } }, proposer: { select: { name: true } }, reviewer: { select: { name: true } },
  selectedOffer: { select: { invitation: { select: { supplierName: true } } } },
  _count: { select: { suppliers: true, offers: true } },
  orders: { select: { id: true, number: true, status: true }, orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.RfqInclude;
const include = {
  ...registerInclude, source: { include: purchaseInclude },
  suppliers: { orderBy: { supplierName: "asc" as const } },
  offers: { include: { lines: { orderBy: { itemId: "asc" as const } }, invitation: true }, orderBy: [{ amount: "asc" as const }, { id: "asc" as const }] },
  orders: { select: { id: true, number: true, status: true }, orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.RfqInclude;
type Row = Prisma.RfqGetPayload<{ include: typeof include }>;
type RegisterRow = Prisma.RfqGetPayload<{ include: typeof registerInclude }>;
const hash = (input: unknown) => createHash("sha256").update(JSON.stringify(input)).digest("hex");
function entry(row: RegisterRow): RfqEntry {
  return { id: row.id, companyId: row.companyId, number: row.number, sourceId: row.sourceId, sourceNumber: row.source.number, date: row.date.toISOString().slice(0, 10), deadline: row.deadline.toISOString().slice(0, 10), currency: row.source.currency, budget: row.source.amount.toFixed(2), description: row.description, status: row.status, supplierCount: row._count.suppliers, offerCount: row._count.offers, selectedOfferId: row.selectedOfferId, selectedSupplierName: row.selectedOffer?.invitation.supplierName || null, proposedBy: row.proposedBy, proposerName: row.proposer?.name || null, proposedAt: row.proposedAt?.toISOString() || null, proposalReason: row.proposalReason, reviewedBy: row.reviewedBy, reviewerName: row.reviewer?.name || null, reviewedAt: row.reviewedAt?.toISOString() || null, reviewNote: row.reviewNote, cancelReason: row.cancelReason, creatorName: row.creator.name, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), orders: row.orders };
}
async function audit(tx: Tx, companyId: string, actorId: string, entityId: string, action: string, changes: Prisma.InputJsonValue) {
  await tx.auditLog.create({ data: { companyId, actorId, entityId, entity: "rfq", action, changes } });
}
async function number(tx: Tx, companyId: string, code: string, prefix: string, date: string) {
  const year = Number(date.slice(0, 4));
  const sequence = await tx.documentSequence.upsert({ where: { companyId_prefix_year: { companyId, prefix, year } }, create: { companyId, prefix, year, value: 1 }, update: { value: { increment: 1 } } });
  return `${prefix}-${code}-${year}-${String(sequence.value).padStart(5, "0")}`;
}
async function load(tx: Tx, companyId: string, id: string) {
  await tx.$queryRaw`SELECT id FROM "Rfq" WHERE "companyId" = ${companyId} AND id = ${id} FOR UPDATE`;
  const row = await tx.rfq.findFirst({ where: { companyId, id }, include });
  if (!row) throw new NotFoundException("RFQ tidak ditemukan");
  return row;
}
function expected(row: Row, timestamp: string) { if (row.updatedAt.toISOString() !== timestamp) throw new ConflictException("RFQ telah berubah. Muat ulang sebelum melanjutkan."); }
function nextVersion(row: Row) { return { revision: { increment: 1 }, updatedAt: new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1)) }; }
async function eligible(tx: Tx, companyId: string, row: Row) {
  const supplierId = row.offers.find(offer => offer.id === row.selectedOfferId)?.supplierId;
  const count = await tx.item.count({ where: { companyId, id: { in: row.source.lines.map(line => line.itemId) }, trackStock: true, record: { status: "ACTIVE" } } });
  const warehouse = await tx.warehouse.count({ where: { companyId, id: row.source.warehouseId, record: { status: "ACTIVE" } } });
  const supplier = supplierId ? await tx.supplier.count({ where: { companyId, id: supplierId, record: { status: "ACTIVE" } } }) : 1;
  if (count !== row.source.lines.length || !warehouse || !supplier) throw new ConflictException("Items, Warehouse dan Supplier pilihan harus aktif dari Company yang sama.");
}
function validOffer(row: Row, offerId: string, date = rfqToday()) {
  const offer = row.offers.find(value => value.id === offerId);
  if (!offer) throw new BadRequestException("Pilih penawaran dari RFQ yang sama");
  if (offer.validUntil.toISOString().slice(0, 10) < rfqToday() || date < row.date.toISOString().slice(0, 10) || date < offer.date.toISOString().slice(0, 10) || date > offer.validUntil.toISOString().slice(0, 10)) throw new ConflictException("Penawaran sudah kedaluwarsa atau tanggal berada di luar masa berlakunya.");
  return offer;
}

@Injectable()
export class RfqService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private query(body: unknown) {
    const query = validate(rfqQuerySchema, body);
    const where: Prisma.RfqWhereInput = { ...(query.status !== "ALL" ? { status: query.status } : {}), ...(query.sourceId ? { sourceId: query.sourceId } : {}), ...(query.q ? { OR: [{ number: { contains: query.q, mode: "insensitive" } }, { source: { number: { contains: query.q, mode: "insensitive" } } }, { suppliers: { some: { supplierName: { contains: query.q, mode: "insensitive" } } } }] } : {}) };
    return { query, where };
  }
  async list(companyId: string, body: unknown) {
    const { query, where: filter } = this.query(body), where = { ...filter, companyId };
    return this.prisma.$transaction(async tx => {
      const total = await tx.rfq.count({ where }), pageCount = Math.max(1, Math.ceil(total / query.pageSize)), page = Math.min(query.page, pageCount);
      const rows = await tx.rfq.findMany({ where, include: registerInclude, orderBy: [{ date: query.direction }, { id: "asc" }], take: query.pageSize, skip: (page - 1) * query.pageSize });
      return { data: rows.map(entry), meta: { total, page, pageSize: query.pageSize, pageCount } };
    }, { isolationLevel: "RepeatableRead" });
  }
  async export(companyId: string, body: unknown) {
    const { query, where: filter } = this.query(body), where = { ...filter, companyId };
    return this.prisma.$transaction(async tx => {
      const total = await tx.rfq.count({ where });
      if (total > 10000) throw new BadRequestException("Ekspor maksimal 10.000 RFQ. Persempit filter terlebih dahulu.");
      const rows = await tx.rfq.findMany({ where, include: registerInclude, orderBy: [{ date: query.direction }, { id: "asc" }] });
      return { data: rows.map(entry), total };
    }, { isolationLevel: "RepeatableRead" });
  }
  async requests(companyId: string, body: unknown) {
    const { query } = this.query(body);
    const where: Prisma.PurchaseDocumentWhereInput = { companyId, kind: "PURCHASE_REQUEST", status: "APPROVED", successors: { none: { kind: "PURCHASE_ORDER", status: { not: "CANCELLED" } } }, rfqRequests: { none: { status: { notIn: ["CANCELLED", "REJECTED"] } } }, ...(query.q ? { number: { contains: query.q, mode: "insensitive" } } : {}) };
    return this.prisma.$transaction(async tx => {
      const total = await tx.purchaseDocument.count({ where }), pageCount = Math.max(1, Math.ceil(total / query.pageSize)), page = Math.min(query.page, pageCount);
      return { data: (await tx.purchaseDocument.findMany({ where, include: purchaseInclude, orderBy: [{ date: "desc" }, { id: "asc" }], take: query.pageSize, skip: (page - 1) * query.pageSize })).map(serializePurchase), meta: { total, page, pageSize: query.pageSize, pageCount } };
    }, { isolationLevel: "RepeatableRead" });
  }
  async detail(companyId: string, id: string): Promise<RfqDetail> {
    return this.prisma.$transaction(async tx => {
      const row = await tx.rfq.findFirst({ where: { companyId, id }, include });
      if (!row) throw new NotFoundException("RFQ tidak ditemukan");
      const where = { companyId, entity: "rfq", entityId: id };
      const historyTotal = await tx.auditLog.count({ where });
      const history = await tx.auditLog.findMany({ where, include: { actor: { select: { name: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 });
      return { ...entry(row), source: serializePurchase(row.source), suppliers: row.suppliers.map(value => ({ supplierId: value.supplierId, supplierName: value.supplierName })), offers: row.offers.map(offer => ({ id: offer.id, supplierId: offer.supplierId, supplierName: offer.invitation.supplierName, reference: offer.reference, date: offer.date.toISOString().slice(0, 10), validUntil: offer.validUntil.toISOString().slice(0, 10), deliveryDays: offer.deliveryDays, description: offer.description, amount: offer.amount.toFixed(2), updatedAt: offer.updatedAt.toISOString(), lines: offer.lines.map(line => ({ itemId: line.itemId, unitPrice: line.unitPrice.toFixed(2), amount: line.amount.toFixed(2) })) })), historyTotal, history: history.map(event => ({ id: event.id, action: event.action, actorName: event.actor.name, createdAt: event.createdAt.toISOString(), changes: event.changes as Record<string, unknown> | null })) };
    }, { isolationLevel: "RepeatableRead" });
  }
  async create(companyId: string, actorId: string, body: unknown) {
    const input = validate(rfqCreateSchema, body), requestHash = hash(input);
    return this.prisma.$transaction(async tx => {
      const { company } = await requireCompanyWrite(tx, companyId, actorId);
      const retry = await tx.rfq.findUnique({ where: { companyId_requestKey: { companyId, requestKey: input.requestKey } }, include });
      if (retry) {
        if (retry.createdBy !== actorId || retry.requestHash !== requestHash) throw new ConflictException("Kunci permintaan sudah digunakan dengan data berbeda");
        return entry(retry);
      }
      await tx.$queryRaw`SELECT id FROM "PurchaseDocument" WHERE "companyId" = ${companyId} AND id = ${input.sourceId} FOR UPDATE`;
      const source = await tx.purchaseDocument.findFirst({ where: { companyId, id: input.sourceId }, include: purchaseInclude });
      if (!source) throw new NotFoundException("Purchase Request tidak ditemukan");
      if (source.kind !== "PURCHASE_REQUEST" || source.status !== "APPROVED" || source.successors.some(value => value.kind === "PURCHASE_ORDER" && value.status !== "CANCELLED") || await tx.rfq.count({ where: { companyId, sourceId: source.id, status: { notIn: ["CANCELLED", "REJECTED"] } } })) throw new ConflictException("Pilih Purchase Request Disetujui tanpa Purchase Order atau RFQ aktif.");
      if (input.date < source.date.toISOString().slice(0, 10)) throw new BadRequestException("Tanggal RFQ tidak boleh mendahului Purchase Request");
      const suppliers = await tx.supplier.findMany({ where: { companyId, id: { in: input.supplierIds }, record: { status: "ACTIVE" } }, include: { record: true } });
      if (suppliers.length !== input.supplierIds.length) throw new BadRequestException("Pilih Supplier aktif dari Company yang sama");
      const row = await tx.rfq.create({ data: { companyId, sourceId: source.id, number: await number(tx, companyId, company.code, "RFQ", input.date), requestKey: input.requestKey, requestHash, date: new Date(input.date), deadline: new Date(input.deadline), description: input.description, createdBy: actorId, suppliers: { create: suppliers.map(supplier => ({ supplierId: supplier.id, supplierName: supplier.record.name })) } }, include });
      await audit(tx, companyId, actorId, row.id, "CREATE", { number: row.number, sourceId: source.id, supplierIds: input.supplierIds });
      return entry(row);
    }, { isolationLevel: "Serializable" });
  }
  async offer(companyId: string, actorId: string, id: string, body: unknown) {
    const input = validate(rfqOfferSchema, body);
    return this.prisma.$transaction(async tx => {
      await requireCompanyWrite(tx, companyId, actorId);
      const row = await load(tx, companyId, id); expected(row, input.expectedUpdatedAt);
      if (row.status !== "OPEN") throw new ConflictException("Penawaran hanya dapat dicatat ketika RFQ Terbuka");
      if (!row.suppliers.some(value => value.supplierId === input.supplierId) || !await tx.supplier.count({ where: { companyId, id: input.supplierId, record: { status: "ACTIVE" } } })) throw new BadRequestException("Pilih Supplier aktif yang tercatat pada RFQ");
      if (input.date < row.date.toISOString().slice(0, 10) || input.date > row.deadline.toISOString().slice(0, 10)) throw new BadRequestException("Tanggal penawaran harus berada dalam periode RFQ");
      if (input.lines.length !== row.source.lines.length || input.lines.some(line => !row.source.lines.some(source => source.itemId === line.itemId))) throw new BadRequestException("Penawaran wajib mencakup seluruh Items Purchase Request dengan jumlah yang sama");
      const lines = input.lines.map(line => ({ itemId: line.itemId, unitPrice: new Prisma.Decimal(line.unitPrice), amount: new Prisma.Decimal(line.unitPrice).mul(row.source.lines.find(source => source.itemId === line.itemId)!.quantity) }));
      const amount = lines.reduce((total, line) => total.add(line.amount), new Prisma.Decimal(0));
      if (amount.gt(1e12)) throw new BadRequestException("Nilai penawaran maksimal 1.000.000.000.000");
      const before = row.offers.find(value => value.supplierId === input.supplierId);
      if (before) await tx.rfqOfferLine.deleteMany({ where: { companyId, offerId: before.id } });
      const values = { reference: input.reference, date: new Date(input.date), validUntil: new Date(input.validUntil), deliveryDays: input.deliveryDays, description: input.description, amount };
      const offer = await tx.rfqOffer.upsert({ where: { companyId_rfqId_supplierId: { companyId, rfqId: id, supplierId: input.supplierId } }, create: { ...values, companyId, rfqId: id, supplierId: input.supplierId, lines: { create: lines } }, update: { ...values, lines: { create: lines } } });
      await tx.rfq.update({ where: { id }, data: nextVersion(row) });
      await audit(tx, companyId, actorId, id, before ? "OFFER_UPDATED" : "OFFER_RECORDED", { supplierId: input.supplierId, offerId: offer.id, before: before ? { reference: before.reference, date: before.date.toISOString().slice(0, 10), validUntil: before.validUntil.toISOString().slice(0, 10), deliveryDays: before.deliveryDays, description: before.description, amount: before.amount.toFixed(2), lines: before.lines.map(line => ({ itemId: line.itemId, unitPrice: line.unitPrice.toFixed(2) })) } : null, after: { ...input, amount: amount.toFixed(2) } });
      return { id };
    }, { isolationLevel: "Serializable" });
  }
  async action(companyId: string, actorId: string, id: string, body: unknown) {
    const input = validate(rfqActionSchema, body);
    return this.prisma.$transaction(async tx => {
      await requireCompanyWrite(tx, companyId, actorId);
      const row = await load(tx, companyId, id); expected(row, input.expectedUpdatedAt);
      let data: Prisma.RfqUpdateInput;
      if (input.action === "open" && row.status === "DRAFT") { await eligible(tx, companyId, row); data = { status: "OPEN" }; }
      else if (input.action === "propose" && row.status === "OPEN") {
        if (row.offers.length < 2) throw new ConflictException("Catat minimal dua penawaran untuk perbandingan Supplier");
        validOffer(row, input.offerId);
        data = { status: "PENDING", selectedOffer: { connect: { companyId_rfqId_id: { companyId, rfqId: id, id: input.offerId } } }, proposer: { connect: { id: actorId } }, proposedAt: new Date(), proposalReason: input.reason };
      } else if (["approve", "reject"].includes(input.action) && row.status === "PENDING") {
        if (row.proposedBy === actorId) throw new ConflictException("Pilihan Supplier harus ditinjau User lain, termasuk untuk Role ADMIN.");
        if (input.action === "approve") { validOffer(row, row.selectedOfferId!); await eligible(tx, companyId, row); }
        data = { status: input.action === "approve" ? "APPROVED" : "REJECTED", reviewer: { connect: { id: actorId } }, reviewedAt: new Date(), reviewNote: "reason" in input ? input.reason : "" };
      } else if (input.action === "cancel" && ["DRAFT", "OPEN", "PENDING", "APPROVED"].includes(row.status)) {
        if (row.orders.some(order => order.status !== "CANCELLED")) throw new ConflictException("RFQ dengan Purchase Order aktif tidak dapat dibatalkan");
        data = { status: "CANCELLED", cancelReason: input.reason };
      }
      else throw new ConflictException("Perubahan status RFQ tidak diizinkan");
      const updated = await tx.rfq.update({ where: { id }, data: { ...data, ...nextVersion(row) }, include });
      await audit(tx, companyId, actorId, id, input.action.toUpperCase(), { before: row.status, after: updated.status, selectedOfferId: updated.selectedOfferId, reason: "reason" in input ? input.reason : "" });
      return entry(updated);
    }, { isolationLevel: "Serializable" });
  }
  async order(companyId: string, actorId: string, id: string, body: unknown) {
    const input = validate(rfqOrderSchema, body), requestHash = hash({ rfqId: id, ...input });
    return this.prisma.$transaction(async tx => {
      const { company } = await requireCompanyWrite(tx, companyId, actorId);
      const retry = await tx.purchaseDocument.findUnique({ where: { companyId_requestKey: { companyId, requestKey: input.requestKey } }, include: purchaseInclude });
      if (retry) {
        if (retry.createdBy !== actorId || retry.requestHash !== requestHash || retry.rfqId !== id) throw new ConflictException("Kunci permintaan sudah digunakan dengan data berbeda");
        return serializePurchase(retry);
      }
      const row = await load(tx, companyId, id); expected(row, input.expectedUpdatedAt);
      if (row.status !== "APPROVED" || row.source.status !== "APPROVED") throw new ConflictException("RFQ harus Disetujui sebelum membuat Purchase Order");
      await tx.$queryRaw`SELECT id FROM "PurchaseDocument" WHERE "companyId" = ${companyId} AND id = ${row.sourceId} FOR UPDATE`;
      if (await tx.purchaseDocument.count({ where: { companyId, sourceId: row.sourceId, kind: "PURCHASE_ORDER", status: { not: "CANCELLED" } } })) throw new ConflictException("Purchase Order aktif sudah tersedia");
      const offer = validOffer(row, row.selectedOfferId!, input.date); await eligible(tx, companyId, row);
      const order = await tx.purchaseDocument.create({ data: { companyId, rfqId: id, sourceId: row.sourceId, requestKey: input.requestKey, requestHash, number: await number(tx, companyId, company.code, "PO", input.date), kind: "PURCHASE_ORDER", date: new Date(input.date), description: input.description, supplierId: offer.supplierId, supplierName: offer.invitation.supplierName, warehouseId: row.source.warehouseId, warehouseName: row.source.warehouseName, currency: row.source.currency, amount: offer.amount, createdBy: actorId, lines: { create: row.source.lines.map(line => { const quote = offer.lines.find(value => value.itemId === line.itemId)!; return { itemId: line.itemId, itemCode: line.itemCode, itemName: line.itemName, unit: line.unit, quantity: line.quantity, unitPrice: quote.unitPrice, amount: quote.amount }; }) } }, include: purchaseInclude });
      await audit(tx, companyId, actorId, id, "ORDER_CREATED", { orderId: order.id, number: order.number, offerId: offer.id, supplierId: offer.supplierId, amount: offer.amount.toFixed(2) });
      await tx.auditLog.create({ data: { companyId, actorId, entity: "procurement", entityId: order.id, action: "CREATE", changes: { sourceId: row.sourceId, rfqId: id, selectedOfferId: offer.id } } });
      return serializePurchase(order);
    }, { isolationLevel: "Serializable" });
  }
}
