import { test } from "node:test";
import assert from "node:assert/strict";
import {
  quotationSchema,
  salesActionSchema,
  salesFromSourceSchema,
  nextSalesKind,
} from "../src/sales";
test("Sales validates scoped references, positive integral quantities, price precision and allowed stages", () => {
  const input = {
    requestKey: "5a1e4567-1234-4678-9234-123456789012",
    customerId: "customer",
    warehouseId: "warehouse",
    date: "2026-10-21",
    description: "",
    lines: [{ itemId: "item", quantity: 2, unitPrice: 1000.25 }],
  };
  assert.equal(quotationSchema.safeParse(input).success, true);
  assert.equal(
    quotationSchema.safeParse({ ...input, customerId: "" }).success,
    false,
  );
  assert.equal(
    quotationSchema.safeParse({
      ...input,
      lines: [{ itemId: "item", quantity: -1, unitPrice: 1 }],
    }).success,
    false,
  );
  assert.equal(
    quotationSchema.safeParse({
      ...input,
      lines: [...input.lines, ...input.lines],
    }).success,
    false,
  );
  assert.equal(
    salesActionSchema.safeParse({
      action: "approve",
      expectedUpdatedAt: new Date().toISOString(),
    }).success,
    false,
  );
  assert.equal(
    salesFromSourceSchema.safeParse({
      requestKey: input.requestKey,
      sourceId: "source",
      kind: "QUOTATION",
      date: input.date,
    }).success,
    false,
  );
  assert.equal(nextSalesKind.SALES_ORDER, "DELIVERY_NOTE");
  assert.equal(nextSalesKind.SALES_INVOICE, "PAYMENT");
  assert.equal(nextSalesKind.PAYMENT, undefined);
});
