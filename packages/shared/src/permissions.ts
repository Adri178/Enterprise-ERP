import { z } from "zod";
import type { Role } from "./index";
import { accountingPeriodSchema } from "./accounting";
const role = z.enum(["ADMIN", "MANAGER", "VIEWER"]);
const email = z.string().trim().toLowerCase().pipe(z.email("Format email tidak valid").max(254, "Email maksimal 254 karakter"));
export const securePasswordSchema = z.string().min(12, "Password minimal 12 karakter").max(72, "Password maksimal 72 byte").refine((v) => new TextEncoder().encode(v).length <= 72, "Password maksimal 72 byte, termasuk karakter khusus").refine((v) => !v.includes("\0"), "Password mengandung karakter tidak valid");
const common = { requestKey: z.uuid(), email, role, reason: z.string().trim().min(5, "Alasan minimal 5 karakter").max(500, "Alasan maksimal 500 karakter") };
export const grantCompanyUserSchema = z.discriminatedUnion("mode", [z.object({ ...common, mode: z.literal("EXISTING") }), z.object({ ...common, mode: z.literal("NEW"), name: z.string().trim().min(2, "Nama minimal 2 karakter").max(120, "Nama maksimal 120 karakter"), initialPassword: securePasswordSchema })]);
export const editCompanyUserSchema = z.object({ role, active: z.boolean(), reason: common.reason, expectedUpdatedAt: z.iso.datetime("Versi akses wajib disertakan") });
export const companyUsersQuerySchema = z.object({ q: z.string().trim().max(120).default(""), role: z.enum(["ALL", "ADMIN", "MANAGER", "VIEWER"]).default("ALL"), status: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"), page: z.coerce.number().int().min(1).max(1000000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(10), sort: z.enum(["name", "email", "role", "createdAt", "updatedAt"]).default("name"), direction: z.enum(["asc", "desc"]).default("asc") });
export const accessAuditQuerySchema = accountingPeriodSchema.safeExtend({ userId: z.string().max(100).default(""), action: z.enum(["ALL", "GRANT", "UPDATE"]).default("ALL"), page: z.coerce.number().int().min(1).max(1000000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(10) });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1, "Isi password saat ini").max(128), newPassword: securePasswordSchema, confirmPassword: z.string() }).superRefine((v, ctx) => {
  if (v.newPassword !== v.confirmPassword) ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Konfirmasi password tidak sama" });
  if (v.currentPassword === v.newPassword) ctx.addIssue({ code: "custom", path: ["newPassword"], message: "Gunakan password baru yang berbeda" });
});
export type GrantCompanyUserInput = z.output<typeof grantCompanyUserSchema>;
export type EditCompanyUserInput = z.output<typeof editCompanyUserSchema>;
export type ChangePasswordInput = z.output<typeof changePasswordSchema>;
export interface CompanyMember { userId: string; companyId: string; name: string; email: string; role: Role; active: boolean; userActive: boolean; mustChangePassword: boolean; createdAt: string; updatedAt: string }
export interface CompanyMemberSnapshot { userId: string; name: string; email: string; role: Role; active: boolean }
export interface AccessAuditEntry { id: string; userId: string; action: "GRANT" | "UPDATE"; actorName: string; createdAt: string; reason: string; before: CompanyMemberSnapshot | null; after: CompanyMemberSnapshot }
