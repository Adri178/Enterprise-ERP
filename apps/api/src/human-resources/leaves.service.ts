import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  leaveRequestSchema,
  leaveActionSchema,
  leaveQuerySchema,
  leaveWorkingDays,
  leaveActions,
} from "@erp/shared";
import { PrismaService } from "../prisma/prisma.module";
import { validate } from "../common/validation";
import {
  employeeInclude,
  hrAccess,
  hrAudit,
  leaveInclude,
  serializeLeave,
} from "./hr-common";

@Injectable()
export class LeavesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async list(companyId: string, body: unknown) {
    const q = validate(leaveQuerySchema, body);
    const where: Prisma.LeaveRequestWhereInput = {
      companyId,
      ...(q.status !== "ALL" ? { status: q.status } : {}),
      ...(q.employeeId ? { employeeId: q.employeeId } : {}),
      ...(q.q
        ? {
            OR: ["number", "employeeName", "employeeCode"].map((field) => ({
              [field]: { contains: q.q, mode: "insensitive" },
            })),
          }
        : {}),
    };
    return this.prisma.$transaction(
      async (tx) => {
        const total = await tx.leaveRequest.count({ where }),
          pageCount = Math.max(1, Math.ceil(total / q.pageSize)),
          page = Math.min(q.page, pageCount);
        const rows = await tx.leaveRequest.findMany({
          where,
          include: leaveInclude,
          orderBy: [
            { fromDate: q.direction },
            { createdAt: q.direction },
            { id: "asc" },
          ],
          take: q.pageSize,
          skip: (page - 1) * q.pageSize,
        });
        return {
          data: rows.map(serializeLeave),
          meta: { total, page, pageSize: q.pageSize, pageCount },
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async detail(companyId: string, id: string) {
    const row = await this.prisma.leaveRequest.findFirst({
      where: { companyId, id },
      include: leaveInclude,
    });
    if (!row) throw new NotFoundException("Leave Request tidak ditemukan");
    return serializeLeave(row);
  }
  async create(companyId: string, actorId: string, body: unknown) {
    const input = validate(leaveRequestSchema, body),
      requestHash = createHash("sha256")
        .update(JSON.stringify(input))
        .digest("hex");
    return this.prisma.$transaction(
      async (tx) => {
        const member = await hrAccess(tx, companyId, actorId);
        const existing = await tx.leaveRequest.findUnique({
          where: {
            companyId_requestKey: { companyId, requestKey: input.requestKey },
          },
          include: leaveInclude,
        });
        if (existing) {
          if (
            existing.requestHash !== requestHash ||
            existing.createdBy !== actorId
          )
            throw new ConflictException(
              "Kunci permintaan sudah digunakan dengan data berbeda",
            );
          return serializeLeave(existing);
        }
        const employee = await this.employee(
          tx,
          companyId,
          input.employeeId,
          input.fromDate,
          input.toDate,
        );
        const year = Number(input.fromDate.slice(0, 4)),
          prefix = "LV";
        const seq = await tx.documentSequence.upsert({
          where: { companyId_prefix_year: { companyId, prefix, year } },
          create: { companyId, prefix, year, value: 1 },
          update: { value: { increment: 1 } },
        });
        const row = await tx.leaveRequest.create({
          data: {
            companyId,
            number: `${prefix}-${member.company.code}-${year}-${String(seq.value).padStart(5, "0")}`,
            requestKey: input.requestKey,
            requestHash,
            employeeId: employee.id,
            employeeCode: employee.code,
            employeeName: employee.name,
            branchName: employee.branch.record.name,
            departmentName: employee.department.record.name,
            type: input.type,
            fromDate: new Date(input.fromDate),
            toDate: new Date(input.toDate),
            days: leaveWorkingDays(input.fromDate, input.toDate),
            reason: input.reason,
            createdBy: actorId,
          },
          include: leaveInclude,
        });
        const after = serializeLeave(row);
        await hrAudit(
          tx,
          companyId,
          actorId,
          "leaveRequests",
          row.id,
          "CREATE",
          { after },
        );
        return after;
      },
      { isolationLevel: "Serializable" },
    );
  }
  private async employee(
    tx: Prisma.TransactionClient,
    companyId: string,
    id: string,
    from: string,
    to: string,
  ) {
    const employee = await tx.employee.findFirst({
      where: { companyId, id },
      include: employeeInclude,
    });
    if (
      !employee ||
      employee.status !== "ACTIVE" ||
      employee.branch.record.status !== "ACTIVE" ||
      employee.department.record.status !== "ACTIVE"
    )
      throw new BadRequestException(
        "Pilih Employee aktif dengan Branch dan Department aktif dari company yang sama.",
      );
    if (
      from < employee.startDate.toISOString().slice(0, 10) ||
      (employee.endDate && to > employee.endDate.toISOString().slice(0, 10))
    )
      throw new BadRequestException(
        "Periode cuti harus berada dalam masa kerja Employee.",
      );
    return employee;
  }
  async action(companyId: string, actorId: string, id: string, body: unknown) {
    const input = validate(leaveActionSchema, body);
    return this.prisma.$transaction(
      async (tx) => {
        const member = await hrAccess(tx, companyId, actorId);
        const doc = await tx.leaveRequest.findFirst({
          where: { companyId, id },
          include: leaveInclude,
        });
        if (!doc) throw new NotFoundException("Leave Request tidak ditemukan");
        if (doc.updatedAt.toISOString() !== input.expectedUpdatedAt)
          throw new ConflictException(
            "Data telah berubah. Muat ulang sebelum melanjutkan.",
          );
        if (
          !leaveActions(
            doc.status,
            doc.createdBy === actorId,
            member.role === "ADMIN",
          ).includes(input.action)
        ) {
          if (
            doc.status === "PENDING" &&
            doc.createdBy === actorId &&
            ["approve", "reject"].includes(input.action)
          )
            throw new ForbiddenException(
              "Approval harus dilakukan oleh User berbeda dari pembuat pengajuan.",
            );
          throw new ConflictException(
            "Aksi tidak tersedia untuk status atau User ini.",
          );
        }
        const data: Prisma.LeaveRequestUpdateInput = {
          updatedAt: new Date(
            Math.max(Date.now(), doc.updatedAt.getTime() + 1),
          ),
        };
        if (input.action === "submit" || input.action === "approve") {
          const employee = await this.employee(
            tx,
            companyId,
            doc.employeeId,
            doc.fromDate.toISOString().slice(0, 10),
            doc.toDate.toISOString().slice(0, 10),
          );
          if (
            await tx.leaveRequest.count({
              where: {
                companyId,
                employeeId: doc.employeeId,
                id: { not: doc.id },
                status: { in: ["PENDING", "APPROVED"] },
                fromDate: { lte: doc.toDate },
                toDate: { gte: doc.fromDate },
              },
            })
          )
            throw new ConflictException(
              "Periode cuti bertumpang tindih dengan pengajuan yang menunggu Approval atau sudah disetujui.",
            );
          if (input.action === "approve") {
            const attendance = await tx.attendanceRecord.findMany({ where: { companyId, employeeId: doc.employeeId, date: { gte: doc.fromDate, lte: doc.toDate }, status: { not: "LEAVE" } }, select: { date: true } });
            if (attendance.some(row => ![0, 6].includes(row.date.getUTCDay()))) throw new ConflictException("Periode cuti bertentangan dengan Attendance yang sudah tercatat.");
          }
          if (input.action === "submit")
            Object.assign(data, {
              submittedAt: new Date(),
              employeeCode: employee.code,
              employeeName: employee.name,
              branchName: employee.branch.record.name,
              departmentName: employee.department.record.name,
            });
        }
        data.status =
          input.action === "submit"
            ? "PENDING"
            : input.action === "approve"
              ? "APPROVED"
              : input.action === "reject"
                ? "REJECTED"
                : "CANCELLED";
        if (input.action === "approve" || input.action === "reject")
          Object.assign(data, {
            reviewedAt: new Date(),
            reviewer: { connect: { id: actorId } },
            note: input.note,
          });
        const row = await tx.leaveRequest.update({
          where: { companyId_id: { companyId, id } },
          data,
          include: leaveInclude,
        });
        const after = serializeLeave(row);
        await hrAudit(
          tx,
          companyId,
          actorId,
          "leaveRequests",
          id,
          input.action.toUpperCase(),
          { before: serializeLeave(doc), after },
        );
        return after;
      },
      { isolationLevel: "Serializable" },
    );
  }
}
