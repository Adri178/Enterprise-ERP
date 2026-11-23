import { test } from "node:test";
import assert from "node:assert/strict";
import {
  purchaseRequestSchema,
  allowedPurchaseActions,
  purchaseActionSchema,
} from "../src/procurement";
const input = {
  requestKey: "cd9b3b5e-2454-4b26-9001-aa5566d53490",
  supplierId: "supplier",
  warehouseId: "warehouse",
  date: "2026-10-21",
  lines: [{ itemId: "item", quantity: 3, unitPrice: 1000.25 }],
};
test("Procurement rejects duplicate Items, fractional quantity, excess precision and unbounded documents", () => {
  assert.equal(purchaseRequestSchema.parse(input).lines[0].unitPrice, 1000.25);
  assert.equal(
    purchaseRequestSchema.safeParse({
      ...input,
      lines: [...input.lines, ...input.lines],
    }).success,
    false,
  );
  for (const line of [
    { quantity: 1.5, unitPrice: 1 },
    { quantity: 1, unitPrice: 1.001 },
    { quantity: 0, unitPrice: 1 },
    { quantity: 1, unitPrice: 0 },
  ])
    assert.equal(
      purchaseRequestSchema.safeParse({
        ...input,
        lines: [{ itemId: "item", ...line }],
      }).success,
      false,
    );
  assert.equal(
    purchaseRequestSchema.safeParse({ ...input, requestKey: "untrusted-key" })
      .success,
    false,
  );
  assert.equal(
    purchaseActionSchema.safeParse({ action: "post" }).success,
    false,
  );
  assert.equal(
    purchaseRequestSchema.safeParse({
      ...input,
      lines: [{ itemId: "item", quantity: 1000000, unitPrice: 10000000000 }],
    }).success,
    false,
  );
});
test("Approval precedes conversion and posted documents have no mutation actions", () => {
  assert.deepEqual(allowedPurchaseActions("PURCHASE_REQUEST", "DRAFT"), [
    "submit",
    "cancel",
  ]);
  assert.deepEqual(allowedPurchaseActions("PURCHASE_REQUEST", "PENDING"), [
    "approve",
    "reject",
    "cancel",
  ]);
  assert.deepEqual(allowedPurchaseActions("PURCHASE_RECEIPT", "DRAFT"), [
    "post",
    "cancel",
  ]);
  for (const status of ["POSTED", "REJECTED", "CANCELLED", "APPROVED"] as const)
    assert.deepEqual(allowedPurchaseActions("PURCHASE_REQUEST", status), []);
});
