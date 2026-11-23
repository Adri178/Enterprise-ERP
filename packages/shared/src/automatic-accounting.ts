import { z } from "zod";
import type { AccountType } from "./accounting";
export const accountingPurposes = ["INVENTORY", "GRNI", "PAYABLE", "RECEIVABLE", "CASH", "REVENUE", "COGS", "STOCK_GAIN", "STOCK_LOSS", "OPENING_EQUITY"] as const;
export type AccountingPurpose = (typeof accountingPurposes)[number];
export const purposeAccountTypes: Record<AccountingPurpose, AccountType> = { INVENTORY: "ASSET", GRNI: "LIABILITY", PAYABLE: "LIABILITY", RECEIVABLE: "ASSET", CASH: "ASSET", REVENUE: "INCOME", COGS: "EXPENSE", STOCK_GAIN: "INCOME", STOCK_LOSS: "EXPENSE", OPENING_EQUITY: "EQUITY" };
export const controlPurposes: AccountingPurpose[] = ["INVENTORY", "GRNI", "PAYABLE", "RECEIVABLE"];
export const activateAccountingSchema = z.object({
  requestKey: z.uuid(), snapshotKey: z.string().regex(/^[a-f0-9]{64}$/, "Muat ulang saldo awal"),
  effectiveFrom: z.iso.date("Tanggal tidak valid").refine((v) => !v.startsWith("0000"), "Tahun tidak valid"),
  reason: z.string().trim().min(5, "Alasan minimal 5 karakter").max(500),
  mappings: z.record(z.enum(accountingPurposes), z.string().min(1, "Pilih Account").max(100)),
}).refine((v) => new Set(Object.values(v.mappings)).size === accountingPurposes.length, { path: ["mappings"], message: "Gunakan Account berbeda untuk setiap fungsi" });
export type ActivateAccountingInput = z.output<typeof activateAccountingSchema>;
export interface OpeningSnapshot { inventory: string; receivable: string; payable: string; grni: string; equity: string; latestDate: string | null; snapshotKey: string }
export interface AccountingPolicyView { enabled: boolean; effectiveFrom: string | null; createdAt: string | null; mappings: Partial<Record<AccountingPurpose, { accountId: string; code: string; name: string }>>; opening: OpeningSnapshot; openingJournal: { id: string; number: string } | null }
export interface OperationalPostingView { id: string; companyId: string; number: string; kind: string; date: string; amount: string; note: string; journal: { id: string; number: string } | null; source: { type: "purchase" | "sales" | "operation" | "production"; id: string } }
