import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { SalesService } from "../apps/api/dist/sales/sales.service.js";
import { ProcurementService } from "../apps/api/dist/procurement/procurement.service.js";
import { StockOperationsService } from "../apps/api/dist/procurement/stock-operations.service.js";

// Disposable test data only. Workflow documents use the same services as REST mutations.
export async function createReportFixture(prisma, code, salesCount = 13) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Development verification only");
  const actor = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@enterprise.local" },
  });
  const company = await prisma.company.create({
    data: {
      code,
      name: `QA Reports ${code}`,
      industry: "Pengujian",
      city: "Jakarta",
      memberships: { create: { userId: actor.id, role: "ADMIN" } },
    },
  });
  const companyId = company.id;
  try {
    const master = (kind, code, profile, data) =>
      prisma.masterRecord.create({
        data: {
          companyId,
          kind,
          code,
          name: code === "CUS" ? "QA Customer 100%_" : `QA ${code}`,
          category: "Pengujian",
          [profile]: { create: data },
        },
      });
    const branch = await master("branches", "BR", "branch", {
      city: "Jakarta",
    });
    const warehouse = await master("warehouses", "WH", "warehouse", {
      branchId: branch.id,
    });
    const customer = await master("customers", "CUS", "customer", {
      creditLimit: 0,
    });
    const supplier = await master("suppliers", "SUP", "supplier", {
      paymentTermsDays: 30,
    });
    const item = await master("items", "ITM", "item", {
      unit: "pcs",
      trackStock: true,
      purchasePrice: 25,
      sellingPrice: 100.25,
    });
    const sales = new SalesService(prisma),
      purchases = new ProcurementService(prisma),
      stock = new StockOperationsService(prisma);
    const action = (service, doc, verb) =>
      service.action(companyId, actor.id, doc.id, {
        action: verb,
        expectedUpdatedAt: new Date(doc.updatedAt).toISOString(),
      });
    const initial = await stock.create(companyId, actor.id, {
      requestKey: randomUUID(),
      kind: "ADJUSTMENT",
      date: "2025-12-30",
      warehouseId: warehouse.id,
      targetWarehouseId: "",
      description: "Stock awal QA Reports",
      lines: [{ itemId: item.id, quantity: 100, unitPrice: 25 }],
    });
    await action(stock, initial, "post");
    async function sale(date, amount, postInvoice = true) {
      let doc = await sales.create(companyId, actor.id, {
        requestKey: randomUUID(),
        date,
        customerId: customer.id,
        warehouseId: warehouse.id,
        description: "QA laporan",
        lines: [{ itemId: item.id, quantity: 1, unitPrice: amount }],
      });
      doc = await action(sales, doc, "post");
      for (const kind of ["SALES_ORDER", "DELIVERY_NOTE", "SALES_INVOICE"]) {
        doc = await sales.fromSource(companyId, actor.id, {
          requestKey: randomUUID(),
          sourceId: doc.id,
          kind,
          date,
          description: "",
        });
        if (kind !== "SALES_INVOICE" || postInvoice)
          doc = await action(sales, doc, "post");
      }
      return doc;
    }
    async function payment(service, source, date, post = true) {
      const input = {
        requestKey: randomUUID(),
        sourceId: source.id,
        kind: "PAYMENT",
        date,
        description: "",
      };
      const doc =
        service === sales
          ? await sales.fromSource(companyId, actor.id, input)
          : await purchases.createFromSource(companyId, actor.id, input);
      return post ? action(service, doc, "post") : doc;
    }
    await sale("2025-12-31", 77);
    const invoices = [];
    for (let i = 1; i <= salesCount; i++)
      invoices.push(
        await sale(`2026-01-${String(i).padStart(2, "0")}`, 100.25 * i),
      );
    await payment(sales, invoices[0], "2026-01-31");
    if (invoices[1]) await payment(sales, invoices[1], "2026-02-01");
    if (invoices[2]) await payment(sales, invoices[2], "2026-01-31", false);
    const cancelled = await sale("2026-01-20", 999, false);
    await action(sales, cancelled, "cancel");
    await sale("2026-01-21", 888, false);
    await sale("2026-02-01", 333);
    async function purchase(date, amount) {
      let doc = await purchases.createRequest(companyId, actor.id, {
        requestKey: randomUUID(),
        date,
        supplierId: supplier.id,
        warehouseId: warehouse.id,
        description: "QA laporan",
        lines: [{ itemId: item.id, quantity: 1, unitPrice: amount }],
      });
      for (const verb of ["submit", "approve"])
        doc = await action(purchases, doc, verb);
      for (const kind of [
        "PURCHASE_ORDER",
        "PURCHASE_RECEIPT",
        "PURCHASE_INVOICE",
      ]) {
        doc = await purchases.createFromSource(companyId, actor.id, {
          requestKey: randomUUID(),
          sourceId: doc.id,
          kind,
          date,
          description: "",
        });
        doc = await action(purchases, doc, "post");
      }
      return doc;
    }
    // Receipts follow all Delivery dates because backdated Stock posting is intentionally prohibited.
    const purchaseInvoice = await purchase("2026-02-02", 555.55);
    await payment(purchases, purchaseInvoice, "2026-03-01");
    await purchase("2026-02-03", 222.22);
    const expectedAmount = (100.25 * salesCount * (salesCount + 1)) / 2;
    return {
      companyId,
      actorId: actor.id,
      customerId: customer.id,
      firstInvoice: invoices[0].id,
      invoices: invoices.map((d) => d.number),
      salesCount,
      expectedAmount,
    };
  } catch (error) {
    await cleanupReportFixture(prisma, companyId, code);
    throw error;
  }
}

export async function cleanupReportFixture(prisma, companyId, code) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (company?.code !== code || !code.startsWith("QR"))
    throw new Error("Refusing to clean unrelated Company");
  await prisma.$transaction(async (tx) => {
    await tx.stockLedger.deleteMany({ where: { companyId } });
    await tx.stockBalance.deleteMany({ where: { companyId } });
    await tx.salesLine.deleteMany({ where: { companyId } });
    for (const kind of [
      "PAYMENT",
      "SALES_INVOICE",
      "DELIVERY_NOTE",
      "SALES_ORDER",
      "QUOTATION",
    ])
      await tx.salesDocument.deleteMany({ where: { companyId, kind } });
    await tx.purchaseLine.deleteMany({ where: { companyId } });
    for (const kind of [
      "PAYMENT",
      "PURCHASE_INVOICE",
      "PURCHASE_RECEIPT",
      "PURCHASE_ORDER",
      "PURCHASE_REQUEST",
    ])
      await tx.purchaseDocument.deleteMany({ where: { companyId, kind } });
    await tx.stockOperationLine.deleteMany({ where: { companyId } });
    await tx.stockOperation.deleteMany({ where: { companyId } });
    await tx.documentSequence.deleteMany({ where: { companyId } });
    await tx.masterRecord.deleteMany({
      where: { companyId, kind: "warehouses" },
    });
    await tx.masterRecord.deleteMany({ where: { companyId } });
    await tx.auditLog.deleteMany({ where: { companyId } });
    await tx.membership.deleteMany({ where: { companyId } });
    await tx.company.delete({ where: { id: companyId } });
  });
}
