import { test } from "node:test";
import assert from "node:assert/strict";
import { stockOperationSchema } from "../src/inventory";
const transfer = {
  requestKey: "2d3cb238-63ef-49f6-8238-fcfd9fd45905",
  kind: "TRANSFER",
  date: "2026-10-21",
  warehouseId: "source",
  targetWarehouseId: "target",
  description: "Pemindahan Stock",
  lines: [{ itemId: "one", quantity: 2, unitPrice: 0 }],
};
test("Transfer requires distinct Warehouses, positive quantity and server-valued cost", () => {
  assert.equal(stockOperationSchema.safeParse(transfer).success, true);
  for (const patch of [
    { targetWarehouseId: "source" },
    { lines: [{ itemId: "one", quantity: -1, unitPrice: 0 }] },
    { lines: [{ itemId: "one", quantity: 1, unitPrice: 10 }] },
    { lines: [...transfer.lines, ...transfer.lines] },
  ])
    assert.equal(
      stockOperationSchema.safeParse({ ...transfer, ...patch }).success,
      false,
    );
});
test("Adjustment requires a reason, signed nonzero quantity, and price only for additions", () => {
  const adjustment = {
    ...transfer,
    kind: "ADJUSTMENT",
    targetWarehouseId: "",
    lines: [{ itemId: "one", quantity: -2, unitPrice: 0 }],
  };
  assert.equal(stockOperationSchema.safeParse(adjustment).success, true);
  for (const patch of [
    { description: "" },
    { lines: [{ itemId: "one", quantity: 0, unitPrice: 0 }] },
    { lines: [{ itemId: "one", quantity: 1, unitPrice: 0 }] },
    { lines: [{ itemId: "one", quantity: 1.5, unitPrice: 1 }] },
  ])
    assert.equal(
      stockOperationSchema.safeParse({ ...adjustment, ...patch }).success,
      false,
    );
  assert.equal(
    stockOperationSchema.safeParse({
      ...adjustment,
      lines: [{ itemId: "one", quantity: 1, unitPrice: 0.01 }],
    }).success,
    true,
  );
});
