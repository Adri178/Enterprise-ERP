import { test } from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { LedgerService } from "../src/accounting/ledger.service";
import type { PrismaService } from "../src/prisma/prisma.module";
test("Accounting exports reject oversized ledgers and charts before reading result rows", async () => {
  for (const kind of ["ledger", "trial"] as const) {
    let reads = 0;
    const tx = {
      account: { findFirst: async () => ({ id: "cash" }) },
      $queryRaw: async () => {
        reads++;
        if (kind === "ledger" && reads === 1) return [{ opening: new Prisma.Decimal(0) }];
        return [{ count: 10001n }];
      },
    } as unknown as Prisma.TransactionClient;
    const prisma = { $transaction: (callback: (client: Prisma.TransactionClient) => Promise<unknown>) => callback(tx) } as unknown as PrismaService;
    await assert.rejects(() => new LedgerService(prisma)[kind]("company", { accountId: "cash", from: "2026-10-01", to: "2026-10-31" }, true), (error: unknown) => error instanceof BadRequestException && /10\.000/.test(error.message));
    assert.equal(reads, kind === "ledger" ? 2 : 1, "Reject rather than fetching a silently truncated result");
  }
});
