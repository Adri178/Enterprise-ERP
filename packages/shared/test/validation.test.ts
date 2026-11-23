import { test } from "node:test";
import assert from "node:assert/strict";
import { canWrite, draftSchema, masterSchema } from "../src/index";
test("master data rejects empty names, unsafe codes, and invalid emails", () => {
  const base = {
    code: "SUP-001",
    name: "PT Sumber Makmur",
    category: "Distributor",
    status: "ACTIVE",
    email: "",
  };
  assert.ok(masterSchema.safeParse(base).success);
  assert.equal(masterSchema.safeParse({ ...base, name: " " }).success, false);
  assert.equal(
    masterSchema.safeParse({ ...base, code: "=cmd" }).success,
    false,
  );
  assert.equal(
    masterSchema.safeParse({ ...base, email: "not-an-email" }).success,
    false,
  );
});
test("draft validation rejects invalid amounts and dates", () => {
  const base = {
    party: "PT Sumber Makmur",
    amount: 100000,
    date: "2026-10-21",
    description: "",
  };
  assert.ok(draftSchema.safeParse(base).success);
  assert.equal(draftSchema.safeParse({ ...base, amount: -1 }).success, false);
  assert.equal(
    draftSchema.safeParse({ ...base, date: "2026-02-31" }).success,
    false,
  );
});
test("Viewer cannot write master records", () => {
  assert.equal(canWrite("VIEWER"), false);
  assert.equal(canWrite("MANAGER"), true);
  assert.equal(canWrite("ADMIN"), true);
});
