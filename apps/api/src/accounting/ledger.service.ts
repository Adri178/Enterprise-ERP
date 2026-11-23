import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ledgerQuerySchema, trialBalanceQuerySchema, reportExportLimit, type AccountType } from "@erp/shared";
import { validate } from "../common/validation";
import { PrismaService } from "../prisma/prisma.module";
import { accountInclude, serializeAccount } from "./accounting-common";
type Summary = { count: bigint; debit: Prisma.Decimal; credit: Prisma.Decimal };
type LedgerRow = { id: string; journalId: string; number: string; date: Date; description: string; debit: Prisma.Decimal; credit: Prisma.Decimal; balance: Prisma.Decimal };
type TrialRow = { accountId: string; code: string; name: string; type: AccountType; opening: Prisma.Decimal; debit: Prisma.Decimal; credit: Prisma.Decimal; closingDebit: Prisma.Decimal; closingCredit: Prisma.Decimal };
type TrialTotals = Omit<TrialRow, "accountId" | "code" | "name" | "type"> & { count: bigint };
const decimal = (value: Prisma.Decimal) => value.toFixed(2);
const trialValues = (row: Omit<TrialRow, "accountId" | "code" | "name" | "type">) => ({ opening: decimal(row.opening), debit: decimal(row.debit), credit: decimal(row.credit), closingDebit: decimal(row.closingDebit), closingCredit: decimal(row.closingCredit) });
@Injectable()
export class LedgerService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private paging(total: number, page: number, size: number, exporting: boolean) {
    if (exporting && total > reportExportLimit) throw new BadRequestException("Ekspor maksimal 10.000 baris. Persempit periode atau Account.");
    const pageSize = exporting ? reportExportLimit : size, pageCount = Math.max(1, Math.ceil(total / pageSize));
    return { total, page: exporting ? 1 : Math.min(page, pageCount), pageSize, pageCount };
  }
  async ledger(companyId: string, body: unknown, exporting = false) {
    const input = validate(ledgerQuerySchema, body);
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.account.findFirst({ where: { companyId, id: input.accountId, isGroup: false }, include: accountInclude });
      if (!account) throw new NotFoundException("Account transaksi tidak ditemukan pada company ini");
      const base = Prisma.sql`FROM "JournalLine" l JOIN "Journal" j ON j."companyId" = l."companyId" AND j.id = l."journalId"
        WHERE l."companyId" = ${companyId} AND l."accountId" = ${input.accountId} AND j.status = 'POSTED'`;
      const [openingRow] = await tx.$queryRaw<{ opening: Prisma.Decimal }[]>(Prisma.sql`SELECT COALESCE(SUM(l.debit - l.credit), 0) AS opening ${base} AND j.date < ${input.from}::date`);
      const [summary] = await tx.$queryRaw<Summary[]>(Prisma.sql`SELECT COUNT(*) AS count, COALESCE(SUM(l.debit), 0) AS debit, COALESCE(SUM(l.credit), 0) AS credit ${base} AND j.date BETWEEN ${input.from}::date AND ${input.to}::date`);
      const meta = this.paging(Number(summary.count), input.page, input.pageSize, exporting);
      const rows = await tx.$queryRaw<LedgerRow[]>(Prisma.sql`WITH entries AS (
        SELECT l.id, l."journalId", j.number, j.date, j."createdAt", COALESCE(NULLIF(l.description, ''), j.description) AS description, l.debit, l.credit
        ${base} AND j.date BETWEEN ${input.from}::date AND ${input.to}::date
      ), running AS (SELECT *, ${openingRow.opening}::numeric + SUM(debit - credit) OVER (ORDER BY date, "createdAt", "journalId", id ROWS UNBOUNDED PRECEDING) AS balance FROM entries)
      SELECT * FROM running ORDER BY date, "createdAt", "journalId", id LIMIT ${meta.pageSize} OFFSET ${(meta.page - 1) * meta.pageSize}`);
      return { account: serializeAccount(account), period: { from: input.from, to: input.to }, opening: decimal(openingRow.opening), debit: decimal(summary.debit), credit: decimal(summary.credit), closing: decimal(openingRow.opening.add(summary.debit).sub(summary.credit)), generatedAt: new Date().toISOString(),
        data: rows.map((r) => ({ id: r.id, journalId: r.journalId, number: r.number, date: r.date.toISOString().slice(0, 10), description: r.description, debit: decimal(r.debit), credit: decimal(r.credit), balance: decimal(r.balance) })), meta };
    }, { isolationLevel: "RepeatableRead", timeout: 15000 });
  }
  async trial(companyId: string, body: unknown, exporting = false) {
    const input = validate(trialBalanceQuerySchema, body);
    const cte = Prisma.sql`WITH activity AS (
      SELECT l."accountId", SUM(CASE WHEN j.date < ${input.from}::date THEN l.debit - l.credit ELSE 0 END) AS opening,
        SUM(CASE WHEN j.date >= ${input.from}::date THEN l.debit ELSE 0 END) AS debit,
        SUM(CASE WHEN j.date >= ${input.from}::date THEN l.credit ELSE 0 END) AS credit
      FROM "JournalLine" l JOIN "Journal" j ON j."companyId" = l."companyId" AND j.id = l."journalId"
      WHERE l."companyId" = ${companyId} AND j.status = 'POSTED' AND j.date <= ${input.to}::date GROUP BY l."accountId"
    ), balances AS (
      SELECT a.id AS "accountId", a.code, a.name, a.type, COALESCE(v.opening, 0) AS opening, COALESCE(v.debit, 0) AS debit, COALESCE(v.credit, 0) AS credit,
        COALESCE(v.opening, 0) + COALESCE(v.debit, 0) - COALESCE(v.credit, 0) AS closing
      FROM "Account" a LEFT JOIN activity v ON v."accountId" = a.id WHERE a."companyId" = ${companyId} AND a."isGroup" = false
    ), report AS (SELECT "accountId", code, name, type, opening, debit, credit, GREATEST(closing, 0) AS "closingDebit", GREATEST(-closing, 0) AS "closingCredit" FROM balances)`;
    return this.prisma.$transaction(async (tx) => {
      const [totals] = await tx.$queryRaw<TrialTotals[]>(Prisma.sql`${cte} SELECT COUNT(*) AS count, COALESCE(SUM(opening), 0) AS opening, COALESCE(SUM(debit), 0) AS debit, COALESCE(SUM(credit), 0) AS credit,
        COALESCE(SUM("closingDebit"), 0) AS "closingDebit", COALESCE(SUM("closingCredit"), 0) AS "closingCredit" FROM report`);
      const meta = this.paging(Number(totals.count), input.page, input.pageSize, exporting);
      const rows = await tx.$queryRaw<TrialRow[]>(Prisma.sql`${cte} SELECT * FROM report ORDER BY code, "accountId" LIMIT ${meta.pageSize} OFFSET ${(meta.page - 1) * meta.pageSize}`);
      return { period: { from: input.from, to: input.to }, generatedAt: new Date().toISOString(), totals: trialValues(totals), data: rows.map((r) => ({ accountId: r.accountId, code: r.code, name: r.name, type: r.type, ...trialValues(r) })), meta };
    }, { isolationLevel: "RepeatableRead", timeout: 15000 });
  }
  async summary(companyId: string) {
    return this.prisma.$transaction(async (tx) => ({ accounts: await tx.account.count({ where: { companyId } }), activeLedger: await tx.account.count({ where: { companyId, isGroup: false, status: "ACTIVE" } }), posted: await tx.journal.count({ where: { companyId, status: "POSTED" } }), drafts: await tx.journal.count({ where: { companyId, status: "DRAFT" } }) }), { isolationLevel: "RepeatableRead" });
  }
}
