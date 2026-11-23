import { test } from "node:test";
import assert from "node:assert/strict";
import { rfqActionSchema, rfqCreateSchema, rfqOfferSchema, rfqOrderSchema, rfqToday } from "../src/rfq";
const date = rfqToday(), version = new Date().toISOString(), key = "ABCDEF01-0000-4000-8000-000000000001";
test("RFQ requires comparable distinct Suppliers and normalizes create retries without accepting identity overrides", () => {
  const input = { requestKey: key, sourceId: "pr-1", date, deadline: date, supplierIds: ["supplier-b", "supplier-a"], description: " Kebutuhan Stock " };
  assert.deepEqual(rfqCreateSchema.parse(input), { ...input, requestKey: key.toLowerCase(), supplierIds: ["supplier-a", "supplier-b"], description: "Kebutuhan Stock" });
  for (const patch of [{ supplierIds: ["supplier-a"] }, { supplierIds: ["supplier-a", "supplier-a"] }, { deadline: "2020-01-01" }, { companyId: "other" }, { status: "APPROVED" }]) assert.equal(rfqCreateSchema.safeParse({ ...input, ...patch }).success, false);
});
test("Supplier quotations require complete dated pricing inputs with positive two-decimal amounts", () => {
  const input = { expectedUpdatedAt: version, supplierId: "supplier-a", reference: " QT-1 ", date, validUntil: "2099-12-31", deliveryDays: 0, lines: [{ itemId: "item-a", unitPrice: 125.25 }] };
  assert.equal(rfqOfferSchema.parse(input).reference, "QT-1");
  for (const patch of [{ date: "9999-12-31" }, { validUntil: "2020-01-01" }, { reference: " " }, { deliveryDays: -1 }, { currency: "USD" }, { lines: [] }, { lines: [{ itemId: "item-a", unitPrice: 0 }] }, { lines: [{ itemId: "item-a", unitPrice: 1.001 }] }, { lines: [{ itemId: "item-a", unitPrice: 1, quantity: 2 }] }, { lines: [...input.lines, ...input.lines] }]) assert.equal(rfqOfferSchema.safeParse({ ...input, ...patch }).success, false);
});
test("RFQ selection/review requires a version and reason while Order generation cannot override award terms", () => {
  assert.ok(rfqActionSchema.safeParse({ action: "propose", expectedUpdatedAt: version, offerId: "offer-a", reason: "Pengiriman lebih cepat" }).success);
  for (const action of ["approve", "reject", "cancel"]) {
    assert.ok(rfqActionSchema.safeParse({ action, expectedUpdatedAt: version, reason: "Sudah ditinjau" }).success);
    assert.equal(rfqActionSchema.safeParse({ action, expectedUpdatedAt: version, reason: "x" }).success, false);
    assert.equal(rfqActionSchema.safeParse({ action, reason: "Sudah ditinjau" }).success, false);
  }
  const order = { requestKey: key, expectedUpdatedAt: version, date };
  assert.equal(rfqOrderSchema.parse(order).requestKey, key.toLowerCase());
  for (const patch of [{ supplierId: "supplier-b" }, { amount: 1 }, { companyId: "other" }, { lines: [] }]) assert.equal(rfqOrderSchema.safeParse({ ...order, ...patch }).success, false);
});
