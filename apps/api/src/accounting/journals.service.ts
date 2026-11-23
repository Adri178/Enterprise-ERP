import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { journalSchema, journalEditSchema, journalActionSchema, journalQuerySchema, journalReversalSchema, controlPurposes } from "@erp/shared";
import { validate } from "../common/validation";
import { PrismaService } from "../prisma/prisma.module";
import { accountingAccess, accountingAudit, journalInclude, serializeJournal } from "./accounting-common";
type Tx = Prisma.TransactionClient;
@Injectable()
export class JournalsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private hash(body: unknown) { return createHash("sha256").update(JSON.stringify(body)).digest("hex"); }
  private async retry(tx: Tx, companyId: string, requestKey: string, hash: string, actorId: string) {
    const row = await tx.journal.findUnique({ where: { companyId_requestKey: { companyId, requestKey } }, include: journalInclude });
    if (row && (row.requestHash !== hash || row.createdBy !== actorId)) throw new ConflictException("Kunci permintaan sudah digunakan dengan data berbeda");
    return row;
  }
  private async number(tx: Tx, companyId: string, code: string, date: string, prefix = "JV") {
    const year = Number(date.slice(0, 4)), row = await tx.documentSequence.upsert({ where: { companyId_prefix_year: { companyId, prefix, year } }, create: { companyId, prefix, year, value: 1 }, update: { value: { increment: 1 } } });
    return `${prefix}-${code}-${year}-${String(row.value).padStart(5, "0")}`;
  }
  private async lines(tx: Tx, companyId: string, input: { accountId: string; debit: number; credit: number; description: string }[]) {
    if (await tx.accountingMapping.count({ where: { companyId, purpose: { in: controlPurposes }, accountId: { in: input.map((l) => l.accountId) } } })) throw new ConflictException("Account kontrol Inventory, GRNI, Receivable dan Payable hanya dapat digunakan melalui transaksi operasional.");
    const accounts = await tx.account.findMany({ where: { companyId, id: { in: input.map((l) => l.accountId) }, isGroup: false, status: "ACTIVE" } });
    if (accounts.length !== input.length) throw new BadRequestException("Pilih Account transaksi aktif dari company yang sama pada setiap baris.");
    return input.map((line, index) => { const account = accounts.find((a) => a.id === line.accountId)!;
      return { accountId: account.id, accountCode: account.code, accountName: account.name, accountType: account.type, position: index + 1, description: line.description, debit: new Prisma.Decimal(line.debit), credit: new Prisma.Decimal(line.credit) };
    });
  }
  async list(companyId: string, body: unknown) {
    const q = validate(journalQuerySchema, body);
    const where: Prisma.JournalWhereInput = { companyId, ...(q.status !== "ALL" ? { status: q.status } : {}), ...(q.q ? { OR: ["number", "description", "reference"].map((field) => ({ [field]: { contains: q.q, mode: "insensitive" } })) } : {}) };
    return this.prisma.$transaction(async (tx) => {
      const total = await tx.journal.count({ where }), pageCount = Math.max(1, Math.ceil(total / q.pageSize)), page = Math.min(q.page, pageCount);
      const rows = await tx.journal.findMany({ where, include: journalInclude, orderBy: [{ date: q.direction }, { createdAt: q.direction }, { id: "asc" }], take: q.pageSize, skip: (page - 1) * q.pageSize });
      return { data: rows.map(serializeJournal), meta: { total, page, pageSize: q.pageSize, pageCount } };
    }, { isolationLevel: "RepeatableRead" });
  }
  async detail(companyId: string, id: string) {
    const row = await this.prisma.journal.findFirst({ where: { companyId, id }, include: journalInclude });
    if (!row) throw new NotFoundException("Journal tidak ditemukan");
    return serializeJournal(row);
  }
  async save(companyId: string, actorId: string, body: unknown, id?: string) {
    const input = id ? validate(journalEditSchema, body) : validate(journalSchema, body);
    return this.prisma.$transaction(async (tx) => {
      const company = await accountingAccess(tx, companyId, actorId), hash = this.hash({ kind: "CREATE", input });
      if ("requestKey" in input) { const existing = await this.retry(tx, companyId, input.requestKey, hash, actorId); if (existing) return serializeJournal(existing); }
      const before = id ? await tx.journal.findFirst({ where: { companyId, id }, include: journalInclude }) : null;
      if (id && !before) throw new NotFoundException("Journal tidak ditemukan");
      if (before && (before.status !== "DRAFT" || !("expectedUpdatedAt" in input) || before.updatedAt.toISOString() !== input.expectedUpdatedAt)) throw new ConflictException("Hanya draft dengan versi terkini yang dapat diedit.");
      const lines = await this.lines(tx, companyId, input.lines), amount = lines.reduce((n, l) => n.add(l.debit), new Prisma.Decimal(0));
      if (before) await tx.journalLine.deleteMany({ where: { companyId, journalId: before.id } });
      const data = { date: new Date(input.date), description: input.description, reference: input.reference, amount, lines: { create: lines } };
      const row = before ? await tx.journal.update({ where: { companyId_id: { companyId, id: before.id } }, data: { ...data, updatedAt: new Date(Math.max(Date.now(), before.updatedAt.getTime() + 1)) }, include: journalInclude })
        : await tx.journal.create({ data: { ...data, companyId, createdBy: actorId, currency: company.currency, number: await this.number(tx, companyId, company.code, input.date), requestKey: "requestKey" in input ? input.requestKey : "", requestHash: hash }, include: journalInclude });
      const after = serializeJournal(row); await accountingAudit(tx, companyId, actorId, "journals", row.id, before ? "UPDATE" : "CREATE", { before: before ? serializeJournal(before) : null, after }); return after;
    }, { isolationLevel: "Serializable" });
  }
  async action(companyId: string, actorId: string, id: string, body: unknown) {
    const input = validate(journalActionSchema, body);
    return this.prisma.$transaction(async (tx) => {
      await accountingAccess(tx, companyId, actorId);
      const row = await tx.journal.findFirst({ where: { companyId, id }, include: journalInclude });
      if (!row) throw new NotFoundException("Journal tidak ditemukan");
      if (row.status !== "DRAFT" || row.updatedAt.toISOString() !== input.expectedUpdatedAt) throw new ConflictException("Status atau versi Journal telah berubah. Muat ulang sebelum melanjutkan.");
      if (input.action === "post") {
        await this.lines(tx, companyId, row.lines.map((l) => ({ ...l, debit: l.debit.toNumber(), credit: l.credit.toNumber() })));
        const debit = row.lines.reduce((n, l) => n.add(l.debit), new Prisma.Decimal(0)), credit = row.lines.reduce((n, l) => n.add(l.credit), new Prisma.Decimal(0));
        if (!debit.eq(credit) || !debit.eq(row.amount)) throw new ConflictException("Journal tidak seimbang");
      }
      const saved = await tx.journal.update({ where: { companyId_id: { companyId, id } }, data: { status: input.action === "post" ? "POSTED" : "CANCELLED", ...(input.action === "post" ? { postedAt: new Date(), postedBy: actorId } : {}), updatedAt: new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1)) }, include: journalInclude });
      const after = serializeJournal(saved); await accountingAudit(tx, companyId, actorId, "journals", id, input.action.toUpperCase(), { before: serializeJournal(row), after }); return after;
    }, { isolationLevel: "Serializable" });
  }
  async reverse(companyId: string, actorId: string, id: string, body: unknown) {
    const input = validate(journalReversalSchema, body), hash = this.hash({ kind: "REVERSAL", sourceId: id, input });
    return this.prisma.$transaction(async (tx) => {
      const company = await accountingAccess(tx, companyId, actorId, true);
      const existing = await this.retry(tx, companyId, input.requestKey, hash, actorId); if (existing) return serializeJournal(existing);
      const source = await tx.journal.findFirst({ where: { companyId, id }, include: journalInclude });
      if (!source) throw new NotFoundException("Journal tidak ditemukan");
      if (source.origin !== "MANUAL") throw new ConflictException("Journal otomatis tidak dapat dibalik secara manual. Pembalikan dokumen operasional terposting belum tersedia.");
      if (source.status !== "POSTED" || source.reversalOfId || source.reversedBy.length || source.updatedAt.toISOString() !== input.expectedUpdatedAt) throw new ConflictException("Journal tidak dapat dibalik atau sudah memiliki pembalikan.");
      if (input.date < source.date.toISOString().slice(0, 10)) throw new BadRequestException("Tanggal pembalikan tidak boleh mendahului Journal asal.");
      const row = await tx.journal.create({ data: { companyId, requestKey: input.requestKey, requestHash: hash, createdBy: actorId, status: "POSTED", postedAt: new Date(), postedBy: actorId, reversalOfId: source.id, number: await this.number(tx, companyId, company.code, input.date, "JVR"), date: new Date(input.date), currency: source.currency, amount: source.amount, description: input.description, reference: source.number,
        lines: { create: source.lines.map((l) => ({ accountId: l.accountId, accountCode: l.accountCode, accountName: l.accountName, accountType: l.accountType, position: l.position, debit: l.credit, credit: l.debit, description: l.description })) },
      }, include: journalInclude });
      const after = serializeJournal(row); await accountingAudit(tx, companyId, actorId, "journals", row.id, "REVERSE", { sourceId: id, after }); return after;
    }, { isolationLevel: "Serializable" });
  }
}
