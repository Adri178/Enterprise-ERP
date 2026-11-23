import { test } from "node:test";
import assert from "node:assert/strict";
import { money, exactMoney } from "../src/lib/utils";
test("company currency formatting preserves monetary fractions and Indonesian separators", () => {
  assert.match(money(1000, "IDR"), /1\.000/);
  assert.ok(!money(1000, "IDR").includes(",00"));
  assert.match(money(1000.25, "IDR"), /1\.000,25/);
  assert.match(money(1000.5, "USD"), /1\.000,50/);
  assert.match(money(1000, "SGD"), /1\.000,00/);
});

test("ledger formatting preserves decimal strings beyond Number precision and negative fractions", () => {
  assert.match(exactMoney("9007199254740993.29", "IDR"), /9\.007\.199\.254\.740\.993,29/);
  assert.match(exactMoney("-0.05", "IDR"), /-.*0,05/);
  assert.match(exactMoney("-123456789012345678.99", "USD"), /-.*123\.456\.789\.012\.345\.678,99/);
  assert.match(exactMoney("0.00", "IDR"), /0,00/);
});
