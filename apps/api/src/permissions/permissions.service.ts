import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { createHmac } from "node:crypto";
import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { grantCompanyUserSchema, editCompanyUserSchema, companyUsersQuerySchema, accessAuditQuerySchema, type CompanyMemberSnapshot } from "@erp/shared";
import { PrismaService } from "../prisma/prisma.module";
import { requireCompanyWrite } from "../auth/write-access";
import { validate } from "../common/validation";
const include = { user: { select: { name: true, email: true, active: true, mustChangePassword: true } } } satisfies Prisma.MembershipInclude;
type Member = Prisma.MembershipGetPayload<{ include: typeof include }>;
function serialize(row: Member) { return { userId: row.userId, companyId: row.companyId, name: row.user.name, email: row.user.email, role: row.role, active: row.active, userActive: row.user.active, mustChangePassword: row.user.mustChangePassword, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }; }
function snapshot(row: Member): CompanyMemberSnapshot { return { userId: row.userId, name: row.user.name, email: row.user.email, role: row.role, active: row.active }; }
function paging(total: number, requested: number, pageSize: number) { const pageCount = Math.max(1, Math.ceil(total / pageSize)); return { total, page: Math.min(requested, pageCount), pageSize, pageCount }; }
@Injectable()
export class PermissionsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private async lock(tx: Prisma.TransactionClient, companyId: string, actorId: string) {
    await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${companyId} FOR UPDATE`;
    await requireCompanyWrite(tx, companyId, actorId, ["ADMIN"]);
  }
  async list(companyId: string, actorId: string, body: unknown) {
    const q = validate(companyUsersQuerySchema, body);
    const where: Prisma.MembershipWhereInput = { companyId, ...(q.role !== "ALL" ? { role: q.role } : {}), ...(q.status !== "ALL" ? { active: q.status === "ACTIVE" } : {}), ...(q.q ? { user: { OR: [{ name: { contains: q.q, mode: "insensitive" } }, { email: { contains: q.q, mode: "insensitive" } }] } } : {}) };
    return this.prisma.$transaction(async (tx) => {
      await requireCompanyWrite(tx, companyId, actorId, ["ADMIN"], true);
      const meta = paging(await tx.membership.count({ where }), q.page, q.pageSize), order: Prisma.MembershipOrderByWithRelationInput = q.sort === "name" || q.sort === "email" ? { user: { [q.sort]: q.direction } } : { [q.sort]: q.direction };
      const data = await tx.membership.findMany({ where, include, orderBy: [order, { userId: "asc" }], take: meta.pageSize, skip: (meta.page - 1) * meta.pageSize });
      const activeAdmins = await tx.membership.count({ where: { companyId, active: true, role: "ADMIN", user: { active: true, mustChangePassword: false } } });
      return { data: data.map(serialize), meta, activeAdmins };
    }, { isolationLevel: "RepeatableRead" });
  }
  async grant(companyId: string, actorId: string, body: unknown) {
    const input = validate(grantCompanyUserSchema, body);
    // Keyed digest protects the initial secret from a fast offline dictionary check.
    if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required");
    const requestHash = createHmac("sha256", process.env.JWT_SECRET).update(JSON.stringify(input)).digest("hex");
    const passwordHash = input.mode === "NEW" ? await hash(input.initialPassword, 12) : undefined;
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, companyId, actorId);
      const retry = await tx.membership.findUnique({ where: { companyId_requestKey: { companyId, requestKey: input.requestKey } }, include });
      if (retry) { if (retry.createdBy !== actorId || retry.requestHash !== requestHash) throw new ConflictException("Kunci permintaan sudah digunakan dengan data berbeda"); return serialize(retry); }
      let user = await tx.user.findUnique({ where: { email: input.email } });
      if (input.mode === "NEW") {
        if (user) throw new ConflictException("Email sudah terdaftar. Gunakan pilihan User yang sudah ada.");
        user = await tx.user.create({ data: { email: input.email, name: input.name, passwordHash: passwordHash!, mustChangePassword: true } });
        await tx.userSecurityEvent.create({ data: { userId: user.id, action: "ACCOUNT_CREATED" } });
      } else if (!user) throw new NotFoundException("User dengan email tersebut tidak ditemukan");
      if (!user!.active) throw new ConflictException("Akun User tidak aktif pada tingkat aplikasi. Akses company tidak dapat mengaktifkan akun tersebut.");
      if (await tx.membership.findUnique({ where: { userId_companyId: { companyId, userId: user!.id } } })) throw new ConflictException("User sudah memiliki catatan akses pada company ini. Gunakan Edit untuk mengubah atau mengaktifkan aksesnya.");
      const row = await tx.membership.create({ data: { companyId, userId: user!.id, role: input.role, requestKey: input.requestKey, requestHash, createdBy: actorId }, include });
      await tx.auditLog.create({ data: { companyId, actorId, entity: "memberships", entityId: row.userId, action: "GRANT", changes: JSON.parse(JSON.stringify({ before: null, after: snapshot(row), reason: input.reason, userCreated: input.mode === "NEW" })) as Prisma.InputJsonValue } });
      return serialize(row);
    }, { isolationLevel: "Serializable", timeout: 10000 });
  }
  async edit(companyId: string, actorId: string, userId: string, body: unknown) {
    const input = validate(editCompanyUserSchema, body);
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, companyId, actorId);
      const row = await tx.membership.findUnique({ where: { userId_companyId: { companyId, userId } }, include });
      if (!row) throw new NotFoundException("Akses User tidak ditemukan pada company ini");
      if (row.updatedAt.toISOString() !== input.expectedUpdatedAt) throw new ConflictException("Akses telah berubah. Muat ulang sebelum menyimpan.");
      if (userId === actorId) throw new ConflictException("Perubahan akses sendiri harus dilakukan oleh ADMIN lain.");
      if (row.role === input.role && row.active === input.active) throw new ConflictException("Tidak ada perubahan akses untuk disimpan.");
      if (input.active && !row.user.active) throw new ConflictException("Akun User tidak aktif pada tingkat aplikasi.");
      if (row.role === "ADMIN" && row.active && (input.role !== "ADMIN" || !input.active) && !(await tx.membership.count({ where: { companyId, userId: { not: userId }, role: "ADMIN", active: true, user: { active: true, mustChangePassword: false } } }))) throw new ConflictException("Company harus tetap memiliki minimal satu ADMIN aktif yang dapat masuk.");
      const saved = await tx.membership.update({ where: { userId_companyId: { companyId, userId } }, data: { role: input.role, active: input.active, updatedAt: new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1)) }, include });
      await tx.auditLog.create({ data: { companyId, actorId, entity: "memberships", entityId: userId, action: "UPDATE", changes: JSON.parse(JSON.stringify({ before: snapshot(row), after: snapshot(saved), reason: input.reason })) as Prisma.InputJsonValue } });
      return serialize(saved);
    }, { isolationLevel: "Serializable" });
  }
  async audit(companyId: string, actorId: string, body: unknown) {
    const q = validate(accessAuditQuerySchema, body);
    return this.prisma.$transaction(async (tx) => {
      await requireCompanyWrite(tx, companyId, actorId, ["ADMIN"], true);
      if (q.userId && !(await tx.membership.findUnique({ where: { userId_companyId: { companyId, userId: q.userId } } }))) throw new NotFoundException("Akses User tidak ditemukan pada company ini");
      const where: Prisma.AuditLogWhereInput = { companyId, entity: "memberships", action: q.action === "ALL" ? { in: ["GRANT", "UPDATE"] } : q.action, ...(q.userId ? { entityId: q.userId } : {}), createdAt: { gte: new Date(`${q.from}T00:00:00+07:00`), lte: new Date(`${q.to}T23:59:59.999+07:00`) } };
      const meta = paging(await tx.auditLog.count({ where }), q.page, q.pageSize), rows = await tx.auditLog.findMany({ where, include: { actor: { select: { name: true } } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: meta.pageSize, skip: (meta.page - 1) * meta.pageSize });
      return { data: rows.map((r) => { const c = r.changes as unknown as { reason: string; before: CompanyMemberSnapshot | null; after: CompanyMemberSnapshot }; return { id: r.id, userId: r.entityId, action: r.action, actorName: r.actor.name, createdAt: r.createdAt.toISOString(), reason: c.reason, before: c.before, after: c.after }; }), meta };
    }, { isolationLevel: "RepeatableRead" });
  }
}
