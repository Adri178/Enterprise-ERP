import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rfqToday } from "@erp/shared";

export async function createRfqFixture(json, suffix = "A") {
  const marker = `RQ${randomUUID().slice(0, 7).toUpperCase()}${suffix}`;
  const company = await json("/companies", "POST", { code: marker, name: `QA RFQ ${marker}`, industry: "Pengujian", city: "Jakarta", currency: "IDR", status: "ACTIVE", address: "", email: "", phone: "", taxId: "" }, 201);
  // Register the Company immediately, so callers can clean up partial preparation.
  return { company, async prepare() {
    const master = (kind, code, extra = {}) => json(`/companies/${company.id}/master/${kind}`, "POST", { code, name: `QA RFQ ${code} ${marker}`, category: "Operasional", status: "ACTIVE", email: "", phone: "", description: "", ...extra }, 201);
    const suppliers = [await master("suppliers", "SUP-1"), await master("suppliers", "SUP-2"), await master("suppliers", "SUP-3")];
    const branch = await master("branches", "BR", { city: "Jakarta" });
    const warehouse = await master("warehouses", "WH", { branchId: branch.id }), items = [await master("items", "ITEM-1", { unit: "pcs", trackStock: true, purchasePrice: 100, sellingPrice: 150 }), await master("items", "ITEM-2", { unit: "pcs", trackStock: true, purchasePrice: 100, sellingPrice: 150 })];
    const path = `/companies/${company.id}/procurement`, date = rfqToday();
    async function request(requestDate = date) {
      let row = await json(`${path}/requests`, "POST", { requestKey: randomUUID(), date: requestDate, supplierId: suppliers[0].id, warehouseId: warehouse.id, description: "QA RFQ requirement", lines: items.map((item, index) => ({ itemId: item.id, quantity: index + 2, unitPrice: 100 })) }, 201);
      for (const action of ["submit", "approve"]) row = await json(`${path}/${row.id}/actions`, "POST", { action, expectedUpdatedAt: row.updatedAt }, 201);
      return row;
    }
    return { company, suppliers, warehouse, items, date, path, request, source: await request() };
  } };
}
export async function cleanupRfqFixture(prisma, company) {
  const stored = await prisma.company.findUnique({ where: { id: company.id } });
  assert.equal(stored?.code, company.code);
  assert.ok(/^RQ[A-F0-9]{7}[A-Z]$/.test(stored.code) && stored.name.startsWith("QA RFQ "), "Only disposable RFQ Companies may be removed");
  await prisma.$transaction(async tx => {
    await tx.stockLedger.deleteMany({ where: { companyId: company.id } }); await tx.stockBalance.deleteMany({ where: { companyId: company.id } });
    for (const kind of ["PAYMENT", "PURCHASE_INVOICE", "PURCHASE_RECEIPT", "PURCHASE_ORDER"]) {
      const docs = await tx.purchaseDocument.findMany({ where: { companyId: company.id, kind }, select: { id: true } });
      await tx.purchaseLine.deleteMany({ where: { companyId: company.id, documentId: { in: docs.map(row => row.id) } } });
      await tx.purchaseDocument.deleteMany({ where: { companyId: company.id, kind } });
    }
    // Internal RFQ FKs are deferred: all children and the selected-offer cycle disappear atomically.
    await tx.rfq.deleteMany({ where: { companyId: company.id } });
    await tx.rfqOfferLine.deleteMany({ where: { companyId: company.id } }); await tx.rfqOffer.deleteMany({ where: { companyId: company.id } }); await tx.rfqSupplier.deleteMany({ where: { companyId: company.id } });
    await tx.purchaseLine.deleteMany({ where: { companyId: company.id } }); await tx.purchaseDocument.deleteMany({ where: { companyId: company.id } });
    await tx.documentSequence.deleteMany({ where: { companyId: company.id } }); await tx.auditLog.deleteMany({ where: { companyId: company.id } });
    await tx.masterRecord.deleteMany({ where: { companyId: company.id, kind: "warehouses" } });
    await tx.masterRecord.deleteMany({ where: { companyId: company.id } }); await tx.membership.deleteMany({ where: { companyId: company.id } }); await tx.company.delete({ where: { id: company.id } });
  }, { timeout: 20000 });
}
