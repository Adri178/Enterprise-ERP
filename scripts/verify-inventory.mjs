import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { Prisma, PrismaClient } from "@prisma/client";
config({ path: new URL("../apps/api/.env", import.meta.url), quiet: true });
if (process.env.NODE_ENV === "production")
  throw new Error("Development verification only");
const prisma = new PrismaClient(),
  base = process.env.TEST_API_URL || "http://127.0.0.1:4010/api",
  code = `QI${Date.now().toString(36).toUpperCase()}`;
let cookie = "",
  companyId;
async function request(path, method = "GET", body, session = cookie) {
  return fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Cookie: session } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function json(path, method = "GET", body, expected = 200) {
  const response = await request(path, method, body),
    data = await response.json();
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${JSON.stringify(data)}`,
  );
  return data;
}
async function login(email) {
  const response = await request(
    "/auth/login",
    "POST",
    { email, password: process.env.DEMO_PASSWORD },
    "",
  );
  assert.equal(response.status, 201);
  return response.headers.get("set-cookie").split(";")[0];
}
try {
  cookie = await login("admin@enterprise.local");
  const viewerCookie = await login("viewer@enterprise.local");
  const company = await json(
    "/companies",
    "POST",
    {
      code,
      name: "QA Inventory Disposable",
      industry: "Pengujian",
      city: "Jakarta",
      currency: "IDR",
      status: "ACTIVE",
      address: "",
      email: "",
      phone: "",
      taxId: "",
    },
    201,
  );
  companyId = company.id;
  const root = `/companies/${companyId}`,
    path = `${root}/stock/operations`;
  const master = (kind, code, extra = {}) =>
    json(
      `${root}/master/${kind}`,
      "POST",
      {
        code,
        name: `QA ${code}`,
        category: "Operasional",
        status: "ACTIVE",
        email: "",
        phone: "",
        description: "",
        ...extra,
      },
      201,
    );
  const branch = await master("branches", "BR", { city: "Jakarta" });
  const warehouse = await master("warehouses", "WH-A", { branchId: branch.id }),
    target = await master("warehouses", "WH-B", { branchId: branch.id });
  const item = await master("items", "ONE", {
    unit: "pcs",
    purchasePrice: 0,
    sellingPrice: 0,
    trackStock: true,
    reorderLevel: 0,
  });
  const other = await master("items", "TWO", {
    unit: "pcs",
    purchasePrice: 0,
    sellingPrice: 0,
    trackStock: true,
    reorderLevel: 0,
  });
  const foreignWarehouse = await prisma.warehouse.findFirstOrThrow({
    where: { companyId: "beta" },
  });
  const input = (kind, quantity, extra = {}) => ({
    requestKey: randomUUID(),
    kind,
    date: "2026-10-21",
    warehouseId: warehouse.id,
    targetWarehouseId: kind === "TRANSFER" ? target.id : "",
    description: "Pengujian Inventory",
    lines: [
      {
        itemId: item.id,
        quantity,
        unitPrice: kind === "ADJUSTMENT" && quantity > 0 ? 10.01 : 0,
      },
    ],
    ...extra,
  });
  const act = (doc, action = "post") =>
    json(
      `${path}/${doc.id}/actions`,
      "POST",
      { action, expectedUpdatedAt: doc.updatedAt },
      201,
    );
  const balance = async (id = warehouse.id) =>
    (await json(`${root}/stock/balances?warehouseId=${id}`)).data.find(
      (row) => row.itemId === item.id,
    );
  assert.equal(
    (
      await request(
        path,
        "POST",
        input("TRANSFER", 2, { targetWarehouseId: warehouse.id }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        path,
        "POST",
        input("TRANSFER", 2, { targetWarehouseId: foreignWarehouse.id }),
      )
    ).status,
    400,
  );
  assert.equal(
    (await request(path, "GET", undefined, viewerCookie)).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/companies/alpha/stock/operations",
        "POST",
        input("ADJUSTMENT", 3),
        viewerCookie,
      )
    ).status,
    403,
  );
  const values = input("ADJUSTMENT", 3);
  let added = await json(path, "POST", values, 201);
  assert.match(added.number, new RegExp(`^SA-${code}-2026-00001$`));
  assert.equal((await json(path, "POST", values, 201)).id, added.id);
  assert.equal(
    (await request(path, "POST", { ...values, description: "Different input" }))
      .status,
    409,
  );
  assert.equal(await balance(), undefined, "draft does not change Stock");
  assert.equal(
    (await request(`/companies/beta/stock/operations/${added.id}`)).status,
    404,
  );
  await assert.rejects(
    prisma.stockOperation.update({
      where: { id: added.id },
      data: { warehouseId: foreignWarehouse.id },
    }),
    (error) => error.code === "P2003",
  );
  assert.equal(
    (await request(root, "PATCH", { ...company, currency: "SGD" })).status,
    409,
  );
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@enterprise.local" },
  });
  // Disposable company's Role only; source companies and Users remain untouched.
  await prisma.membership.update({
    where: { userId_companyId: { companyId, userId: admin.id } },
    data: { role: "MANAGER" },
  });
  assert.equal(
    (
      await request(`${path}/${added.id}/actions`, "POST", {
        action: "post",
        expectedUpdatedAt: added.updatedAt,
      })
    ).status,
    403,
    "MANAGER cannot post Adjustment",
  );
  await prisma.membership.update({
    where: { userId_companyId: { companyId, userId: admin.id } },
    data: { role: "ADMIN" },
  });
  added = await act(added);
  assert.equal(
    (await json(`${root}/stock/balances?itemId=${other.id}`)).meta.total,
    0,
    "balance selector filters the exact Item",
  );
  assert.equal((await balance()).quantity, 3);
  assert.equal((await balance()).value, 30.03);
  // Two cost layers: (3 × 10.01 + 0.02) / 4 = 7.5125 per unit.
  await act(
    await json(
      path,
      "POST",
      input("ADJUSTMENT", 1, {
        lines: [{ itemId: item.id, quantity: 1, unitPrice: 0.02 }],
      }),
      201,
    ),
  );
  assert.equal((await balance()).value, 30.05);
  const transfer = await json(path, "POST", input("TRANSFER", 1), 201);
  await prisma.membership.update({
    where: { userId_companyId: { companyId, userId: admin.id } },
    data: { role: "MANAGER" },
  });
  const moved = await act(transfer);
  assert.equal(moved.lines[0].value, 7.51);
  assert.equal((await balance()).quantity, 3);
  assert.equal((await balance()).value, 22.54);
  assert.equal((await balance(target.id)).quantity, 1);
  assert.equal((await balance(target.id)).value, 7.51);
  const transferLedger = await prisma.stockLedger.findMany({
    where: { companyId, operationId: transfer.id },
  });
  assert.equal(transferLedger.length, 2);
  assert.equal(
    transferLedger.reduce((s, r) => s + r.quantity, 0),
    0,
  );
  assert.equal(
    transferLedger
      .reduce((s, r) => s.add(r.value), new Prisma.Decimal(0))
      .toString(),
    "0",
  );
  await prisma.membership.update({
    where: { userId_companyId: { companyId, userId: admin.id } },
    data: { role: "ADMIN" },
  });
  const beforeCount = await prisma.stockLedger.count({ where: { companyId } });
  const bad = await json(
    path,
    "POST",
    input("ADJUSTMENT", -1, {
      lines: [
        { itemId: item.id, quantity: -1, unitPrice: 0 },
        { itemId: other.id, quantity: -1, unitPrice: 0 },
      ],
    }),
    201,
  );
  assert.equal(
    (
      await request(`${path}/${bad.id}/actions`, "POST", {
        action: "post",
        expectedUpdatedAt: bad.updatedAt,
      })
    ).status,
    409,
  );
  assert.equal(
    await prisma.stockLedger.count({ where: { companyId } }),
    beforeCount,
    "multi-line failure rolls back prior movement",
  );
  assert.equal((await balance()).quantity, 3);
  assert.equal((await json(`${path}/${bad.id}`)).status, "DRAFT");
  await act(bad, "cancel");
  const attempts = [];
  for (let i = 0; i < 2; i++)
    attempts.push(await json(path, "POST", input("TRANSFER", 2), 201));
  const races = await Promise.all(
    attempts.map((doc) =>
      request(`${path}/${doc.id}/actions`, "POST", {
        action: "post",
        expectedUpdatedAt: doc.updatedAt,
      }),
    ),
  );
  assert.deepEqual(
    races.map((r) => r.status).sort(),
    [201, 409],
    "concurrent withdrawals cannot overdraw",
  );
  assert.equal((await balance()).quantity, 1);
  const remaining = await json(path, "POST", input("TRANSFER", 1), 201);
  const versions = await Promise.all(
    [0, 1].map(() =>
      request(`${path}/${remaining.id}/actions`, "POST", {
        action: "post",
        expectedUpdatedAt: remaining.updatedAt,
      }),
    ),
  );
  assert.deepEqual(versions.map((r) => r.status).sort(), [201, 409]);
  assert.equal((await balance()).quantity, 0);
  assert.equal((await balance()).value, 0);
  assert.equal(
    (await balance(target.id)).value,
    30.05,
    "full transfer preserves all rounding remainder",
  );
  const decrease = await act(
    await json(
      path,
      "POST",
      input("ADJUSTMENT", -1, { warehouseId: target.id }),
      201,
    ),
  );
  assert.ok(decrease.lines[0].value < 0);
  assert.equal((await balance(target.id)).quantity, 3);
  assert.equal(
    (
      await request(`${path}/${decrease.id}/actions`, "POST", {
        action: "cancel",
        expectedUpdatedAt: decrease.updatedAt,
      })
    ).status,
    409,
  );
  const backdated = await json(
    path,
    "POST",
    input("ADJUSTMENT", 1, { date: "2026-10-20", warehouseId: target.id }),
    201,
  );
  assert.equal(
    (
      await request(`${path}/${backdated.id}/actions`, "POST", {
        action: "post",
        expectedUpdatedAt: backdated.updatedAt,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(`${root}/master/items/${item.id}`, "PATCH", {
        ...item,
        unit: "box",
      })
    ).status,
    409,
  );
  assert.equal(
    (await request(`${root}/master/warehouses/${target.id}`, "DELETE")).status,
    409,
  );
  const ledgerPage = await json(
    `${root}/stock/ledger?warehouseId=${target.id}&pageSize=2`,
  );
  assert.equal(ledgerPage.data.length, 2);
  assert.ok(
    ledgerPage.data.every((r) => r.documentKind !== "PURCHASE_RECEIPT"),
  );
  assert.equal((await request(path + "?pageSize=1000")).status, 400);
  for (const row of await prisma.stockBalance.findMany({
    where: { companyId },
  })) {
    const sums = await prisma.stockLedger.aggregate({
      where: { companyId, itemId: row.itemId, warehouseId: row.warehouseId },
      _sum: { quantity: true, value: true },
    });
    assert.equal(sums._sum.quantity, row.quantity);
    assert.equal(sums._sum.value.toString(), row.value.toString());
  }
  assert.equal(
    await prisma.auditLog.count({
      where: { companyId, entityId: remaining.id, action: "POST" },
    }),
    1,
  );
  const summary = await json(`${root}/procurement/summary`);
  assert.equal(summary.inventoryQuantity, 3);
  assert.equal(summary.inventoryValue, 22.54);
  const postedTransfers = await json(
    path + "?kind=TRANSFER&status=POSTED&pageSize=1",
  );
  assert.equal(postedTransfers.meta.total, 3);
  assert.equal(postedTransfers.data.length, 1);
  assert.equal((await json(path + "?q=does-not-exist")).meta.total, 0);
  assert.equal((await request(root, "DELETE")).status, 204);
  assert.equal(
    (await request(path, "POST", input("ADJUSTMENT", 1))).status,
    403,
  );
  assert.equal(
    (await json(`${root}/stock/balances`)).meta.total,
    2,
    "inactive company retains readable balances",
  );
  console.log(
    "Inventory passed: Adjustment ADMIN policy, scoped FKs, idempotency, moving-average Transfer, zero residual, negative Stock prevention, concurrent withdrawals/posting, atomic rollback, date ordering, ledger reconciliation, and protected history.",
  );
} finally {
  if (companyId) {
    assert.equal(
      (await prisma.company.findUnique({ where: { id: companyId } }))?.code,
      code,
    );
    await prisma.$transaction(async (tx) => {
      await tx.stockLedger.deleteMany({ where: { companyId } });
      await tx.stockBalance.deleteMany({ where: { companyId } });
      await tx.stockOperationLine.deleteMany({ where: { companyId } });
      await tx.stockOperation.deleteMany({ where: { companyId } });
      await tx.documentSequence.deleteMany({ where: { companyId } });
      await tx.masterRecord.deleteMany({
        where: { companyId, kind: "warehouses" },
      });
      await tx.masterRecord.deleteMany({ where: { companyId } });
      await tx.auditLog.deleteMany({ where: { companyId } });
      await tx.membership.deleteMany({ where: { companyId } });
      await tx.company.delete({ where: { id: companyId } });
    });
  }
  await prisma.$disconnect();
}
