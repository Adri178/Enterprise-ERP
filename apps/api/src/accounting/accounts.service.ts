import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { accountSchema, accountQuerySchema, accountingVersionSchema } from "@erp/shared";
import { validate } from "../common/validation";
import { PrismaService } from "../prisma/prisma.module";
import { accountingAccess, accountingAudit, accountInclude, serializeAccount } from "./accounting-common";
@Injectable()
export class AccountsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async list(companyId: string, body: unknown) {
    const q = validate(accountQuerySchema, body);
    const where: Prisma.AccountWhereInput = { companyId, ...(q.status !== "ALL" ? { status: q.status } : {}), ...(q.type !== "ALL" ? { type: q.type } : {}), ...(q.node !== "ALL" ? { isGroup: q.node === "GROUP" } : {}), ...(q.q ? { OR: [{ code: { contains: q.q, mode: "insensitive" } }, { name: { contains: q.q, mode: "insensitive" } }] } : {}) };
    return this.prisma.$transaction(async (tx) => {
      const total = await tx.account.count({ where }), pageCount = Math.max(1, Math.ceil(total / q.pageSize)), page = Math.min(q.page, pageCount);
      const rows = await tx.account.findMany({ where, include: accountInclude, orderBy: [{ code: q.direction }, { id: "asc" }], skip: (page - 1) * q.pageSize, take: q.pageSize });
      return { data: rows.map(serializeAccount), meta: { total, page, pageSize: q.pageSize, pageCount } };
    }, { isolationLevel: "RepeatableRead" });
  }
  async save(companyId: string, actorId: string, body: unknown, id?: string) {
    const input = validate(accountSchema, body), version = id ? validate(accountingVersionSchema, body).expectedUpdatedAt : undefined;
    return this.prisma.$transaction(async (tx) => {
      await accountingAccess(tx, companyId, actorId);
      const before = id ? await tx.account.findFirst({ where: { companyId, id }, include: accountInclude }) : null;
      if (id && !before) throw new NotFoundException("Account tidak ditemukan");
      if (before && before.updatedAt.toISOString() !== version) throw new ConflictException("Data telah berubah. Muat ulang sebelum menyimpan perubahan.");
      if (before && (before.code !== input.code || before.type !== input.type || before.isGroup !== input.isGroup || (before.parentId || "") !== input.parentId)) throw new ConflictException("Kode, tipe, grup, dan parent Account tetap setelah dibuat. Buat Account baru untuk struktur berbeda.");
      if (!before && input.parentId) {
        const parent = await tx.account.findFirst({ where: { companyId, id: input.parentId, type: input.type, isGroup: true, status: "ACTIVE" } });
        if (!parent) throw new BadRequestException("Pilih Account grup aktif dengan tipe yang sama dari company ini.");
      }
      if (before && input.status === "ACTIVE" && before.status === "INACTIVE" && before.parentId && !(await tx.account.findFirst({ where: { companyId, id: before.parentId, status: "ACTIVE" } }))) throw new ConflictException("Aktifkan parent Account terlebih dahulu.");
      if (before && input.status === "INACTIVE" && await tx.account.count({ where: { companyId, parentId: id, status: "ACTIVE" } })) throw new ConflictException("Nonaktifkan seluruh Account anak terlebih dahulu.");
      if (before && input.status === "INACTIVE" && await tx.accountingMapping.count({ where: { companyId, accountId: id } })) throw new ConflictException("Account digunakan dalam mapping Accounting otomatis dan tidak dapat dinonaktifkan.");
      const data = { ...input, parentId: input.parentId || null, ...(before ? { updatedAt: new Date(Math.max(Date.now(), before.updatedAt.getTime() + 1)) } : {}) };
      const row = before ? await tx.account.update({ where: { companyId_id: { companyId, id: before.id } }, data, include: accountInclude }) : await tx.account.create({ data: { ...data, companyId }, include: accountInclude });
      const after = serializeAccount(row);
      await accountingAudit(tx, companyId, actorId, "accounts", row.id, before ? "UPDATE" : "CREATE", { before: before ? serializeAccount(before) : null, after });
      return after;
    }, { isolationLevel: "Serializable" });
  }
}
