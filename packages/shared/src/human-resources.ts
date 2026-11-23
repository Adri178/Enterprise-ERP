import { z } from "zod";
export const employmentTypes = ["PERMANENT", "CONTRACT", "INTERNSHIP"] as const;
export const leaveTypes = ["ANNUAL", "SICK", "OTHER"] as const;
export const leaveStatuses = [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;
export type LeaveStatus = (typeof leaveStatuses)[number];
const reference = z.string().min(1, "Pilih record terkait").max(100);
const hrDate = z.iso
  .date("Tanggal tidak valid")
  .refine((v) => !v.startsWith("0000"), "Tahun minimal 0001");
export const employeeSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, "Kode minimal 2 karakter")
      .max(30)
      .regex(/^[A-Za-z0-9-]+$/, "Gunakan huruf, angka, atau tanda -")
      .transform((v) => v.toUpperCase()),
    name: z.string().trim().min(3, "Nama minimal 3 karakter").max(120),
    email: z
      .union([z.literal(""), z.email("Format email tidak valid")])
      .transform((v) => v.toLowerCase()),
    phone: z.string().trim().max(30),
    jobTitle: z.string().trim().min(2, "Jabatan minimal 2 karakter").max(100),
    branchId: reference,
    departmentId: reference,
    employmentType: z.enum(employmentTypes),
    startDate: hrDate,
    endDate: z.union([z.literal(""), hrDate]),
    status: z.enum(["ACTIVE", "INACTIVE"]),
  })
  .superRefine((v, ctx) => {
    if (v.status === "ACTIVE" && v.endDate)
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Employee aktif belum memiliki tanggal berakhir",
      });
    if (v.status === "INACTIVE" && !v.endDate)
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Isi tanggal berakhir untuk Employee tidak aktif",
      });
    if (v.endDate && v.endDate < v.startDate)
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Tanggal berakhir tidak boleh mendahului tanggal bergabung",
      });
  });
export type EmployeeInput = z.output<typeof employeeSchema>;
export type EmployeeFormInput = z.input<typeof employeeSchema>;
export interface Employee extends EmployeeInput {
  id: string;
  companyId: string;
  branchName: string;
  departmentName: string;
  createdAt: string;
  updatedAt: string;
}
export const employeeQuerySchema = z.object({
  q: z.string().trim().max(120).default(""),
  status: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"),
  branchId: reference.optional(),
  departmentId: reference.optional(),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sort: z
    .enum(["code", "name", "startDate", "status", "createdAt"])
    .default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});
export type EmployeeQuery = z.output<typeof employeeQuerySchema>;
export const hrVersionSchema = z.object({
  expectedUpdatedAt: z.iso.datetime("Versi data wajib disertakan"),
});
export function leaveWorkingDays(from: string, to: string) {
  const span = (Date.parse(to) - Date.parse(from)) / 86400000;
  if (!Number.isFinite(span) || span < 0 || span >= 366) return 0;
  let days = 0;
  for (
    let cursor = Date.parse(from), end = Date.parse(to);
    cursor <= end;
    cursor += 86400000
  ) {
    const weekday = new Date(cursor).getUTCDay();
    if (weekday !== 0 && weekday !== 6) days++;
  }
  return days;
}
export const leaveRequestSchema = z
  .object({
    requestKey: z.uuid(),
    employeeId: reference,
    type: z.enum(leaveTypes),
    fromDate: hrDate,
    toDate: hrDate,
    reason: z.string().trim().min(5, "Alasan minimal 5 karakter").max(1000),
  })
  .superRefine((v, ctx) => {
    const diff = (Date.parse(v.toDate) - Date.parse(v.fromDate)) / 86400000;
    if (diff < 0)
      ctx.addIssue({
        code: "custom",
        path: ["toDate"],
        message: "Tanggal akhir tidak boleh mendahului tanggal awal",
      });
    else if (diff >= 366)
      ctx.addIssue({
        code: "custom",
        path: ["toDate"],
        message: "Satu pengajuan maksimal 366 hari kalender",
      });
    else if (!leaveWorkingDays(v.fromDate, v.toDate))
      ctx.addIssue({
        code: "custom",
        path: ["toDate"],
        message: "Periode harus mencakup hari kerja Senin–Jumat",
      });
  });
export type LeaveInput = z.output<typeof leaveRequestSchema>;
export type LeaveFormInput = z.input<typeof leaveRequestSchema>;
export const leaveActionSchema = hrVersionSchema
  .extend({
    action: z.enum(["submit", "approve", "reject", "cancel"]),
    note: z.string().trim().max(500).default(""),
  })
  .superRefine((v, ctx) => {
    if (v.action === "reject" && v.note.length < 5)
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "Alasan penolakan minimal 5 karakter",
      });
  });
export type LeaveAction = z.output<typeof leaveActionSchema>["action"];
export const leaveQuerySchema = employeeQuerySchema
  .omit({ branchId: true, departmentId: true, sort: true })
  .extend({
    status: z.enum([...leaveStatuses, "ALL"]).default("ALL"),
    employeeId: reference.optional(),
    direction: z.enum(["asc", "desc"]).default("desc"),
  });
export interface LeaveRequest {
  id: string;
  companyId: string;
  number: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  branchName: string;
  departmentName: string;
  type: (typeof leaveTypes)[number];
  status: LeaveStatus;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  createdBy: string;
  creatorName: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewerName: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
}
export interface HrSummary {
  total: number;
  active: number;
  inactive: number;
  pending: number;
  branches: { id: string; name: string; active: number }[];
}
export function leaveActions(
  status: LeaveStatus,
  creator: boolean,
  administrator: boolean,
): LeaveAction[] {
  if (status === "DRAFT")
    return creator || administrator ? ["submit", "cancel"] : [];
  if (status === "PENDING")
    return [
      ...(!creator ? (["approve", "reject"] as const) : []),
      ...(creator || administrator ? (["cancel"] as const) : []),
    ];
  return [];
}
