import assert from "node:assert/strict";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import {
  createReportFixture,
  cleanupReportFixture,
} from "./report-fixtures.mjs";
config({ path: new URL("../apps/api/.env", import.meta.url), quiet: true });
if (process.env.NODE_ENV === "production")
  throw new Error("Development verification only");
const prisma = new PrismaClient(),
  base = process.env.TEST_API_URL || "http://127.0.0.1:4010/api";
const code = `QR${Date.now().toString(36).toUpperCase()}`;
let fixture;
async function login(email) {
  const r = await fetch(base + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: process.env.DEMO_PASSWORD }),
  });
  assert.equal(r.status, 201);
  return r.headers.get("set-cookie").split(";")[0];
}
try {
  const cookie = await login("admin@enterprise.local"),
    viewer = await login("viewer@enterprise.local");
  fixture = await createReportFixture(prisma, code);
  const root = `/companies/${fixture.companyId}/reports/invoices`;
  const query = { from: "2026-01-01", to: "2026-01-31", domain: "sales" };
  async function request(
    extra = {},
    { session = cookie, path = root, status = 200 } = {},
  ) {
    const r = await fetch(
      `${base}${path}?${new URLSearchParams({ ...query, ...extra })}`,
      { headers: { Cookie: session } },
    );
    const data = await r.json();
    assert.equal(r.status, status, JSON.stringify(data));
    return data;
  }
  const report = await request();
  assert.deepEqual(report.summary, {
    count: 13,
    amount: fixture.expectedAmount,
    settled: 100.25,
    outstanding: fixture.expectedAmount - 100.25,
  });
  assert.equal(report.data.length, 10);
  assert.equal(report.meta.pageCount, 2);
  assert.equal(report.parties[0].partyName, "QA Customer 100%_");
  assert.equal(report.parties[0].amount, report.summary.amount);
  assert.deepEqual(report.monthly, [
    { month: "2026-01", amount: fixture.expectedAmount, count: 13 },
  ]);
  assert.deepEqual((await request({ page: 999 })).meta, {
    total: 13,
    page: 2,
    pageSize: 10,
    pageCount: 2,
  });
  const ordered = await request({ sort: "amount", direction: "asc" });
  assert.equal(ordered.data[0].number, fixture.invoices[0]);
  assert.equal(ordered.data[0].paymentDate, "2026-01-31");
  assert.equal(
    ordered.data[1].settled,
    0,
    "February Payment is excluded in January",
  );
  assert.equal(
    ordered.data[2].settled,
    0,
    "Draft Payment has no settlement effect",
  );
  assert.equal((await request({ settlement: "PAID" })).summary.count, 1);
  assert.equal((await request({ settlement: "UNPAID" })).summary.count, 12);
  assert.equal(
    (await request({ q: "100%_" })).summary.count,
    13,
    "Literal % and _ in names are searchable",
  );
  assert.equal(
    (await request({ q: "100_" })).summary.count,
    0,
    "Underscores are not SQL wildcards",
  );
  assert.equal(
    (await request({ q: "' OR 1=1 --" })).summary.count,
    0,
    "Search is parameterized",
  );
  assert.equal((await request({ q: fixture.invoices[4] })).summary.count, 1);
  const empty = await request({ from: "2026-03-01", to: "2026-04-30" });
  assert.deepEqual(empty.summary, {
    count: 0,
    amount: 0,
    settled: 0,
    outstanding: 0,
  });
  assert.equal(empty.monthly.length, 2);
  assert.ok(empty.monthly.every((m) => m.amount === 0));
  const feb = await request({
    from: "2026-01-01",
    to: "2026-02-01",
    sort: "date",
    direction: "asc",
    pageSize: 100,
  });
  assert.equal(feb.summary.count, 14);
  assert.equal(feb.summary.settled, 300.75);
  assert.equal(feb.data.at(-1).date, "2026-02-01");
  const procurement = await request({
    domain: "procurement",
    from: "2026-02-01",
    to: "2026-02-28",
  });
  assert.deepEqual(procurement.summary, {
    count: 2,
    amount: 777.77,
    settled: 0,
    outstanding: 777.77,
  });
  assert.equal(
    (
      await request({
        domain: "procurement",
        from: "2026-02-01",
        to: "2026-03-01",
      })
    ).summary.settled,
    555.55,
  );
  const exported = await request({}, { path: root + "/export" });
  assert.equal(exported.data.length, 13, "Export includes all pages");
  assert.deepEqual(exported.summary, report.summary);
  assert.equal(
    exported.data.reduce((sum, r) => sum + r.amount, 0),
    report.summary.amount,
  );
  assert.equal(
    (await request({ settlement: "PAID" }, { path: root + "/export" })).data
      .length,
    1,
  );
  assert.equal("requestHash" in exported.data[0], false);
  for (const invalid of [
    { from: "0000-01-01", to: "0000-01-31" },
    { to: "2025-12-31" },
    { to: "2027-01-02" },
    { from: "2026-02-30" },
    { sort: "amount;DROP TABLE" },
    { pageSize: 101 },
    { domain: "all" },
    { settlement: "POSTED" },
  ])
    await request(invalid, { status: 400 });
  await request({}, { session: "", status: 401 });
  await request({}, { session: viewer, status: 403 });
  await request({}, { session: viewer, path: root + "/export", status: 403 });
  await prisma.membership.create({
    data: {
      userId: (
        await prisma.user.findUniqueOrThrow({
          where: { email: "viewer@enterprise.local" },
        })
      ).id,
      companyId: fixture.companyId,
      role: "VIEWER",
    },
  });
  assert.equal(
    (await request({}, { session: viewer })).summary.count,
    13,
    "Authorized VIEWER may read reports",
  );
  const gamma = await request(
    {},
    { path: "/companies/gamma/reports/invoices" },
  );
  assert.equal(
    gamma.summary.count,
    0,
    "Changing company path scopes every aggregate",
  );
  const before = await prisma.auditLog.count({
    where: { companyId: fixture.companyId },
  });
  await request({}, { path: root + "/export" });
  assert.equal(
    await prisma.auditLog.count({ where: { companyId: fixture.companyId } }),
    before,
    "Reports do not mutate workflow data",
  );
  assert.deepEqual(
    (await request({ from: "9999-12-01", to: "9999-12-31" })).monthly,
    [{ month: "9999-12", amount: 0, count: 0 }],
  );
  await prisma.company.update({
    where: { id: fixture.companyId },
    data: { status: "INACTIVE" },
  });
  assert.equal(
    (await request()).summary.count,
    13,
    "Archived Company history remains readable",
  );
  console.log(
    "Reports passed: posted-only scoped aggregates, inclusive periods, as-of full settlement, drafts/cancellations excluded, literal search, stable sorting/pagination, all-page export, zero-filled months, and authorization.",
  );
} finally {
  if (fixture) await cleanupReportFixture(prisma, fixture.companyId, code);
  await prisma.$disconnect();
}
