import "reflect-metadata";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { MasterDataService } from "../apps/api/dist/master-data/master-data.module.js";
import { BomsService } from "../apps/api/dist/manufacturing/boms.service.js";
import { WorkOrdersService } from "../apps/api/dist/manufacturing/work-orders.service.js";
import { StockOperationsService } from "../apps/api/dist/procurement/stock-operations.service.js";
config({ path: new URL("../apps/api/.env", import.meta.url), quiet: true });
if (process.env.NODE_ENV === "production") throw new Error("Development seed only");
const prisma = new PrismaClient(), masters = new MasterDataService(prisma), boms = new BomsService(prisma), orders = new WorkOrdersService(prisma), stock = new StockOperationsService(prisma);
try {
  const actor = await prisma.user.findUniqueOrThrow({ where: { email: "admin@enterprise.local" } });
  for (const companyId of ["alpha", "beta"]) {
    const member = await prisma.membership.findUnique({ where: { userId_companyId: { userId: actor.id, companyId } }, include: { company: true } });
    if (!actor.active || !member || !["ADMIN", "MANAGER"].includes(member.role) || member.company.status !== "ACTIVE") continue;
    const warehouse = await prisma.warehouse.findFirst({ where: { companyId, record: { status: "ACTIVE" } }, orderBy: { id: "asc" } }); if (!warehouse) continue;
    const chart = [];
    for (const [code, name] of [["MFG-COMP-A", companyId === "alpha" ? "Keyboard Demo" : "Rangka Panel Demo"], ["MFG-COMP-B", companyId === "alpha" ? "Mouse Demo" : "Modul Kontrol Demo"], ["MFG-KIT", companyId === "alpha" ? "Paket Perangkat Kantor Demo" : "Panel Kontrol Demo"]]) {
      let record = await prisma.masterRecord.findUnique({ where: { companyId_kind_code: { companyId, kind: "items", code } }, include: { item: true } });
      if (!record) { await masters.save(companyId, "items", actor.id, { code, name, category: "Manufacturing", email: "", phone: "", description: "Fixture pengembangan Manufacturing", status: "ACTIVE", unit: "pcs", barcode: "", purchasePrice: 0, sellingPrice: 0, trackStock: true, reorderLevel: 0 }); record = await prisma.masterRecord.findUniqueOrThrow({ where: { companyId_kind_code: { companyId, kind: "items", code } }, include: { item: true } }); }
      chart.push(record);
    }
    if (!chart.every((r) => r.status === "ACTIVE" && r.item?.trackStock)) continue;
    const [a, b, output] = chart;
    let bom = await prisma.billOfMaterials.findUnique({ where: { companyId_code: { companyId, code: "MFG-BOM-001" } }, include: { lines: true } });
    if (!bom) { bom = await boms.save(companyId, actor.id, { code: "MFG-BOM-001", name: companyId === "alpha" ? "Paket Perangkat Kantor" : "Panel Kontrol", description: "Fixture pengembangan: assembly satu tingkat, tanpa overhead atau WIP.", outputItemId: output.id, outputQuantity: 1, lines: [{ itemId: a.id, quantity: 2 }, { itemId: b.id, quantity: 1 }] }); bom = await boms.action(companyId, actor.id, bom.id, { action: "activate", expectedUpdatedAt: bom.updatedAt }); }
    if (bom.status !== "ACTIVE" || bom.outputItemId !== output.id || bom.outputQuantity !== 1 || bom.lines.length !== 2 || !bom.lines.some((l) => l.itemId === a.id && l.quantity === 2) || !bom.lines.some((l) => l.itemId === b.id && l.quantity === 1)) continue;
    if (companyId === "alpha" && member.role === "ADMIN") {
      const requestKey = "aa202626-1021-4ee0-b234-000000000070";
      const laterMovement = await prisma.stockLedger.count({ where: { companyId, warehouseId: warehouse.id, itemId: { in: [a.id, b.id, output.id] }, date: { gt: new Date("2026-10-21") } } });
      if (!laterMovement && !(await prisma.stockOperation.findUnique({ where: { companyId_requestKey: { companyId, requestKey } } }))) {
        const receipt = await stock.create(companyId, actor.id, { requestKey, kind: "ADJUSTMENT", date: "2026-10-21", warehouseId: warehouse.id, targetWarehouseId: "", description: "Fixture pengembangan: bahan baku Manufacturing awal.", lines: [{ itemId: a.id, quantity: 20, unitPrice: 125000 }, { itemId: b.id, quantity: 10, unitPrice: 300000 }] });
        await stock.action(companyId, actor.id, receipt.id, { action: "post", expectedUpdatedAt: new Date(receipt.updatedAt).toISOString() });
      }
      const completedKey = "aa202626-1021-4ee0-b234-000000000071", balances = await prisma.stockBalance.findMany({ where: { companyId, warehouseId: warehouse.id, itemId: { in: [a.id, b.id] } } });
      if (!laterMovement && !(await prisma.workOrder.findUnique({ where: { companyId_requestKey: { companyId, requestKey: completedKey } } })) && (balances.find((r) => r.itemId === a.id)?.quantity || 0) >= 4 && (balances.find((r) => r.itemId === b.id)?.quantity || 0) >= 2) {
        const draft = await orders.create(companyId, actor.id, { requestKey: completedKey, date: "2026-10-21", bomId: bom.id, batches: 2, warehouseId: warehouse.id, description: "Fixture pengembangan: produksi selesai melalui Stock Ledger." });
        const released = await orders.action(companyId, actor.id, draft.id, { action: "release", expectedUpdatedAt: draft.updatedAt });
        await orders.action(companyId, actor.id, draft.id, { action: "complete", expectedUpdatedAt: released.updatedAt, postingDate: "2026-10-21" });
      }
    }
    const requestKey = `${companyId === "alpha" ? "aa" : "bb"}202626-1021-4ee0-b234-000000000072`;
    if (!(await prisma.workOrder.findUnique({ where: { companyId_requestKey: { companyId, requestKey } } }))) {
      const draft = await orders.create(companyId, actor.id, { requestKey, date: "2026-10-22", bomId: bom.id, batches: companyId === "alpha" ? 10 : 3, warehouseId: warehouse.id, description: "Fixture pengembangan: kebutuhan produksi terbuka, tanpa reservasi Stock." });
      await orders.action(companyId, actor.id, draft.id, { action: "release", expectedUpdatedAt: draft.updatedAt });
    }
  }
  console.log("Development Manufacturing fixtures ready; existing Items, BOMs, Work Orders and Stock documents preserved. Beta shortage is intentional; its MANAGER cannot post Stock Adjustment.");
} finally { await prisma.$disconnect(); }
