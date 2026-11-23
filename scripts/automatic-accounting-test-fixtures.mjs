import assert from "node:assert/strict";
import { accountingPurposes, purposeAccountTypes } from "@erp/shared";
export async function automaticChart(json, root) {
  const groups = {}, mappings = {}, accounts = {};
  for (const type of ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]) groups[type] = await json(root + "/accounting/accounts", "POST", { code: `G-${type}`, name: `QA ${type}`, type, isGroup: true, parentId: "", status: "ACTIVE" }, 201);
  for (const purpose of accountingPurposes) { const type = purposeAccountTypes[purpose]; const row = await json(root + "/accounting/accounts", "POST", { code: `A-${purpose.replaceAll('_','-')}`, name: `QA ${purpose}`, type, isGroup: false, parentId: groups[type].id, status: "ACTIVE" }, 201); mappings[purpose] = row.id; accounts[purpose] = row; }
  return { mappings, accounts, groups };
}
export async function cleanAutomaticCompany(prisma, company) {
  if (!company) return;
  await prisma.$transaction(async (tx) => {
    assert.equal((await tx.company.findUnique({ where: { id: company.id } }))?.code, company.code);
    const where = { companyId: company.id };
    await tx.accountingMapping.deleteMany({ where }); await tx.accountingPolicy.deleteMany({ where }); await tx.operationalPosting.deleteMany({ where });
    await tx.journalLine.deleteMany({ where }); await tx.journal.deleteMany({ where });
    await tx.stockLedger.deleteMany({ where }); await tx.stockBalance.deleteMany({ where });
    await tx.workOrderLine.deleteMany({ where }); await tx.workOrder.deleteMany({ where }); await tx.bomLine.deleteMany({ where }); await tx.billOfMaterials.deleteMany({ where });
    await tx.purchaseLine.deleteMany({ where }); await tx.purchaseDocument.deleteMany({ where }); await tx.salesLine.deleteMany({ where }); await tx.salesDocument.deleteMany({ where });
    await tx.stockOperationLine.deleteMany({ where }); await tx.stockOperation.deleteMany({ where });
    await tx.account.deleteMany({ where }); await tx.auditLog.deleteMany({ where }); await tx.documentSequence.deleteMany({ where }); await tx.masterRecord.deleteMany({ where }); await tx.membership.deleteMany({ where }); await tx.company.delete({ where: { id: company.id } });
  }, { timeout: 15000 });
}
