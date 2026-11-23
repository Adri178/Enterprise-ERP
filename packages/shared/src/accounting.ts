import { z } from "zod";
export const accountTypes = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"] as const;
export type AccountType = (typeof accountTypes)[number];
export const accountSchema = z.object({
  code: z.string().trim().min(2, "Kode minimal 2 karakter").max(20).regex(/^[A-Za-z0-9-]+$/, "Gunakan huruf, angka, atau tanda -").transform((v) => v.toUpperCase()),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(120),
  type: z.enum(accountTypes), isGroup: z.boolean(), parentId: z.string().max(100), status: z.enum(["ACTIVE", "INACTIVE"]),
}).refine((v) => !!v.parentId || v.isGroup, { path: ["parentId"], message: "Account transaksi harus berada di bawah Account grup" });
export type AccountInput = z.output<typeof accountSchema>;
export type AccountFormInput = z.input<typeof accountSchema>;
export interface Account extends AccountInput { id: string; companyId: string; parentName: string | null; parentCode: string | null; createdAt: string; updatedAt: string }
export const accountQuerySchema = z.object({
  q: z.string().trim().max(120).default(""), type: z.enum([...accountTypes, "ALL"]).default("ALL"),
  status: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"), node: z.enum(["ALL", "GROUP", "LEDGER"]).default("ALL"),
  page: z.coerce.number().int().min(1).max(1000000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(10),
  direction: z.enum(["asc", "desc"]).default("asc"),
});
export const accountingVersionSchema = z.object({ expectedUpdatedAt: z.iso.datetime("Versi data wajib disertakan") });
const date = z.iso.date("Tanggal tidak valid").refine((v) => !v.startsWith("0000"), "Tahun minimal 0001");
const amount = z.number({ error: "Masukkan angka yang valid" }).nonnegative("Nilai tidak boleh negatif").max(1e12, "Nilai maksimal 1.000.000.000.000").refine((v) => Math.round(v * 100) / 100 === v, "Gunakan maksimal 2 desimal");
export const journalLineSchema = z.object({ accountId: z.string().min(1, "Pilih Account").max(100), debit: amount, credit: amount, description: z.string().trim().max(200) })
  .refine((v) => (v.debit > 0) !== (v.credit > 0), { path: ["debit"], message: "Isi hanya salah satu sisi: debit atau kredit" });
export function journalTotals(lines: { debit: number; credit: number }[]) {
  const cents = (value: number) => Number.isFinite(value) ? Math.round(value * 100) : 0;
  return { debit: lines.reduce((n, line) => n + cents(line.debit), 0), credit: lines.reduce((n, line) => n + cents(line.credit), 0) };
}
const journalFields = z.object({ date, description: z.string().trim().min(5, "Deskripsi minimal 5 karakter").max(1000), reference: z.string().trim().max(100), lines: z.array(journalLineSchema).min(2, "Tambahkan minimal 2 baris").max(50, "Maksimal 50 baris") });
function checkJournal(v: z.output<typeof journalFields>, ctx: z.RefinementCtx) {
  const totals = journalTotals(v.lines);
  if (!totals.debit || totals.debit !== totals.credit) ctx.addIssue({ code: "custom", path: ["lines"], message: "Total debit dan kredit harus sama dan lebih dari 0" });
  if (totals.debit > 1e14 || totals.credit > 1e14) ctx.addIssue({ code: "custom", path: ["lines"], message: "Total Journal maksimal 1.000.000.000.000" });
  if (new Set(v.lines.map((l) => l.accountId)).size !== v.lines.length) ctx.addIssue({ code: "custom", path: ["lines"], message: "Account tidak boleh berulang dalam satu Journal" });
}
export const journalSchema = journalFields.extend({ requestKey: z.uuid() }).superRefine(checkJournal);
export const journalEditSchema = journalFields.extend({ expectedUpdatedAt: z.iso.datetime() }).superRefine(checkJournal);
export type JournalInput = z.output<typeof journalSchema>;
export type JournalFormInput = z.input<typeof journalSchema>;
export const journalActionSchema = accountingVersionSchema.extend({ action: z.enum(["post", "cancel"]) });
export const journalReversalSchema = accountingVersionSchema.extend({ requestKey: z.uuid(), date, description: z.string().trim().min(5, "Alasan pembalikan minimal 5 karakter").max(1000) });
export const journalQuerySchema = accountQuerySchema.omit({ type: true, node: true }).extend({ status: z.enum(["ALL", "DRAFT", "POSTED", "CANCELLED"]).default("ALL"), direction: z.enum(["asc", "desc"]).default("desc") });
export interface JournalLine { id: string; accountId: string; accountCode: string; accountName: string; accountType: AccountType; position: number; debit: number; credit: number; description: string }
export interface Journal {
  origin?: "MANUAL" | "OPENING" | "OPERATIONAL";
  id: string; companyId: string; number: string; date: string; currency: string; amount: number; description: string; reference: string;
  status: "DRAFT" | "POSTED" | "CANCELLED"; createdAt: string; updatedAt: string; creatorName: string; postedAt: string | null; posterName: string | null;
  reversalOf: { id: string; number: string } | null; reversedBy: { id: string; number: string; date: string } | null; lines: JournalLine[];
}
export const accountingPeriodSchema = z.object({ from: date, to: date }).superRefine((v, ctx) => {
  const days = (Date.parse(v.to) - Date.parse(v.from)) / 86400000;
  if (days < 0 || days >= 366) ctx.addIssue({ code: "custom", path: ["to"], message: "Pilih periode berurutan maksimal 366 hari" });
});
export const trialBalanceQuerySchema = accountingPeriodSchema.safeExtend({ page: z.coerce.number().int().min(1).max(1000000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(10) });
export const ledgerQuerySchema = trialBalanceQuerySchema.safeExtend({ accountId: z.string().min(1, "Pilih Account").max(100) });
// Report amounts are decimal strings, preserving cents even for large aggregated balances.
export interface LedgerRow { id: string; journalId: string; number: string; date: string; description: string; debit: string; credit: string; balance: string }
export interface GeneralLedger { account: Account; period: { from: string; to: string }; opening: string; debit: string; credit: string; closing: string; generatedAt: string; data: LedgerRow[]; meta: { total: number; page: number; pageSize: number; pageCount: number } }
export interface TrialBalanceRow { accountId: string; code: string; name: string; type: AccountType; opening: string; debit: string; credit: string; closingDebit: string; closingCredit: string }
export interface TrialBalance { period: { from: string; to: string }; generatedAt: string; data: TrialBalanceRow[]; totals: { opening: string; debit: string; credit: string; closingDebit: string; closingCredit: string }; meta: { total: number; page: number; pageSize: number; pageCount: number } }
