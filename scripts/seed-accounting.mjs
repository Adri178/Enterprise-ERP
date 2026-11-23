import "reflect-metadata";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { AccountsService } from "../apps/api/dist/accounting/accounts.service.js";
import { JournalsService } from "../apps/api/dist/accounting/journals.service.js";
config({ path: new URL("../apps/api/.env", import.meta.url), quiet: true });
if (process.env.NODE_ENV === "production") throw new Error("Development seed only");
const prisma = new PrismaClient(), accounts = new AccountsService(prisma), journals = new JournalsService(prisma);
try {
  const actor = await prisma.user.findUniqueOrThrow({ where: { email: "admin@enterprise.local" } });
  for (const companyId of ["alpha", "beta"]) {
    const member = await prisma.membership.findUnique({ where: { userId_companyId: { userId: actor.id, companyId } }, include: { company: true } });
    if (!actor.active || !member || !["ADMIN", "MANAGER"].includes(member.role) || member.company.status !== "ACTIVE") continue;
    const chart = new Map();
    for (const [code, name, type, parentCode] of [
      ["10", "Aset", "ASSET", ""], ["20", "Liabilitas", "LIABILITY", ""], ["30", "Ekuitas", "EQUITY", ""], ["40", "Pendapatan", "INCOME", ""], ["50", "Beban", "EXPENSE", ""],
      ["1100", "Kas", "ASSET", "10"], ["1200", "Bank", "ASSET", "10"], ["2100", "Utang Usaha", "LIABILITY", "20"], ["3100", "Modal", "EQUITY", "30"], ["4100", "Pendapatan Usaha", "INCOME", "40"], ["5100", "Beban Operasional", "EXPENSE", "50"],
    ]) {
      let account = await prisma.account.findUnique({ where: { companyId_code: { companyId, code } } });
      const parent = chart.get(parentCode);
      if (!account && (!parentCode || parent?.status === "ACTIVE" && parent.isGroup && parent.type === type)) account = await accounts.save(companyId, actor.id, { code, name, type, isGroup: !parentCode, parentId: parent?.id || "", status: "ACTIVE" });
      if (account) chart.set(code, account);
    }
    const fixtures = [{ requestKey: `${companyId === "alpha" ? "aa" : "bb"}202626-1021-4ee0-b234-000000000010`, date: "2026-10-01", description: "Fixture pengembangan: modal awal manual, terpisah dari Invoice dan Payment.", debit: "1100", credit: "3100", amount: companyId === "alpha" ? 1500000.25 : 900000.5 }];
    if (companyId === "alpha") fixtures.push({ requestKey: "aa202626-1021-4ee0-b234-000000000011", date: "2026-10-05", description: "Fixture pengembangan: beban operasional manual.", debit: "5100", credit: "1100", amount: 150000.1 });
    for (const fixture of fixtures) {
      if (await prisma.journal.findUnique({ where: { companyId_requestKey: { companyId, requestKey: fixture.requestKey } } })) continue;
      const debit = chart.get(fixture.debit), credit = chart.get(fixture.credit);
      if (![debit, credit].every((a) => a && !a.isGroup && a.status === "ACTIVE")) continue;
      const row = await journals.save(companyId, actor.id, { requestKey: fixture.requestKey, date: fixture.date, description: fixture.description, reference: "DEV-MANUAL", lines: [{ accountId: debit.id, debit: fixture.amount, credit: 0, description: "" }, { accountId: credit.id, debit: 0, credit: fixture.amount, description: "" }] });
      await journals.action(companyId, actor.id, row.id, { action: "post", expectedUpdatedAt: row.updatedAt });
    }
  }
  console.log("Development manual Accounting fixtures ready; existing chart and Journals preserved.");
} finally { await prisma.$disconnect(); }
