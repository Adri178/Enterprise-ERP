import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { companySchema, versionSchema } from "@erp/shared";
import { PrismaService } from "../prisma/prisma.module";
import { validate } from "../common/validation";
import { requireCompanyWrite } from "../auth/write-access";
@Injectable()
export class CompaniesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async create(actorId: string, body: unknown) {
    const values = validate(companySchema, body);
    return this.prisma.$transaction(async (tx) => {
      if (!(await tx.membership.findFirst({ where: { userId: actorId, role: "ADMIN", active: true, user: { active: true, mustChangePassword: false } } }))) throw new ForbiddenException("Hanya Administrator Company yang dapat menambahkan Company.");
      const company = await tx.company.create({ data: values });
      await tx.membership.create({
        data: { companyId: company.id, userId: actorId, role: "ADMIN" },
      });
      await tx.auditLog.create({
        data: {
          companyId: company.id,
          actorId,
          entity: "companies",
          entityId: company.id,
          action: "CREATE",
          changes: values,
        },
      });
      return { ...company, role: "ADMIN" as const, currencyLocked: false };
    }, { isolationLevel: "Serializable" });
  }
  async update(companyId: string, actorId: string, body: unknown) {
    const values = validate(companySchema, body);
    const { expectedUpdatedAt } = validate(versionSchema, body);
    return this.prisma.$transaction(
      async (tx) => {
        await requireCompanyWrite(tx, companyId, actorId, ["ADMIN"], true);
        const before = await tx.company.findUniqueOrThrow({
          where: { id: companyId },
        });
        if (
          expectedUpdatedAt &&
          before.updatedAt.toISOString() !== expectedUpdatedAt
        )
          throw new ConflictException(
            "Profil Company telah berubah. Muat ulang sebelum menyimpan.",
          );
        if (values.code !== before.code)
          throw new ConflictException(
            "Kode Company tidak dapat diubah setelah Company dibuat.",
          );
        const currencyLocked =
          (await tx.accountingPolicy.count({ where: { companyId } })) > 0 ||
          (await tx.workOrder.count({ where: { companyId } })) > 0 ||
          (await tx.journal.count({ where: { companyId } })) > 0 ||
          (await tx.salesDocument.count({ where: { companyId } })) > 0 ||
          (await tx.stockOperation.count({ where: { companyId } })) > 0 ||
          (await tx.purchaseDocument.count({ where: { companyId } })) > 0 ||
          (await tx.document.count({ where: { companyId } })) > 0 ||
          (await tx.item.count({
            where: {
              companyId,
              OR: [{ purchasePrice: { gt: 0 } }, { sellingPrice: { gt: 0 } }],
            },
          })) > 0;
        if (values.currency !== before.currency && currencyLocked)
          throw new ConflictException(
            "Mata uang tidak dapat diubah karena Company sudah memiliki dokumen atau Items bernilai.",
          );
        const company = await tx.company.update({
          where: { id: companyId },
          data: values,
        });
        await tx.auditLog.create({
          data: {
            companyId,
            actorId,
            entity: "companies",
            entityId: companyId,
            action:
              before.status !== values.status && values.status === "INACTIVE"
                ? "ARCHIVE"
                : "UPDATE",
            changes: JSON.parse(
              JSON.stringify({ before, after: company }),
            ) as Prisma.InputJsonValue,
          },
        });
        return { ...company, role: "ADMIN" as const, currencyLocked };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async archive(companyId: string, actorId: string) {
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
    });
    if (company.status !== "INACTIVE")
      await this.update(companyId, actorId, { ...company, status: "INACTIVE" });
  }
}
