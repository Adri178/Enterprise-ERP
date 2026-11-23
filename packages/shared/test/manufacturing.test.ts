import { test } from "node:test";
import assert from "node:assert/strict";
import { bomSchema, workOrderSchema, workOrderActionSchema, productionPlanQuerySchema } from "../src/manufacturing";
const bom = { code: "bom-01", name: "Panel Demo", outputItemId: "output", outputQuantity: 1, description: "", lines: [{ itemId: "material", quantity: 2 }] };
test("BOM validates distinct materials, excludes its own output, and permits bounded whole batch quantities", () => {
  assert.equal(bomSchema.parse(bom).code, "BOM-01");
  for (const value of [{ ...bom, lines: [] }, { ...bom, lines: [...bom.lines, ...bom.lines] }, { ...bom, outputItemId: "material" }, { ...bom, outputQuantity: 0 }, { ...bom, outputQuantity: 1.5 }, { ...bom, lines: [{ itemId: "material", quantity: 1000001 }] }]) assert.equal(bomSchema.safeParse(value).success, false);
});
test("Work Order validates UUID, planning dates, whole batches, versioned actions and mandatory completion dates", () => {
  const order = { requestKey: "aa202626-1021-4ee0-b234-000000000001", bomId: "bom", batches: 2, warehouseId: "warehouse", date: "2026-10-21", description: "" };
  assert.equal(workOrderSchema.safeParse(order).success, true);
  for (const value of [{ ...order, batches: 0 }, { ...order, batches: 0.5 }, { ...order, date: "0000-01-01" }, { ...order, bomId: "" }, { ...order, requestKey: "retry" }]) assert.equal(workOrderSchema.safeParse(value).success, false);
  const action = { action: "complete", expectedUpdatedAt: "2026-10-21T00:00:00.000Z" };
  assert.equal(workOrderActionSchema.safeParse(action).success, false);
  assert.equal(workOrderActionSchema.safeParse({ ...action, postingDate: "2026-10-22" }).success, true);
  assert.equal(workOrderActionSchema.safeParse({ action: "release" }).success, false);
  assert.equal(productionPlanQuerySchema.safeParse({ from: "2026-10-01", to: "2026-09-30" }).success, false);
  assert.equal(productionPlanQuerySchema.safeParse({ from: "2026-01-01", to: "2027-01-02" }).success, false);
  assert.equal(productionPlanQuerySchema.safeParse({ from: "2026-10-01", to: "2026-10-31", pageSize: 101 }).success, false);
});
