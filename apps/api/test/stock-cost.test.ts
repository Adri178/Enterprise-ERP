import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { outgoingStockCost } from "../src/procurement/stock-posting";
test("outgoing valuation preserves rounding remainder when the final units leave", () => {
  const first = outgoingStockCost(
    { quantity: 4, value: new Prisma.Decimal("30.05") },
    1,
  );
  assert.equal(first.unitPrice.toString(), "7.5125");
  assert.equal(first.value.toString(), "7.51");
  const final = outgoingStockCost(
    { quantity: 3, value: new Prisma.Decimal("22.54") },
    3,
  );
  assert.equal(final.value.toString(), "22.54");
  assert.throws(() =>
    outgoingStockCost({ quantity: 1, value: new Prisma.Decimal(1) }, 2),
  );
  assert.throws(() => outgoingStockCost(null, 1));
});
