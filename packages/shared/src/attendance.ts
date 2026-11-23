import { z } from "zod";
export const attendanceStatuses = ["PRESENT", "ABSENT", "PERMIT", "LEAVE"] as const;
export type AttendanceStatus = (typeof attendanceStatuses)[number];
export const attendanceToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta" }).format(new Date());
export function attendanceClockMinutes(value: string) { return value ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : null; }
export function attendanceClock(value: number | null) { return value === null ? "" : `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`; }
const clock = z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Gunakan jam dengan format HH:mm")]);
const date = z.iso.date("Tanggal tidak valid").refine(value => !value.startsWith("0000"), "Tahun minimal 0001");
const fields = z.object({ status: z.enum(attendanceStatuses), checkIn: clock, checkOut: clock, description: z.string().trim().max(1000, "Deskripsi maksimal 1000 karakter") });
function checkClock(value: z.infer<typeof fields>, ctx: z.RefinementCtx) {
  if (value.status === "PRESENT") {
    if (!value.checkIn || !value.checkOut) ctx.addIssue({ code: "custom", path: ["checkOut"], message: "Jam masuk dan pulang wajib diisi untuk status Hadir" });
    else if (value.checkOut <= value.checkIn) ctx.addIssue({ code: "custom", path: ["checkOut"], message: "Jam pulang harus sesudah jam masuk pada hari yang sama" });
  } else if (value.checkIn || value.checkOut) ctx.addIssue({ code: "custom", path: ["checkIn"], message: "Status selain Hadir tidak menggunakan jam masuk atau pulang" });
}
export const attendanceCreateSchema = fields.extend({ requestKey: z.uuid().transform(value => value.toLowerCase()), employeeId: z.string().min(1, "Pilih Employee").max(100), date }).strict().superRefine((value, ctx) => {
  checkClock(value, ctx);
  if (value.date > attendanceToday()) ctx.addIssue({ code: "custom", path: ["date"], message: "Kehadiran tidak dapat dicatat untuk tanggal mendatang" });
});
export const attendanceCorrectionSchema = fields.extend({ expectedUpdatedAt: z.iso.datetime("Versi data wajib disertakan"), reason: z.string().trim().min(5, "Alasan koreksi minimal 5 karakter").max(500, "Alasan koreksi maksimal 500 karakter") }).strict().superRefine(checkClock);
export const attendanceQuerySchema = z.object({
  period: z.string().regex(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/, "Pilih periode yang valid").default(() => attendanceToday().slice(0, 7)),
  q: z.string().trim().max(120).default(""), status: z.enum(["ALL", ...attendanceStatuses]).default("ALL"), employeeId: z.string().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).max(1000000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sort: z.enum(["date", "employeeCode", "employeeName", "status", "createdAt"]).default("date"), direction: z.enum(["asc", "desc"]).default("desc"),
}).strict();
export type AttendanceCreate = z.infer<typeof attendanceCreateSchema>;
export type AttendanceCorrectionInput = z.infer<typeof attendanceCorrectionSchema>;
export interface AttendanceSnapshot { status: AttendanceStatus; checkIn: string; checkOut: string; description: string; leaveRequestId: string | null }
export interface AttendanceEntry extends AttendanceSnapshot {
  id: string; companyId: string; number: string; employeeId: string; employeeCode: string; employeeName: string;
  branchName: string; departmentName: string; date: string; durationMinutes: number; createdAt: string; updatedAt: string;
  creatorName: string; editorName: string; revision: number;
}
export interface AttendanceHistory { id: string; actorName: string; createdAt: string; reason: string; before: AttendanceSnapshot; after: AttendanceSnapshot }
export interface AttendanceDetail extends AttendanceEntry { history: AttendanceHistory[]; historyTotal: number }
export interface AttendanceResult { data: AttendanceEntry[]; meta: { total: number; page: number; pageSize: number; pageCount: number }; summary: { present: number; absent: number; permit: number; leave: number; durationMinutes: number } }
