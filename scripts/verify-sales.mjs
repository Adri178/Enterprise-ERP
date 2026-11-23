import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
config({ path: new URL("../apps/api/.env", import.meta.url), quiet: true });
if (process.env.NODE_ENV === "production")
  throw new Error("Development verification only");
const prisma = new PrismaClient(),
  base = process.env.TEST_API_URL || "http://127.0.0.1:4010/api",
  code = `QS${Date.now().toString(36).toUpperCase()}`;
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
  const viewer = await login("viewer@enterprise.local");
  const company = await json(
    "/companies",
    "POST",
    {
      code,
      name: "QA Sales Disposable",
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
    path = `${root}/sales`;
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
  const branch = await master("branches", "BR", { city: "Jakarta" }),
    warehouse = await master("warehouses", "WH", { branchId: branch.id });
  const customer = await master("customers", "CUS", { creditLimit: 50 });
  const one = await master("items", "ONE", {
      unit: "pcs",
      purchasePrice: 0,
      sellingPrice: 0,
      trackStock: true,
      reorderLevel: 0,
    }),
    two = await master("items", "TWO", {
      unit: "pcs",
      purchasePrice: 0,
      sellingPrice: 0,
      trackStock: true,
      reorderLevel: 0,
    });
  const input = {
    requestKey: randomUUID(),
    date: "2026-10-21",
    customerId: customer.id,
    warehouseId: warehouse.id,
    description: "QA full Sales chain",
    lines: [
      { itemId: one.id, quantity: 2, unitPrice: 1000.25 },
      { itemId: two.id, quantity: 1, unitPrice: 500.25 },
    ],
  };
  const foreignCustomer = await prisma.customer.findFirstOrThrow({
    where: { companyId: "beta" },
  });
  assert.equal(
    (
      await request(path + "/quotations", "POST", {
        ...input,
        customerId: foreignCustomer.id,
      })
    ).status,
    400,
  );
  assert.equal(await prisma.salesDocument.count({ where: { companyId } }), 0);
  let quote = await json(path + "/quotations", "POST", input, 201);
  assert.equal(quote.amount, 2500.75);
  assert.match(quote.number, new RegExp(`^QTN-${code}-2026-00001$`));
  assert.equal(
    (await json(path + "/quotations", "POST", input, 201)).id,
    quote.id,
  );
  assert.equal(
    (
      await request(path + "/quotations", "POST", {
        ...input,
        description: "different",
      })
    ).status,
    409,
  );
  assert.equal(
    (await request("/companies/alpha/sales/quotations", "POST", input, viewer))
      .status,
    403,
  );
  assert.equal((await request(path, "GET", undefined, viewer)).status, 403);
  assert.equal(
    (await request(`/companies/beta/sales/${quote.id}`)).status,
    404,
  );
  await assert.rejects(
    prisma.salesDocument.update({
      where: { id: quote.id },
      data: { customerId: foreignCustomer.id },
    }),
    (error) => error.code === "P2003",
  );
  assert.equal(
    (await request(root, "PATCH", { ...company, currency: "USD" })).status,
    409,
    "Sales drafts lock currency without valued catalog or Stock",
  );
  assert.equal(
    (await request(`${root}/master/customers/${customer.id}`, "DELETE")).status,
    409,
  );
  assert.equal(
    (
      await request(`${root}/master/items/${one.id}`, "PATCH", {
        ...one,
        unit: "box",
      })
    ).status,
    409,
  );
  const act = (doc, action = "post") =>
    json(
      `${path}/${doc.id}/actions`,
      "POST",
      { action, expectedUpdatedAt: doc.updatedAt },
      201,
    );
  const convert = (doc, kind, extra = {}) =>
    json(
      path + "/from-source",
      "POST",
      {
        requestKey: randomUUID(),
        sourceId: doc.id,
        kind,
        date: input.date,
        description: "",
        ...extra,
      },
      201,
    );
  assert.equal(
    (
      await request(path + "/from-source", "POST", {
        requestKey: randomUUID(),
        sourceId: quote.id,
        kind: "SALES_ORDER",
        date: input.date,
      })
    ).status,
    409,
  );
  const stale = quote;
  quote = await act(quote);
  assert.equal(
    (
      await request(`${path}/${quote.id}/actions`, "POST", {
        action: "post",
        expectedUpdatedAt: stale.updatedAt,
      })
    ).status,
    409,
  );
  assert.equal(
    (await json(`${root}/stock/balances`)).meta.total,
    0,
    "Quotation has no Stock effect",
  );
  let order = await convert(quote, "SALES_ORDER");
  await act(order, "cancel");
  order = await convert(quote, "SALES_ORDER");
  order = await act(order);
  let delivery = await convert(order, "DELIVERY_NOTE");
  const addStock = async (itemId, quantity, unitPrice) => {
    const doc = await json(
      `${root}/stock/operations`,
      "POST",
      {
        requestKey: randomUUID(),
        kind: "ADJUSTMENT",
        warehouseId: warehouse.id,
        targetWarehouseId: "",
        date: input.date,
        description: "Saldo QA untuk Sales",
        lines: [{ itemId, quantity, unitPrice }],
      },
      201,
    );
    await json(
      `${root}/stock/operations/${doc.id}/actions`,
      "POST",
      { action: "post", expectedUpdatedAt: doc.updatedAt },
      201,
    );
  };
  await addStock(one.id, 3, 100.01);
  assert.equal(
    (
      await request(`${path}/${delivery.id}/actions`, "POST", {
        action: "post",
        expectedUpdatedAt: delivery.updatedAt,
      })
    ).status,
    409,
    "second-line shortage rolls back the first line",
  );
  assert.equal(await prisma.stockLedger.count({ where: { companyId } }), 1);
  assert.equal(
    (
      await prisma.stockBalance.findFirst({
        where: { companyId, itemId: one.id },
      })
    ).quantity,
    3,
  );
  assert.equal((await json(`${path}/${delivery.id}`)).status, "DRAFT");
  await addStock(two.id, 1, 200.02);
  const races = await Promise.all(
    [0, 1].map(() =>
      request(`${path}/${delivery.id}/actions`, "POST", {
        action: "post",
        expectedUpdatedAt: delivery.updatedAt,
      }),
    ),
  );
  assert.deepEqual(races.map((r) => r.status).sort(), [201, 409]);
  delivery = await json(`${path}/${delivery.id}`);
  assert.equal(
    delivery.lines.reduce((s, l) => s + l.stockCost, 0),
    400.04,
  );
  const deliveryLedger = await prisma.stockLedger.findMany({
    where: { companyId, salesDocumentId: delivery.id },
  });
  assert.equal(deliveryLedger.length, 2);
  assert.ok(deliveryLedger.every((r) => r.quantity < 0 && r.value.lt(0)));
  assert.equal(
    await prisma.auditLog.count({
      where: { companyId, entityId: delivery.id, action: "POST" },
    }),
    1,
  );
  let invoice = await convert(delivery, "SALES_INVOICE");
  assert.equal(
    (
      await request(`${path}/${invoice.id}/actions`, "POST", {
        action: "post",
        expectedUpdatedAt: invoice.updatedAt,
      })
    ).status,
    409,
    "Credit Limit enforced independently of UI",
  );
  await json(`${root}/master/customers/${customer.id}`, "PATCH", {
    ...customer,
    creditLimit: 5000,
  });
  invoice = await act(invoice);
  let summary = await json(path + "/summary");
  assert.equal(summary.outstanding, 2500.75);
  assert.equal(summary.deliveredValue, 400.04);
  const payment = await convert(invoice, "PAYMENT");
  const paymentRaces = await Promise.all(
    [0, 1].map(() =>
      request(`${path}/${payment.id}/actions`, "POST", {
        action: "post",
        expectedUpdatedAt: payment.updatedAt,
      }),
    ),
  );
  assert.deepEqual(paymentRaces.map((r) => r.status).sort(), [201, 409]);
  summary = await json(path + "/summary");
  assert.equal(summary.outstanding, 0);
  assert.equal(summary.received, 2500.75);
  assert.equal(summary.sales, 2500.75);
  assert.equal(
    await prisma.stockLedger.count({ where: { companyId } }),
    4,
    "Invoice and Payment do not change Stock",
  );
  assert.equal(
    (await json(path + "?kind=SALES_INVOICE&status=POSTED")).meta.total,
    1,
  );
  assert.equal(
    (await json(path + `?q=${encodeURIComponent(customer.name)}&pageSize=2`))
      .meta.total,
    6,
  );
  assert.equal((await request(path + "?pageSize=1000")).status, 400);
  const candidates = [];
  for (let i = 0; i < 2; i++) {
    const q = await act(
      await json(
        path + "/quotations",
        "POST",
        {
          ...input,
          requestKey: randomUUID(),
          lines: [{ itemId: one.id, quantity: 1, unitPrice: 1000.25 }],
        },
        201,
      ),
    );
    const so = await act(await convert(q, "SALES_ORDER"));
    candidates.push(await convert(so, "DELIVERY_NOTE"));
  }
  const overdraw = await Promise.all(
    candidates.map((doc) =>
      request(`${path}/${doc.id}/actions`, "POST", {
        action: "post",
        expectedUpdatedAt: doc.updatedAt,
      }),
    ),
  );
  assert.deepEqual(
    overdraw.map((r) => r.status).sort(),
    [201, 409],
    "different Deliveries cannot overdraw the same balance",
  );
  const balance = await prisma.stockBalance.findFirstOrThrow({
    where: { companyId, itemId: one.id },
  });
  assert.equal(balance.quantity, 0);
  assert.equal(balance.value.toString(), "0");
  const ledger = await json(`${root}/stock/ledger?itemId=${one.id}`);
  assert.ok(ledger.data.some((row) => row.documentKind === "DELIVERY_NOTE"));
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
  await addStock(one.id, 2, 100.01);
  const invoices = [];
  for (const candidate of candidates) {
    let shipped = await json(`${path}/${candidate.id}`);
    if (shipped.status === "DRAFT") shipped = await act(shipped);
    invoices.push(await convert(shipped, "SALES_INVOICE"));
  }
  await json(`${root}/master/customers/${customer.id}`, "PATCH", {
    ...customer,
    creditLimit: 1500,
  });
  const creditRaces = await Promise.all(
    invoices.map((doc) =>
      request(`${path}/${doc.id}/actions`, "POST", {
        action: "post",
        expectedUpdatedAt: doc.updatedAt,
      }),
    ),
  );
  assert.deepEqual(
    creditRaces.map((response) => response.status).sort(),
    [201, 409],
    "concurrent Invoices cannot exceed Customer Credit Limit",
  );
  assert.equal((await json(path + "/summary")).outstanding, 1000.25);
  assert.equal((await request(root, "DELETE")).status, 204);
  assert.equal(
    (
      await request(path + "/quotations", "POST", {
        ...input,
        requestKey: randomUUID(),
      })
    ).status,
    403,
  );
  console.log(
    "Sales passed: Quotation→Order→Delivery→Invoice→Payment, scoped FK/RBAC, idempotency, immutable posting, atomic multi-line rollback, moving-average depletion, concurrent deliveries, credit limits, receivables and settlement, and ledger reconciliation.",
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
      await tx.salesLine.deleteMany({ where: { companyId } });
      for (const kind of [
        "PAYMENT",
        "SALES_INVOICE",
        "DELIVERY_NOTE",
        "SALES_ORDER",
        "QUOTATION",
      ])
        await tx.salesDocument.deleteMany({ where: { companyId, kind } });
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
