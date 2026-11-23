import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { createDemoData, demoCompanies } from "@erp/shared/demo";
import { companySchema, type MasterKind } from "@erp/shared";
import { baseInput, saveDomain } from "../src/master-data/domain-records";
const prisma = new PrismaClient();
async function seed() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Seed demo tidak diizinkan di production");
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12)
    throw new Error("Atur DEMO_PASSWORD minimal 12 karakter untuk development");
  const passwordHash = await hash(password, 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@enterprise.local" },
    create: {
      email: "admin@enterprise.local",
      name: "Aditya Pratama",
      passwordHash,
    },
    update: { passwordHash, sessionVersion: { increment: 1 }, mustChangePassword: false },
  });
  const viewer = await prisma.user.upsert({
    where: { email: "viewer@enterprise.local" },
    create: {
      email: "viewer@enterprise.local",
      name: "Dina Maharani",
      passwordHash,
    },
    update: { passwordHash, sessionVersion: { increment: 1 }, mustChangePassword: false },
  });
  const data = createDemoData();
  await prisma.$transaction(
    async (tx) => {
      for (const company of demoCompanies) {
        const { role } = company;
        const values = companySchema.parse(company);
        await tx.company.upsert({
          where: { id: company.id },
          create: { ...values, id: company.id },
          update: {},
        });
        await tx.membership.upsert({
          where: {
            userId_companyId: { userId: admin.id, companyId: company.id },
          },
          create: { userId: admin.id, companyId: company.id, role },
          update: { role },
        });
      }
      await tx.membership.upsert({
        where: { userId_companyId: { userId: viewer.id, companyId: "alpha" } },
        create: { userId: viewer.id, companyId: "alpha", role: "VIEWER" },
        update: { role: "VIEWER" },
      });
      for (const [kind, records] of Object.entries(data.records))
        for (const record of records) {
          const values = {
            ...baseInput(record),
            id: record.id,
            companyId: record.companyId,
            kind: kind as keyof typeof data.records,
            createdAt: new Date(record.createdAt),
          };
          await tx.masterRecord.upsert({
            where: { id: record.id },
            create: values,
            update: {},
          });
          await saveDomain(
            tx,
            record.companyId,
            kind as MasterKind,
            record.id,
            record,
            true,
          );
        }
      for (const document of data.transactions) {
        const values = { ...document, date: new Date(document.date) };
        await tx.document.upsert({
          where: { id: document.id },
          create: values,
          update: {},
        });
      }
    },
    { timeout: 30000 },
  );
  console.log(
    "Seed selesai: 3 company, 2 User, master data, dan snapshot dokumen demo.",
  );
}
seed().finally(() => prisma.$disconnect());
