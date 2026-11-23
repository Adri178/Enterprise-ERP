import "reflect-metadata";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { rfqToday } from "@erp/shared";
import { ProcurementService } from "../apps/api/dist/procurement/procurement.service.js";
import { RfqService } from "../apps/api/dist/procurement/rfq.service.js";
config({ path: new URL("../apps/api/.env", import.meta.url), quiet: true });
if (process.env.NODE_ENV === "production") throw new Error("Development seed only");
const prisma = new PrismaClient(), procurement = new ProcurementService(prisma), rfqs = new RfqService(prisma);
let created = 0;
try {
  const actor = await prisma.user.findUniqueOrThrow({ where: { email: "admin@enterprise.local" } }), date = rfqToday(), end = new Date(`${date}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 30); const deadline = end.toISOString().slice(0, 10);
  for (const [companyId, prefix] of [["alpha", "a8"], ["beta", "b8"]]) {
    const member = await prisma.membership.findUnique({ where: { userId_companyId: { userId: actor.id, companyId } }, include: { company: true } });
    if (!member?.active || !actor.active || actor.mustChangePassword || !["ADMIN", "MANAGER"].includes(member.role) || member.company.status !== "ACTIVE") continue;
    const requestKey = `${prefix}202626-1103-4ee0-b234-000000000001`, rfqKey = `${prefix}202626-1103-4ee0-b234-000000000002`;
    if (await prisma.rfq.findUnique({ where: { companyId_requestKey: { companyId, requestKey: rfqKey } } }) || await prisma.purchaseDocument.findUnique({ where: { companyId_requestKey: { companyId, requestKey } } })) continue;
    const suppliers = await prisma.supplier.findMany({ where: { companyId, record: { status: "ACTIVE" } }, orderBy: { id: "asc" }, take: 2 });
    const warehouse = await prisma.warehouse.findFirst({ where: { companyId, record: { status: "ACTIVE" } }, orderBy: { id: "asc" } });
    const items = await prisma.item.findMany({ where: { companyId, trackStock: true, record: { status: "ACTIVE" } }, orderBy: { id: "asc" }, take: 2 });
    if (suppliers.length !== 2 || !warehouse || !items.length) continue;
    const prices = items.map(item => Math.min(1e10, Math.max(1, item.purchasePrice.toNumber() || 100000)));
    let source = await procurement.createRequest(companyId, actor.id, { requestKey, date, supplierId: suppliers[0].id, warehouseId: warehouse.id, description: "Kebutuhan Stock untuk contoh RFQ development", lines: items.map((item, index) => ({ itemId: item.id, quantity: index + 2, unitPrice: prices[index] })) });
    for (const action of ["submit", "approve"]) source = await procurement.action(companyId, actor.id, source.id, { action, expectedUpdatedAt: source.updatedAt });
    let row = await rfqs.create(companyId, actor.id, { requestKey: rfqKey, sourceId: source.id, date, deadline, supplierIds: suppliers.map(value => value.id), description: "Perbandingan Supplier development; penawaran dicatat manual dan tidak dikirim melalui email." });
    row = await rfqs.action(companyId, actor.id, row.id, { action: "open", expectedUpdatedAt: row.updatedAt });
    for (let index = 0; index < suppliers.length; index++) {
      await rfqs.offer(companyId, actor.id, row.id, { expectedUpdatedAt: row.updatedAt, supplierId: suppliers[index].id, reference: `DEMO-QT-${member.company.code}-${index + 1}`, date, validUntil: deadline, deliveryDays: index ? 3 : 7, description: "Penawaran fiktif untuk development", lines: items.map((item, line) => ({ itemId: item.id, unitPrice: Math.round(prices[line] * (index ? 0.97 : 0.95) * 100) / 100 })) });
      row = await rfqs.detail(companyId, row.id);
    }
    if (companyId === "alpha") await rfqs.action(companyId, actor.id, row.id, { action: "propose", expectedUpdatedAt: row.updatedAt, offerId: row.offers.find(offer => offer.supplierId === suppliers[1].id).id, reason: "Pengiriman tiga hari lebih sesuai kebutuhan operasional; harga masih di bawah estimasi." });
    created++;
  }
  console.log(`RFQ seed complete: ${created} sourcing examples created; existing documents, reviews and Company Roles preserved.`);
} finally { await prisma.$disconnect(); }
