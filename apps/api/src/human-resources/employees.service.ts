import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  employeeSchema,
  employeeQuerySchema,
  hrVersionSchema,
} from "@erp/shared";
import { PrismaService } from "../prisma/prisma.module";
import { validate } from "../common/validation";
import {
  employeeInclude,
  serializeEmployee,
  hrAccess,
  hrAudit,
} from "./hr-common";

@Injectable()
export class EmployeesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async list(companyId: string, body: unknown) {
    const query = validate(employeeQuerySchema, body);
    const where: Prisma.EmployeeWhereInput = {
      companyId,
      ...(query.status === "ALL" ? {} : { status: query.status }),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.q
        ? {
            OR: ["code", "name", "email", "jobTitle"].map((field) => ({
              [field]: { contains: query.q, mode: "insensitive" },
            })),
          }
        : {}),
    };
    return this.prisma.$transaction(
      async (tx) => {
        const total = await tx.employee.count({ where }),
          pageCount = Math.max(1, Math.ceil(total / query.pageSize)),
          page = Math.min(query.page, pageCount);
        const data = await tx.employee.findMany({
          where,
          include: employeeInclude,
          orderBy: [{ [query.sort]: query.direction }, { id: "asc" }],
          skip: (page - 1) * query.pageSize,
          take: query.pageSize,
        });
        return {
          data: data.map(serializeEmployee),
          meta: { total, page, pageSize: query.pageSize, pageCount },
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async detail(companyId: string, id: string) {
    const row = await this.prisma.employee.findFirst({
      where: { companyId, id },
      include: employeeInclude,
    });
    if (!row) throw new NotFoundException("Employee tidak ditemukan");
    return serializeEmployee(row);
  }
  async save(companyId: string, actorId: string, body: unknown, id?: string) {
    const input = validate(employeeSchema, body);
    const version = id
      ? validate(hrVersionSchema, body).expectedUpdatedAt
      : undefined;
    return this.prisma.$transaction(
      async (tx) => {
        await hrAccess(tx, companyId, actorId);
        const before = id
          ? await tx.employee.findFirst({
              where: { companyId, id },
              include: employeeInclude,
            })
          : null;
        if (id && !before)
          throw new NotFoundException("Employee tidak ditemukan");
        if (before && before.updatedAt.toISOString() !== version)
          throw new ConflictException(
            "Data telah berubah. Muat ulang sebelum menyimpan perubahan.",
          );
        if (before && before.code !== input.code)
          throw new ConflictException(
            "Kode Employee tidak dapat diubah setelah dibuat.",
          );
        const department = await tx.department.findFirst({
          where: {
            companyId,
            id: input.departmentId,
            branchId: input.branchId,
          },
          include: { record: true, branch: { include: { record: true } } },
        });
        const unchanged =
          before?.departmentId === input.departmentId &&
          before.branchId === input.branchId;
        if (
          !department ||
          !department.branch ||
          ((input.status === "ACTIVE" || !unchanged) &&
            (department.record.status !== "ACTIVE" ||
              department.branch.record.status !== "ACTIVE"))
        )
          throw new BadRequestException(
            "Pilih Branch dan Department aktif yang saling terhubung dari company yang sama.",
          );
        if (before) {
          if (await tx.attendanceRecord.count({ where: { companyId, employeeId: id, OR: [{ date: { lt: new Date(input.startDate) } }, ...(input.endDate ? [{ date: { gt: new Date(input.endDate) } }] : [])] } }))
            throw new ConflictException("Tanggal masa kerja harus mencakup seluruh riwayat Attendance Employee.");
          if (
            await tx.leaveRequest.count({
              where: {
                companyId,
                employeeId: id,
                status: { in: ["DRAFT", "PENDING", "APPROVED"] },
                OR: [
                  { fromDate: { lt: new Date(input.startDate) } },
                  ...(input.endDate
                    ? [{ toDate: { gt: new Date(input.endDate) } }]
                    : []),
                ],
              },
            })
          )
            throw new ConflictException(
              "Tanggal masa kerja harus mencakup Leave Request yang masih berlaku. Batalkan draft atau selesaikan pengajuan terkait terlebih dahulu.",
            );
          if (
            (input.status === "INACTIVE" || !unchanged) &&
            (await tx.leaveRequest.count({
              where: { companyId, employeeId: id, status: "PENDING" },
            }))
          )
            throw new ConflictException(
              "Selesaikan atau batalkan Leave Request yang menunggu Approval sebelum menonaktifkan atau memindahkan Employee.",
            );
        }
        const data = {
          ...input,
          startDate: new Date(input.startDate),
          endDate: input.endDate ? new Date(input.endDate) : null,
          ...(before
            ? {
                updatedAt: new Date(
                  Math.max(Date.now(), before.updatedAt.getTime() + 1),
                ),
              }
            : {}),
        };
        const row = before
          ? await tx.employee.update({
              where: { companyId_id: { companyId, id: before.id } },
              data,
              include: employeeInclude,
            })
          : await tx.employee.create({
              data: { ...data, companyId },
              include: employeeInclude,
            });
        const after = serializeEmployee(row);
        await hrAudit(
          tx,
          companyId,
          actorId,
          "employees",
          row.id,
          before ? "UPDATE" : "CREATE",
          { before: before ? serializeEmployee(before) : null, after },
        );
        return after;
      },
      { isolationLevel: "Serializable" },
    );
  }
  async summary(companyId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const statuses = await tx.employee.groupBy({
          by: ["status"],
          where: { companyId },
          _count: true,
        });
        const groups = await tx.employee.groupBy({
          by: ["branchId"],
          where: { companyId, status: "ACTIVE" },
          _count: true,
        });
        const branches = await tx.branch.findMany({
          where: { companyId, id: { in: groups.map((g) => g.branchId) } },
          include: { record: { select: { name: true } } },
          orderBy: { id: "asc" },
        });
        const active = statuses.find((s) => s.status === "ACTIVE")?._count || 0,
          inactive = statuses.find((s) => s.status === "INACTIVE")?._count || 0;
        return {
          total: active + inactive,
          active,
          inactive,
          pending: await tx.leaveRequest.count({
            where: { companyId, status: "PENDING" },
          }),
          branches: branches.map((b) => ({
            id: b.id,
            name: b.record.name,
            active: groups.find((g) => g.branchId === b.id)!._count,
          })),
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
}
