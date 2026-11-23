import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { isTransactionConflict } from "../src/common/transaction-conflict";
test("raw PostgreSQL serialization/deadlock errors are retryable conflicts without masking constraint or audit failures", () => {
  const failure = (code: string, sqlState?: string) => new Prisma.PrismaClientKnownRequestError("Database failure", { code, clientVersion: "6.19.0", meta: sqlState ? { code: sqlState } : undefined });
  for (const error of [failure("P2034"), failure("P2010", "40001"), failure("P2010", "40P01")]) assert.equal(isTransactionConflict(error), true);
  for (const error of [failure("P2010", "23514"), failure("P2010", "P0001"), failure("P2010"), failure("P2002"), new Error("40001"), { code: "P2034" }, null]) assert.equal(isTransactionConflict(error), false);
});
