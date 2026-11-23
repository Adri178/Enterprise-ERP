import { Prisma, type PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { z } from "zod";
import { companySchema, securePasswordSchema } from "@erp/shared";

export const installationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  initialPassword: securePasswordSchema,
  companies: z.array(companySchema).min(1).max(20),
}).strict().superRefine((value, context) => {
  if (new Set(value.companies.map((company) => company.code)).size !== value.companies.length) {
    context.addIssue({ code: "custom", path: ["companies"], message: "Kode Company harus berbeda" });
  }
});

export class InstallationExistsError extends Error {
  constructor() {
    super("Instalasi sudah memiliki User atau Company. Setup tidak mengubah akun atau data yang sudah ada.");
    this.name = "InstallationExistsError";
  }
}

/** Private CLI operation only. Never registered as a public HTTP endpoint. */
export async function bootstrapInstallation(prisma: PrismaClient, body: unknown) {
  const input = installationSchema.parse(body);
  const passwordHash = await hash(input.initialPassword, 12);
  return prisma.$transaction(async (tx) => {
    // Read Committed takes a fresh snapshot after a concurrent installer releases the lock.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(771603, 1)`;
    if (await tx.user.count() || await tx.company.count()) throw new InstallationExistsError();
    const user = await tx.user.create({ data: {
      email: input.email, name: input.name, passwordHash,
      active: true, mustChangePassword: true,
    } });
    const companies: { id: string; code: string; name: string }[] = [];
    for (const company of input.companies) {
      const saved = await tx.company.create({ data: company });
      await tx.membership.create({ data: {
        // CLI bootstrap has no HTTP grant request; its actor is retained in AuditLog.
        userId: user.id, companyId: saved.id, role: "ADMIN", active: true,
      } });
      await tx.auditLog.create({ data: {
        companyId: saved.id, actorId: user.id, entity: "companies", entityId: saved.id,
        action: "CREATE", changes: { reason: "Setup instalasi awal", after: company },
      } });
      await tx.auditLog.create({ data: {
        companyId: saved.id, actorId: user.id, entity: "memberships", entityId: user.id,
        action: "GRANT", changes: {
          reason: "Setup instalasi awal", before: null, userCreated: true,
          after: { userId: user.id, name: user.name, email: user.email, role: "ADMIN", active: true },
        },
      } });
      companies.push({ id: saved.id, code: saved.code, name: saved.name });
    }
    await tx.userSecurityEvent.create({ data: { userId: user.id, action: "ACCOUNT_CREATED" } });
    return { userId: user.id, email: user.email, companies };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 });
}
