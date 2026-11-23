import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  reportQuerySchema,
  reportExportSchema,
  reportExportLimit,
  reportMonths,
  type ReportQuery,
  type ReportInvoice,
  type ReportSummary,
} from "@erp/shared";
import { PrismaService } from "../prisma/prisma.module";
import { validate } from "../common/validation";

type Filters = Omit<ReportQuery, "page" | "pageSize">;
type Amount = Prisma.Decimal;
type Summary = {
  count: bigint;
  amount: Amount;
  settled: Amount;
  outstanding: Amount;
};
type Invoice = Omit<
  ReportInvoice,
  "date" | "paymentDate" | "amount" | "settled" | "outstanding"
> & {
  date: Date;
  paymentDate: Date | null;
  amount: Amount;
  settled: Amount;
  outstanding: Amount;
};
type Monthly = { month: string; amount: Amount; count: bigint };
type Party = {
  partyId: string;
  partyName: string;
  amount: Amount;
  count: bigint;
};
const summarySelect = Prisma.sql`SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount,
  COALESCE(SUM(settled), 0) AS settled, COALESCE(SUM(outstanding), 0) AS outstanding FROM filtered`;
const serializeSummary = (row: Summary): ReportSummary => ({
  count: Number(row.count),
  amount: Number(row.amount),
  settled: Number(row.settled),
  outstanding: Number(row.outstanding),
});
const serializeInvoice = (row: Invoice): ReportInvoice => ({
  ...row,
  date: row.date.toISOString().slice(0, 10),
  paymentDate: row.paymentDate?.toISOString().slice(0, 10) || null,
  amount: Number(row.amount),
  settled: Number(row.settled),
  outstanding: Number(row.outstanding),
});

@Injectable()
export class ReportsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // All identifiers come from fixed fragments; company, dates and search remain SQL parameters.
  private query(companyId: string, input: Filters) {
    const sales = input.domain === "sales";
    const table = sales
      ? Prisma.sql`"SalesDocument"`
      : Prisma.sql`"PurchaseDocument"`;
    const partyId = sales
      ? Prisma.sql`d."customerId"`
      : Prisma.sql`d."supplierId"`;
    const partyName = sales
      ? Prisma.sql`d."customerName"`
      : Prisma.sql`d."supplierName"`;
    const invoiceKind = sales
      ? Prisma.sql`'SALES_INVOICE'`
      : Prisma.sql`'PURCHASE_INVOICE'`;
    // strpos provides literal, case-insensitive search: % and _ are not wildcards.
    const search = input.q
      ? Prisma.sql`AND (strpos(lower(d.number), lower(${input.q})) > 0
      OR strpos(lower(${partyName}), lower(${input.q})) > 0)`
      : Prisma.empty;
    const settlement =
      input.settlement === "PAID"
        ? Prisma.sql`WHERE outstanding = 0`
        : input.settlement === "UNPAID"
          ? Prisma.sql`WHERE outstanding > 0`
          : Prisma.empty;
    return Prisma.sql`WITH invoices AS (
      SELECT d.id, d.number, d.date, ${partyId} AS "partyId", ${partyName} AS "partyName", d.currency, d.amount,
        COALESCE(p.amount, 0) AS settled, d.amount - COALESCE(p.amount, 0) AS outstanding,
        p.number AS "paymentNumber", p.date AS "paymentDate"
      FROM ${table} d
      LEFT JOIN ${table} p ON p."companyId" = d."companyId" AND p."sourceId" = d.id
        AND p.kind = 'PAYMENT' AND p.status = 'POSTED' AND p.date <= ${input.to}::date
      WHERE d."companyId" = ${companyId} AND d.kind = ${invoiceKind} AND d.status = 'POSTED'
        AND d.date >= ${input.from}::date AND d.date <= ${input.to}::date ${search}
    ), filtered AS (SELECT * FROM invoices ${settlement})`;
  }
  private order(input: Filters) {
    const columns = {
      date: Prisma.sql`date`,
      number: Prisma.sql`number`,
      partyName: Prisma.sql`"partyName"`,
      amount: Prisma.sql`amount`,
      outstanding: Prisma.sql`outstanding`,
    };
    return Prisma.sql`ORDER BY ${columns[input.sort]} ${input.direction === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`}, id ASC`;
  }
  async invoices(companyId: string, body: unknown) {
    const input = validate(reportQuerySchema, body),
      cte = this.query(companyId, input);
    return this.prisma.$transaction(
      async (tx) => {
        const [totals] = await tx.$queryRaw<Summary[]>(
          Prisma.sql`${cte} ${summarySelect}`,
        );
        const summary = serializeSummary(totals);
        const pageCount = Math.max(
            1,
            Math.ceil(summary.count / input.pageSize),
          ),
          page = Math.min(input.page, pageCount);
        const rows = await tx.$queryRaw<
          Invoice[]
        >(Prisma.sql`${cte} SELECT * FROM filtered ${this.order(input)}
        LIMIT ${input.pageSize} OFFSET ${(page - 1) * input.pageSize}`);
        const monthly = await tx.$queryRaw<Monthly[]>(Prisma.sql`${cte}
        SELECT to_char(date, 'YYYY-MM') AS month, SUM(amount) AS amount, COUNT(*) AS count
        FROM filtered GROUP BY month ORDER BY month`);
        const parties = await tx.$queryRaw<Party[]>(Prisma.sql`${cte}
        SELECT ranked.*, (SELECT f."partyName" FROM filtered f WHERE f."partyId" = ranked."partyId"
          ORDER BY f.date DESC, f.id ASC LIMIT 1) AS "partyName"
        FROM (SELECT "partyId", SUM(amount) AS amount, COUNT(*) AS count
          FROM filtered GROUP BY "partyId" ORDER BY amount DESC, "partyId" ASC LIMIT 5) ranked
        ORDER BY ranked.amount DESC, ranked."partyId" ASC`);
        return {
          domain: input.domain,
          period: { from: input.from, to: input.to },
          generatedAt: new Date().toISOString(),
          summary,
          monthly: reportMonths(input.from, input.to).map((month) => {
            const row = monthly.find((r) => r.month === month);
            return {
              month,
              amount: Number(row?.amount || 0),
              count: Number(row?.count || 0),
            };
          }),
          parties: parties.map((row) => ({
            ...row,
            amount: Number(row.amount),
            count: Number(row.count),
          })),
          data: rows.map(serializeInvoice),
          meta: {
            total: summary.count,
            page,
            pageSize: input.pageSize,
            pageCount,
          },
        };
      },
      { isolationLevel: "RepeatableRead", timeout: 15000 },
    );
  }
  async export(companyId: string, body: unknown) {
    const input = validate(reportExportSchema, body),
      cte = this.query(companyId, input);
    return this.prisma.$transaction(
      async (tx) => {
        const [totals] = await tx.$queryRaw<Summary[]>(
          Prisma.sql`${cte} ${summarySelect}`,
        );
        if (Number(totals.count) > reportExportLimit)
          throw new BadRequestException(
            `Ekspor maksimal ${reportExportLimit.toLocaleString("id-ID")} Invoice. Persempit periode atau filter.`,
          );
        const rows = await tx.$queryRaw<Invoice[]>(
          Prisma.sql`${cte} SELECT * FROM filtered ${this.order(input)}`,
        );
        return {
          domain: input.domain,
          period: { from: input.from, to: input.to },
          generatedAt: new Date().toISOString(),
          summary: serializeSummary(totals),
          data: rows.map(serializeInvoice),
        };
      },
      { isolationLevel: "RepeatableRead", timeout: 15000 },
    );
  }
}
