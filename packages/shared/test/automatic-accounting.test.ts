import { test } from "node:test";
import assert from "node:assert/strict";
import { activateAccountingSchema, accountingPurposes, purposeAccountTypes, controlPurposes } from "../src/automatic-accounting";
test("Accounting activation requires complete, distinct scoped mapping references and an explicit snapshot/date/reason", () => {
  const body = { requestKey: "ac202626-1022-4ee0-b234-000000000001", snapshotKey: "a".repeat(64), effectiveFrom: "2026-10-22", reason: "Tinjauan saldo awal", mappings: Object.fromEntries(accountingPurposes.map((p) => [p, p])) };
  assert.equal(activateAccountingSchema.safeParse(body).success, true);
  for (const change of [{ mappings: { ...body.mappings, CASH: "INVENTORY" } }, { mappings: { ...body.mappings, GRNI: "" } }, { mappings: {} }, { snapshotKey: "old" }, { effectiveFrom: "2026-02-30" }, { reason: "" }, { requestKey: "invalid" }]) assert.equal(activateAccountingSchema.safeParse({ ...body, ...change }).success, false);
  assert.equal("companyId" in activateAccountingSchema.parse({ ...body, companyId: "ignored" }), false);
});
test("Control purposes separate inventory/interim/party balances from cash, income and expense mappings", () => {
  assert.deepEqual(controlPurposes, ["INVENTORY", "GRNI", "PAYABLE", "RECEIVABLE"]);
  assert.equal(purposeAccountTypes.GRNI, "LIABILITY"); assert.equal(purposeAccountTypes.COGS, "EXPENSE"); assert.equal(purposeAccountTypes.OPENING_EQUITY, "EQUITY");
});
