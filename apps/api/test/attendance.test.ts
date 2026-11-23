import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { AttendanceService } from "../src/human-resources/attendance.service";
import { PrismaService } from "../src/prisma/prisma.module";
test("Attendance export rejects oversized selections before reading records", async () => {
  let read = false;
  const prisma = { $transaction: async (run: (tx: unknown) => Promise<unknown>) => run({ attendanceRecord: { count: async () => 10001, findMany: async () => { read = true; return []; } } }) } as unknown as PrismaService;
  await assert.rejects(() => new AttendanceService(prisma).export("company", { period: "2026-11" }), /10.000/);
  assert.equal(read, false);
});
