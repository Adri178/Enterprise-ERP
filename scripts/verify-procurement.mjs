import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
config({ path: new URL("../apps/api/.env", import.meta.url), quiet: true });
if (process.env.NODE_ENV === "production")
  throw new Error("Development verification only");
const prisma = new PrismaClient(),
  base = process.env.TEST_API_URL || "http://127.0.0.1:4010/api";
const code = `QP${Date.now().toString(36).toUpperCase()}`;
let companyId,
  cookie = "";
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
    result = await response.json();
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${JSON.stringify(result)}`,
  );
  return result;
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
  const viewer = await login("viewer@enterprise.local");
  const company = await json(
    "/companies",
    "POST",
    {
      code,
      name: "QA Procurement Disposable",
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
    path = `${root}/procurement`;
  const master = async (kind, code, extra = {}) =>
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
  const warehouse = await master("warehouses", "WH", { branchId: branch.id });
  const supplier = await master("suppliers", "SUP");
  const item = await master("items", "ITM", {
    unit: "pcs",
    purchasePrice: 0,
    sellingPrice: 0,
    trackStock: true,
    reorderLevel: 0,
  });
  const foreignItem = (await json("/companies/beta/master/items")).data[0];
  const input = {
    requestKey: randomUUID(),
    supplierId: supplier.id,
    warehouseId: warehouse.id,
    date: "2026-10-21",
    description: "QA full chain",
    lines: [{ itemId: item.id, quantity: 3, unitPrice: 1000.25 }],
  };
  assert.equal(
    (
      await request(path + "/requests", "POST", {
        ...input,
        lines: [{ ...input.lines[0], itemId: foreignItem.id }],
      })
    ).status,
    400,
  );
  assert.equal(
    await prisma.purchaseDocument.count({ where: { companyId } }),
    0,
  );
  let doc = await json(path + "/requests", "POST", input, 201);
  const foreignSupplier = await prisma.supplier.findFirstOrThrow({
    where: { companyId: "beta" },
  });
  await assert.rejects(
    prisma.purchaseDocument.update({
      where: { id: doc.id },
      data: { supplierId: foreignSupplier.id },
    }),
    (error) => error.code === "P2003",
    "database independently rejects cross-company Supplier",
  );
  assert.equal(doc.amount, 3000.75);
  assert.match(doc.number, new RegExp(`^PR-${code}-2026-00001$`));
  assert.equal(
    (await json(path + "/requests", "POST", input, 201)).id,
    doc.id,
    "retry is idempotent",
  );
  assert.equal(
    (
      await request(path + "/requests", "POST", {
        ...input,
        description: "different",
      })
    ).status,
    409,
    "same key cannot change content",
  );
  assert.equal(
    (
      await request(
        `/companies/alpha/procurement/requests`,
        "POST",
        input,
        viewer,
      )
    ).status,
    403,
  );
  assert.equal((await request(path, "GET", undefined, viewer)).status, 403);
  assert.equal(
    (await request(`/companies/beta/procurement/${doc.id}`)).status,
    404,
  );
  assert.equal(
    (
      await request(path + "/from-source", "POST", {
        requestKey: randomUUID(),
        sourceId: doc.id,
        kind: "PURCHASE_ORDER",
        date: input.date,
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
    (await request(`${root}/master/suppliers/${supplier.id}`, "DELETE")).status,
    409,
  );
  assert.equal(
    (await request(root, "PATCH", { ...company, currency: "USD" })).status,
    409,
    "draft locks currency even with zero-priced catalog",
  );
  const act = (d, action) =>
    json(
      `${path}/${d.id}/actions`,
      "POST",
      { action, expectedUpdatedAt: d.updatedAt },
      201,
    );
  assert.equal(
    (
      await request(`${path}/${doc.id}/actions`, "POST", {
        action: "post",
        expectedUpdatedAt: doc.updatedAt,
      })
    ).status,
    409,
  );
  const stale = doc;
  doc = await act(doc, "submit");
  assert.equal(
    (
      await request(`${path}/${doc.id}/actions`, "POST", {
        action: "approve",
        expectedUpdatedAt: stale.updatedAt,
      })
    ).status,
    409,
  );
  assert.equal((await json(path + "/summary")).requestsPending, 1);
  doc = await act(doc, "approve");
  const approved = doc;
  for (const kind of [
    "PURCHASE_ORDER",
    "PURCHASE_RECEIPT",
    "PURCHASE_INVOICE",
    "PAYMENT",
  ]) {
    const source = doc;
    const values = {
      requestKey: randomUUID(),
      sourceId: source.id,
      kind,
      date: input.date,
      description: "",
    };
    doc = await json(path + "/from-source", "POST", values, 201);
    assert.equal(doc.sourceId, source.id);
    assert.equal(doc.amount, 3000.75);
    assert.equal(
      (await json(path + "/from-source", "POST", values, 201)).id,
      doc.id,
    );
    assert.equal(
      (
        await request(path + "/from-source", "POST", {
          ...values,
          requestKey: randomUUID(),
        })
      ).status,
      409,
    );
    if (kind === "PURCHASE_RECEIPT") {
      assert.equal(
        (await json(`${root}/stock/balances`)).meta.total,
        0,
        "draft receipt has no stock effect",
      );
      const races = await Promise.all(
        [0, 1].map(() =>
          request(`${path}/${doc.id}/actions`, "POST", {
            action: "post",
            expectedUpdatedAt: doc.updatedAt,
          }),
        ),
      );
      assert.deepEqual(races.map((r) => r.status).sort(), [201, 409]);
      doc = await json(`${path}/${doc.id}`);
      assert.equal(await prisma.stockLedger.count({ where: { companyId } }), 1);
      assert.equal(
        await prisma.auditLog.count({
          where: { companyId, entityId: doc.id, action: "POST" },
        }),
        1,
      );
      const balances = await json(`${root}/stock/balances`);
      assert.equal(balances.data[0].quantity, 3);
      assert.equal(balances.data[0].value, 3000.75);
      const ledger = await json(`${root}/stock/ledger?q=ITM`);
      assert.equal(ledger.data[0].documentNumber, doc.number);
      const sums = await prisma.stockLedger.aggregate({
        where: { companyId, itemId: item.id, warehouseId: warehouse.id },
        _sum: { quantity: true, value: true },
      });
      assert.equal(sums._sum.quantity, balances.data[0].quantity);
      assert.equal(sums._sum.value.toNumber(), balances.data[0].value);
    } else doc = await act(doc, "post");
    if (kind === "PURCHASE_INVOICE")
      assert.equal((await json(path + "/summary")).outstanding, 3000.75);
  }
  const summary = await json(path + "/summary");
  assert.equal(summary.outstanding, 0);
  assert.equal(summary.paid, 3000.75);
  assert.equal(summary.purchases, 3000.75);
  assert.equal(summary.inventoryValue, 3000.75);
  assert.equal(
    (
      await request(`${path}/${doc.id}/actions`, "POST", {
        action: "cancel",
        expectedUpdatedAt: doc.updatedAt,
      })
    ).status,
    409,
  );
  assert.equal(
    (await json(path + "?pageSize=2&page=2&direction=asc")).data.length,
    2,
  );
  assert.equal(
    (await json(path + "?kind=PURCHASE_INVOICE&status=POSTED")).meta.total,
    1,
  );
  assert.equal((await request(path + "?pageSize=1000")).status, 400);
  assert.equal((await json(`${path}/${approved.id}`)).successors.length, 1);
  // Cancelled drafts permit a replacement; rejected requests never advance.
  let second = await json(
    path + "/requests",
    "POST",
    { ...input, requestKey: randomUUID() },
    201,
  );
  second = await act(second, "submit");
  second = await act(second, "reject");
  assert.equal(
    (
      await request(path + "/from-source", "POST", {
        requestKey: randomUUID(),
        sourceId: second.id,
        kind: "PURCHASE_ORDER",
        date: input.date,
      })
    ).status,
    409,
  );
  const third = await json(
    path + "/requests",
    "POST",
    { ...input, requestKey: randomUUID() },
    201,
  );
  await act(third, "cancel");
  assert.equal((await json(path + "/summary")).inventoryQuantity, 3);
  console.log(
    "Procurement passed: scoped references, RBAC, idempotency, numbering, Approval, full PR→PO→Receipt→Invoice→Payment, concurrent posting, ledger reconciliation, outstanding settlement, and immutable posted documents.",
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
      await tx.purchaseLine.deleteMany({ where: { companyId } });
      for (const kind of [
        "PAYMENT",
        "PURCHASE_INVOICE",
        "PURCHASE_RECEIPT",
        "PURCHASE_ORDER",
        "PURCHASE_REQUEST",
      ])
        await tx.purchaseDocument.deleteMany({ where: { companyId, kind } });
      await tx.documentSequence.deleteMany({ where: { companyId } });
      await tx.masterRecord.deleteMany({
        where: { companyId, kind: { in: ["warehouses", "departments"] } },
      });
      await tx.masterRecord.deleteMany({ where: { companyId } });
      await tx.auditLog.deleteMany({ where: { companyId } });
      await tx.membership.deleteMany({ where: { companyId } });
      await tx.company.delete({ where: { id: companyId } });
    });
  }
  await prisma.$disconnect();
}
