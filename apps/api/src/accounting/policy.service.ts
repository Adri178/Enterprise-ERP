import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { activateAccountingSchema, accountingPurposes, purposeAccountTypes, controlPurposes, journalQuerySchema, type OpeningSnapshot } from "@erp/shared";
import { validate } from "../common/validation";
import { PrismaService } from "../prisma/prisma.module";
import { accountingAccess, accountingAudit } from "./accounting-common";
import { automaticJournal, openingSnapshot, policyInclude, serializePolicy } from "./automatic-posting";
@Injectable()
export class AccountingPolicyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async get(companyId: string) {
    return this.prisma.$transaction(async (tx) => {
      const policy = await tx.accountingPolicy.findUnique({ where: { companyId }, include: policyInclude });
      return serializePolicy(policy, policy ? policy.opening as unknown as OpeningSnapshot : await openingSnapshot(tx, companyId));
    }, { isolationLevel: "RepeatableRead" });
  }
  async activate(companyId: string, actorId: string, body: unknown) {
    const input = validate(activateAccountingSchema, body), requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Company" WHERE id=${companyId} FOR UPDATE`;
      await accountingAccess(tx, companyId, actorId, true);
      const before = await tx.accountingPolicy.findUnique({ where: { companyId }, include: policyInclude });
      if (before) {
        if (before.requestKey === input.requestKey && before.requestHash === requestHash && before.createdBy === actorId) return serializePolicy(before, before.opening as unknown as OpeningSnapshot);
        throw new ConflictException("Accounting otomatis sudah aktif. Mapping tidak dapat diubah setelah aktivasi.");
      }
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }), opening = await openingSnapshot(tx, companyId);
      if (opening.snapshotKey !== input.snapshotKey) throw new ConflictException("Saldo operasional berubah. Muat ulang dan tinjau saldo awal sebelum aktivasi.");
      if (input.effectiveFrom < today || (opening.latestDate && input.effectiveFrom <= opening.latestDate)) throw new BadRequestException("Tanggal mulai minimal hari ini dan harus sesudah seluruh transaksi operasional yang sudah dibukukan.");
      const accounts = await tx.account.findMany({ where: { companyId, id: { in: Object.values(input.mappings) }, isGroup: false, status: "ACTIVE" } });
      if (accounts.length !== accountingPurposes.length) throw new BadRequestException("Pilih Account transaksi aktif yang berbeda dari company ini untuk setiap fungsi.");
      const mappings = accountingPurposes.map((purpose) => {
        const account = accounts.find((a) => a.id === input.mappings[purpose])!;
        if (account.type !== purposeAccountTypes[purpose]) throw new BadRequestException(`Tipe Account ${purpose} harus ${purposeAccountTypes[purpose]}`);
        return { purpose, accountId: account.id, accountType: account.type, account };
      });
      if (await tx.journalLine.count({ where: { companyId, accountId: { in: controlPurposes.map((p) => input.mappings[p]) } } })) throw new ConflictException("Account Inventory, GRNI, Receivable dan Payable harus belum digunakan dalam Journal. Gunakan Account baru agar saldo awal tidak dihitung dua kali.");
      const row = await tx.accountingPolicy.create({ data: { companyId, effectiveFrom: new Date(input.effectiveFrom), requestKey: input.requestKey, requestHash, createdBy: actorId, opening: opening as unknown as Prisma.InputJsonValue, mappings: { create: mappings.map(({ account: _account, ...m }) => { void _account; return m; }) } } });
      const journal = await automaticJournal(tx, companyId, actorId, { mappings: mappings.map((m) => ({ ...m, companyId })) }, row.effectiveFrom, "OPENING", "OPENING", "Saldo awal operasional saat aktivasi Accounting", { INVENTORY: new Prisma.Decimal(opening.inventory), RECEIVABLE: new Prisma.Decimal(opening.receivable), PAYABLE: new Prisma.Decimal(opening.payable).neg(), GRNI: new Prisma.Decimal(opening.grni).neg(), OPENING_EQUITY: new Prisma.Decimal(opening.equity).neg() });
      if (journal) await tx.accountingPolicy.update({ where: { companyId }, data: { openingJournalId: journal.id } });
      await accountingAudit(tx, companyId, actorId, "accounting-policy", companyId, "ACTIVATE", { reason: input.reason, effectiveFrom: input.effectiveFrom, mappings: input.mappings, opening, journalId: journal?.id || null });
      return serializePolicy(await tx.accountingPolicy.findUniqueOrThrow({ where: { companyId }, include: policyInclude }), opening);
    }, { isolationLevel: "Serializable", timeout: 15000 });
  }
  async postings(companyId: string, body: unknown) {
    const q = validate(journalQuerySchema.pick({ q: true, page: true, pageSize: true, direction: true }), body);
    const where: Prisma.OperationalPostingWhereInput = { companyId, ...(q.q ? { number: { contains: q.q, mode: "insensitive" } } : {}) };
    return this.prisma.$transaction(async (tx) => {
      const total = await tx.operationalPosting.count({ where }), pageCount = Math.max(1, Math.ceil(total / q.pageSize)), page = Math.min(q.page, pageCount);
      const rows = await tx.operationalPosting.findMany({ where, include: { journal: { select: { id: true, number: true } } }, orderBy: [{ date: q.direction }, { createdAt: q.direction }, { id: "asc" }], skip: (page - 1) * q.pageSize, take: q.pageSize });
      return { data: rows.map(({ purchaseId, salesId, operationId, workOrderId, journalId: _journal, createdAt: _time, date, amount, ...r }) => { void _journal; void _time; return { ...r, date: date.toISOString().slice(0, 10), amount: amount.toFixed(2), source: { type: purchaseId ? "purchase" : salesId ? "sales" : operationId ? "operation" : "production", id: purchaseId || salesId || operationId || workOrderId! } }; }), meta: { total, page, pageSize: q.pageSize, pageCount } };
    }, { isolationLevel: "RepeatableRead" });
  }
}
