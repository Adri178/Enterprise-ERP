import { z } from "zod";

const reportDate = z.iso
  .date("Tanggal tidak valid")
  .refine((value) => !value.startsWith("0000"), "Tahun minimal 0001");
const reportFilters = z.object({
  domain: z.enum(["sales", "procurement"]).default("sales"),
  from: reportDate,
  to: reportDate,
  q: z.string().trim().max(120, "Pencarian maksimal 120 karakter").default(""),
  settlement: z.enum(["ALL", "PAID", "UNPAID"]).default("ALL"),
  sort: z
    .enum(["date", "number", "partyName", "amount", "outstanding"])
    .default("date"),
  direction: z.enum(["asc", "desc"]).default("desc"),
});
const periodCheck = (
  input: { from: string; to: string },
  ctx: z.RefinementCtx,
) => {
  const days = (Date.parse(input.to) - Date.parse(input.from)) / 86400000;
  if (days < 0)
    ctx.addIssue({
      code: "custom",
      path: ["to"],
      message: "Tanggal akhir tidak boleh mendahului tanggal awal",
    });
  else if (days >= 366)
    ctx.addIssue({
      code: "custom",
      path: ["to"],
      message: "Periode laporan maksimal 366 hari",
    });
};
export const reportQuerySchema = reportFilters
  .extend({
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
  })
  .superRefine(periodCheck);
export const reportExportSchema = reportFilters.superRefine(periodCheck);
export type ReportQuery = z.output<typeof reportQuerySchema>;
export type ReportDomain = ReportQuery["domain"];
export const reportExportLimit = 10000;

export interface ReportInvoice {
  id: string;
  number: string;
  date: string;
  partyId: string;
  partyName: string;
  currency: string;
  amount: number;
  settled: number;
  outstanding: number;
  paymentNumber: string | null;
  paymentDate: string | null;
}
export interface ReportSummary {
  count: number;
  amount: number;
  settled: number;
  outstanding: number;
}
export interface InvoiceReport {
  domain: ReportDomain;
  period: { from: string; to: string };
  generatedAt: string;
  summary: ReportSummary;
  monthly: { month: string; amount: number; count: number }[];
  parties: {
    partyId: string;
    partyName: string;
    amount: number;
    count: number;
  }[];
  data: ReportInvoice[];
  meta: { total: number; page: number; pageSize: number; pageCount: number };
}
export interface InvoiceReportExport {
  domain: ReportDomain;
  period: { from: string; to: string };
  generatedAt: string;
  summary: ReportSummary;
  data: ReportInvoice[];
}

export function reportMonths(from: string, to: string) {
  const months: string[] = [];
  const index = (date: string) =>
    Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
  for (let cursor = index(from); cursor <= index(to); cursor++)
    months.push(
      `${String(Math.floor(cursor / 12)).padStart(4, "0")}-${String((cursor % 12) + 1).padStart(2, "0")}`,
    );
  return months;
}
