import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { attendanceClock, attendanceClockMinutes, attendanceCreateSchema, attendanceCorrectionSchema, attendanceQuerySchema, type AttendanceDetail, type AttendanceEntry, type AttendanceHistory, type AttendanceSnapshot, type AttendanceStatus } from "@erp/shared";
import { PrismaService } from "../prisma/prisma.module";
import { validate } from "../common/validation";
import { employeeInclude, hrAccess, hrAudit } from "./hr-common";

const include = { creator: { select: { name: true } }, editor: { select: { name: true } } } satisfies Prisma.AttendanceRecordInclude;
type Row = Prisma.AttendanceRecordGetPayload<{ include: typeof include }>;
type Tx = Prisma.TransactionClient;
function snapshot(row: Row): AttendanceSnapshot { return { status: row.status, checkIn: attendanceClock(row.checkInMinutes), checkOut: attendanceClock(row.checkOutMinutes), description: row.description, leaveRequestId: row.leaveRequestId }; }
function serialize(row: Row): AttendanceEntry {
  return { ...snapshot(row), id: row.id, companyId: row.companyId, number: row.number, employeeId: row.employeeId, employeeCode: row.employeeCode, employeeName: row.employeeName, branchName: row.branchName, departmentName: row.departmentName, date: row.date.toISOString().slice(0, 10), durationMinutes: (row.checkOutMinutes ?? 0) - (row.checkInMinutes ?? 0), creatorName: row.creator.name, editorName: row.editor.name, revision: row.revision, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
export async function attendanceLeave(tx: Tx, companyId: string, employeeId: string, date: Date, status: AttendanceStatus) {
  const weekday = date.getUTCDay(), working = weekday !== 0 && weekday !== 6;
  const leave = working ? await tx.leaveRequest.findFirst({ where: { companyId, employeeId, status: "APPROVED", fromDate: { lte: date }, toDate: { gte: date } }, select: { id: true } }) : null;
  if (status === "LEAVE" && !leave) throw new ConflictException("Status Cuti memerlukan Leave Request Disetujui pada hari kerja Senin–Jumat yang sama.");
  if (status !== "LEAVE" && leave) throw new ConflictException("Tanggal ini memiliki Leave Request Disetujui. Gunakan status Cuti.");
  return leave?.id || null;
}

@Injectable()
export class AttendanceService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private query(body: unknown) {
    const query = validate(attendanceQuerySchema, body), from = new Date(`${query.period}-01T00:00:00Z`), to = new Date(from);
    to.setUTCMonth(to.getUTCMonth() + 1);
    return { query, where: { date: { gte: from, lt: to }, ...(query.status !== "ALL" ? { status: query.status } : {}), ...(query.employeeId ? { employeeId: query.employeeId } : {}), ...(query.q ? { OR: ["number", "employeeCode", "employeeName", "departmentName"].map(field => ({ [field]: { contains: query.q, mode: "insensitive" } })) } : {}) } satisfies Prisma.AttendanceRecordWhereInput };
  }
  async list(companyId: string, body: unknown) {
    const { query, where: filters } = this.query(body), where = { ...filters, companyId };
    return this.prisma.$transaction(async tx => {
      const total = await tx.attendanceRecord.count({ where }), pageCount = Math.max(1, Math.ceil(total / query.pageSize)), page = Math.min(query.page, pageCount);
      const rows = await tx.attendanceRecord.findMany({ where, include, orderBy: [{ [query.sort]: query.direction }, { id: "asc" }], skip: (page - 1) * query.pageSize, take: query.pageSize });
      const statuses = await tx.attendanceRecord.groupBy({ by: ["status"], where, _count: true, _sum: { checkInMinutes: true, checkOutMinutes: true } });
      const count = (status: AttendanceStatus) => statuses.find(row => row.status === status)?._count || 0;
      return { data: rows.map(serialize), meta: { total, page, pageCount, pageSize: query.pageSize }, summary: { present: count("PRESENT"), absent: count("ABSENT"), permit: count("PERMIT"), leave: count("LEAVE"), durationMinutes: statuses.reduce((sum, row) => sum + (row._sum.checkOutMinutes || 0) - (row._sum.checkInMinutes || 0), 0) } };
    }, { isolationLevel: "RepeatableRead" });
  }
  async export(companyId: string, body: unknown) {
    const { query, where: filters } = this.query(body), where = { ...filters, companyId };
    return this.prisma.$transaction(async tx => {
      const total = await tx.attendanceRecord.count({ where });
      if (total > 10000) throw new BadRequestException("Ekspor maksimal 10.000 catatan. Persempit filter terlebih dahulu.");
      const rows = await tx.attendanceRecord.findMany({ where, include, orderBy: [{ [query.sort]: query.direction }, { id: "asc" }] });
      return { data: rows.map(serialize), total };
    }, { isolationLevel: "RepeatableRead" });
  }
  async detail(companyId: string, id: string): Promise<AttendanceDetail> {
    return this.prisma.$transaction(async tx => {
      const row = await tx.attendanceRecord.findFirst({ where: { companyId, id }, include });
      if (!row) throw new NotFoundException("Attendance tidak ditemukan");
      const where = { companyId, entity: "attendance", entityId: id, action: "CORRECT" };
      const historyTotal = await tx.auditLog.count({ where });
      const history = await tx.auditLog.findMany({ where, include: { actor: { select: { name: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 });
      return { ...serialize(row), historyTotal, history: history.map(entry => ({ ...(entry.changes as unknown as Pick<AttendanceHistory, "reason" | "before" | "after">), id: entry.id, actorName: entry.actor.name, createdAt: entry.createdAt.toISOString() })) };
    }, { isolationLevel: "RepeatableRead" });
  }
  async create(companyId: string, actorId: string, body: unknown) {
    const input = validate(attendanceCreateSchema, body), requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    return this.prisma.$transaction(async tx => {
      const member = await hrAccess(tx, companyId, actorId);
      const existing = await tx.attendanceRecord.findUnique({ where: { companyId_requestKey: { companyId, requestKey: input.requestKey } }, include });
      if (existing) {
        if (existing.createdBy !== actorId || existing.requestHash !== requestHash) throw new ConflictException("Kunci permintaan sudah digunakan dengan data berbeda");
        return serialize(existing);
      }
      const employee = await tx.employee.findFirst({ where: { companyId, id: input.employeeId }, include: employeeInclude });
      if (!employee || employee.status !== "ACTIVE" || employee.branch.record.status !== "ACTIVE" || employee.department.record.status !== "ACTIVE") throw new BadRequestException("Pilih Employee aktif dengan Branch dan Department aktif dari company yang sama.");
      const date = new Date(input.date);
      if (date < employee.startDate || employee.endDate && date > employee.endDate) throw new BadRequestException("Tanggal Attendance harus berada dalam masa kerja Employee.");
      const duplicate = await tx.attendanceRecord.findUnique({ where: { companyId_employeeId_date: { companyId, employeeId: employee.id, date } } });
      if (duplicate) throw new ConflictException("Employee sudah memiliki catatan pada tanggal tersebut");
      const leaveRequestId = await attendanceLeave(tx, companyId, employee.id, date, input.status), year = date.getUTCFullYear();
      const sequence = await tx.documentSequence.upsert({ where: { companyId_prefix_year: { companyId, prefix: "ATT", year } }, create: { companyId, prefix: "ATT", year, value: 1 }, update: { value: { increment: 1 } } });
      const row = await tx.attendanceRecord.create({ data: { companyId, number: `ATT-${member.company.code}-${year}-${String(sequence.value).padStart(5, "0")}`, requestKey: input.requestKey, requestHash, employeeId: employee.id, employeeCode: employee.code, employeeName: employee.name, branchName: employee.branch.record.name, departmentName: employee.department.record.name, date, status: input.status, checkInMinutes: attendanceClockMinutes(input.checkIn), checkOutMinutes: attendanceClockMinutes(input.checkOut), description: input.description, leaveRequestId, createdBy: actorId, editedBy: actorId }, include });
      await hrAudit(tx, companyId, actorId, "attendance", row.id, "CREATE", { after: serialize(row) });
      return serialize(row);
    }, { isolationLevel: "Serializable" });
  }
  async correct(companyId: string, actorId: string, id: string, body: unknown) {
    const input = validate(attendanceCorrectionSchema, body);
    return this.prisma.$transaction(async tx => {
      await hrAccess(tx, companyId, actorId);
      const before = await tx.attendanceRecord.findFirst({ where: { companyId, id }, include });
      if (!before) throw new NotFoundException("Attendance tidak ditemukan");
      if (before.updatedAt.toISOString() !== input.expectedUpdatedAt) throw new ConflictException("Data telah berubah. Muat ulang sebelum melakukan koreksi.");
      const leaveRequestId = await attendanceLeave(tx, companyId, before.employeeId, before.date, input.status);
      const changed = await tx.attendanceRecord.updateMany({ where: { companyId, id, updatedAt: before.updatedAt }, data: { status: input.status, checkInMinutes: attendanceClockMinutes(input.checkIn), checkOutMinutes: attendanceClockMinutes(input.checkOut), description: input.description, leaveRequestId, editedBy: actorId, revision: { increment: 1 }, updatedAt: new Date(Math.max(Date.now(), before.updatedAt.getTime() + 1)) } });
      if (changed.count !== 1) throw new ConflictException("Data telah berubah. Muat ulang sebelum melakukan koreksi.");
      const after = await tx.attendanceRecord.findUniqueOrThrow({ where: { id }, include });
      await hrAudit(tx, companyId, actorId, "attendance", id, "CORRECT", { reason: input.reason, before: snapshot(before), after: snapshot(after) });
      return serialize(after);
    }, { isolationLevel: "Serializable" });
  }
}
