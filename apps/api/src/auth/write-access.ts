import { ConflictException, ForbiddenException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Role } from "@erp/shared";
export async function requireCompanyWrite(tx: Prisma.TransactionClient, companyId: string, actorId: string, roles: Role[] = ["ADMIN", "MANAGER"], allowInactive = false) {
  const member = await tx.membership.findUnique({ where: { userId_companyId: { companyId, userId: actorId } }, include: { company: true, user: { select: { active: true, mustChangePassword: true } } } });
  if (!member?.active || !member.user.active || member.user.mustChangePassword || !roles.includes(member.role)) throw new ForbiddenException("Role Anda tidak memiliki izin untuk aksi ini");
  if (!allowInactive && member.company.status !== "ACTIVE") throw new ConflictException("Company tidak aktif. Aktifkan Company sebelum mengubah data.");
  return member;
}
