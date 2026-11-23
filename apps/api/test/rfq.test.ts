import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { RfqService } from "../src/procurement/rfq.service";
import { PrismaService } from "../src/prisma/prisma.module";
test("RFQ export rejects more than ten thousand matches before loading quotation details", async () => {
  let read = false;
  const prisma = { $transaction: async (run: (tx: unknown) => Promise<unknown>) => run({ rfq: { count: async () => 10001, findMany: async () => { read = true; return []; } } }) } as unknown as PrismaService;
  await assert.rejects(() => new RfqService(prisma).export("company", {}), /10.000/);
  assert.equal(read, false);
});
