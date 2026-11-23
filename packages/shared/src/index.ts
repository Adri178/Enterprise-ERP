import { z } from "zod";
export * from "./reports";
export * from "./human-resources";
export * from "./attendance";
export * from "./accounting";
export * from "./manufacturing";
export * from "./permissions";

export const roles = ["ADMIN", "MANAGER", "VIEWER"] as const;
export type Role = (typeof roles)[number];
export * from "./catalog";
export * from "./procurement";
export * from "./inventory";
export * from "./sales";
import type { CompanyInput } from "./catalog";
export interface Company extends CompanyInput {
  id: string;
  role: Role;
  currencyLocked?: boolean;
  updatedAt?: string;
}
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  companies: Company[];
  mustChangePassword?: boolean;
}
export const loginSchema = z.object({
  email: z.email("Format email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter").max(128),
});
export const draftSchema = z.object({
  party: z.string().trim().min(3, "Nama relasi minimal 3 karakter").max(120),
  amount: z
    .number()
    .positive("Nilai harus lebih dari 0")
    .max(1e14, "Nilai terlalu besar"),
  date: z.iso.date("Tanggal tidak valid"),
  description: z.string().max(1000),
});
export type Transaction = {
  id: string;
  companyId: string;
  type:
    | "Sales Invoice"
    | "Purchase Order"
    | "Sales Order"
    | "Purchase Invoice"
    | "Payment";
  party: string;
  amount: number;
  date: string;
  status: "COMPLETED" | "PENDING" | "APPROVED" | "DRAFT";
  description?: string;
};
export const canWrite = (role: Role) => role === "ADMIN" || role === "MANAGER";
export * from "./automatic-accounting";
export * from "./deployment";
export * from "./rfq";
