import { test } from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ReportsService } from "../src/reports/reports.service";
import type { PrismaService } from "../src/prisma/prisma.module";

test("oversized report export fails explicitly before fetching the register", async () => {
  let reads = 0;
  const tx = {
    $queryRaw: async () => {
      reads++;
      return [
        {
          count: 10001n,
          amount: new Prisma.Decimal(10001),
          settled: new Prisma.Decimal(0),
          outstanding: new Prisma.Decimal(10001),
        },
      ];
    },
  } as unknown as Prisma.TransactionClient;
  const prisma = {
    $transaction: (
      callback: (client: Prisma.TransactionClient) => Promise<unknown>,
    ) => callback(tx),
  } as unknown as PrismaService;
  await assert.rejects(
    () =>
      new ReportsService(prisma).export("company", {
        from: "2026-01-01",
        to: "2026-01-31",
      }),
    (error: unknown) =>
      error instanceof BadRequestException && /10\.000/.test(error.message),
  );
  assert.equal(
    reads,
    1,
    "An oversized export is rejected without fetching or silently truncating rows",
  );
});
