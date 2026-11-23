import assert from "node:assert/strict";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
config({ path: new URL("../apps/api/.env", import.meta.url), quiet: true });
if (process.env.NODE_ENV === "production")
  throw new Error("Development verification only");
const base = process.env.TEST_API_URL || "http://127.0.0.1:4010/api";
const prisma = new PrismaClient();
const suffix = Date.now().toString();
const companyCode = `QA${Date.now().toString(36).toUpperCase()}`;
let cookie = "";
let testCompanyId;
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
  const response = await request(path, method, body);
  const data = await response.json();
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${data.message || response.status}`,
  );
  return data;
}
const master = (code, extra = {}) => ({
  code: `QA-${suffix}-${code}`,
  name: `QA ${code} ${suffix}`,
  category: "Operasional",
  email: "",
  phone: "",
  description: "",
  status: "ACTIVE",
  ...extra,
});
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
  const values = {
    code: companyCode,
    name: `QA Disposable Company ${suffix}`,
    industry: "Pengujian",
    city: "Jakarta",
    currency: "IDR",
    status: "ACTIVE",
    address: "",
    email: "",
    phone: "",
    taxId: "",
  };
  assert.equal(
    (await request("/companies", "POST", values, viewerCookie)).status,
    403,
    "Viewer cannot create company",
  );
  const company = await json("/companies", "POST", values, 201);
  testCompanyId = company.id;
  assert.equal(company.role, "ADMIN");
  assert.equal(company.currencyLocked, false);
  const path = `/companies/${company.id}`;
  const profile = await json(path, "PATCH", {
    ...values,
    city: "Bandung",
    currency: "SGD",
    expectedUpdatedAt: company.updatedAt,
  });
  assert.equal(profile.currency, "SGD");
  assert.equal(profile.city, "Bandung");
  assert.equal(
    (
      await request(path, "PATCH", {
        ...values,
        city: "Surabaya",
        expectedUpdatedAt: company.updatedAt,
      })
    ).status,
    409,
    "stale company update rejected",
  );
  assert.equal(
    (await request(path, "PATCH", { ...profile, code: "CHANGED" })).status,
    409,
    "company code immutable",
  );
  const branch = await json(
    `${path}/master/branches`,
    "POST",
    master("BRANCH", { city: "Bandung", address: "Alamat QA" }),
    201,
  );
  const foreignBranches = await json("/companies/beta/master/branches");
  assert.equal(
    (
      await request(
        `${path}/master/departments`,
        "POST",
        master("BAD-DEPT", { branchId: foreignBranches.data[0].id }),
      )
    ).status,
    400,
    "cross-company relation rejected",
  );
  assert.equal(
    await prisma.masterRecord.count({
      where: { companyId: company.id, code: `QA-${suffix}-BAD-DEPT` },
    }),
    0,
    "failed relation creates no base record",
  );
  const department = await json(
    `${path}/master/departments`,
    "POST",
    master("DEPARTMENT", { branchId: branch.id, costCenter: "QA-01" }),
    201,
  );
  assert.equal(department.branchName, branch.name);
  const warehouse = await json(
    `${path}/master/warehouses`,
    "POST",
    master("WAREHOUSE", { branchId: branch.id, address: "Warehouse QA" }),
    201,
  );
  assert.equal(warehouse.branchId, branch.id);
  await assert.rejects(
    prisma.department.update({
      where: { id: department.id },
      data: { branchId: foreignBranches.data[0].id },
    }),
    (error) => error.code === "P2003",
    "database FK rejects cross-company relation independently of API",
  );
  assert.equal(
    (await request(`${path}/master/branches/${branch.id}`, "DELETE")).status,
    409,
    "referenced branch cannot be deleted",
  );
  assert.equal(
    (
      await request(`${path}/master/branches/${branch.id}`, "PATCH", {
        ...branch,
        status: "INACTIVE",
      })
    ).status,
    409,
    "active dependents prevent deactivation",
  );
  assert.equal(
    await prisma.auditLog.count({
      where: { entityId: branch.id, action: "DELETE" },
    }),
    0,
    "failed delete writes no audit",
  );
  const item = await json(
    `${path}/master/items`,
    "POST",
    master("ITEM", {
      category: "Elektronik",
      unit: "pcs",
      purchasePrice: 1000.25,
      sellingPrice: 1500.5,
      trackStock: true,
      reorderLevel: 10,
    }),
    201,
  );
  assert.equal(item.purchasePrice, 1000.25);
  assert.equal(item.sellingPrice, 1500.5);
  assert.equal(
    (
      await request(
        `${path}/master/items`,
        "POST",
        master("BAD-ITEM", {
          unit: "pcs",
          trackStock: false,
          reorderLevel: 10,
        }),
      )
    ).status,
    400,
    "non-stock reorder rejected",
  );
  assert.equal(
    await prisma.masterRecord.count({
      where: { companyId: company.id, code: `QA-${suffix}-BAD-ITEM` },
    }),
    0,
  );
  assert.equal(
    (await request(path, "PATCH", { ...profile, currency: "EUR" })).status,
    409,
    "valued items lock company currency",
  );
  const refreshedCompanies = await json("/companies");
  assert.equal(
    refreshedCompanies.find((c) => c.id === company.id).currencyLocked,
    true,
  );
  const customer = await json(
    `${path}/master/customers`,
    "POST",
    master("CUSTOMER", {
      category: "Corporate",
      taxId: "DEMO-QA",
      city: "Bandung",
      address: "Alamat QA",
      creditLimit: 5000000,
    }),
    201,
  );
  assert.equal(customer.creditLimit, 5000000);
  const suppliers = [];
  for (const [name, status] of [
    ["A", "ACTIVE"],
    ["B", "INACTIVE"],
    ["C", "ACTIVE"],
  ])
    suppliers.push(
      await json(
        `${path}/master/suppliers`,
        "POST",
        master(`SUPPLIER-${name}`, {
          name: `QA Supplier ${name}`,
          category: "Jasa",
          paymentTermsDays: 45,
          status,
        }),
        201,
      ),
    );
  const page1 = await json(
    `${path}/master/suppliers?pageSize=2&page=1&sort=name&direction=asc`,
  );
  const page2 = await json(
    `${path}/master/suppliers?pageSize=2&page=2&sort=name&direction=asc`,
  );
  assert.equal(page1.meta.total, 3);
  assert.equal(page1.data.length, 2);
  assert.equal(page2.data.length, 1);
  assert.deepEqual(
    [...page1.data, ...page2.data].map((s) => s.name),
    ["QA Supplier A", "QA Supplier B", "QA Supplier C"],
  );
  assert.equal(
    (await json(`${path}/master/suppliers?status=INACTIVE&category=Jasa`)).meta
      .total,
    1,
  );
  assert.equal(
    (await json(`${path}/master/suppliers?q=Supplier%20C`)).data[0].id,
    suppliers[2].id,
  );
  assert.equal((await request(`${path}/master/items?pageSize=0`)).status, 400);
  assert.equal(
    (await request(`${path}/master/items?sort=untrusted`)).status,
    400,
  );
  const summary = await json(`${path}/master-summary`);
  assert.deepEqual(summary.suppliers, { total: 3, active: 2, inactive: 1 });
  const search = await json(`${path}/search?q=Supplier`);
  assert.equal(search.length, 3);
  assert.ok(search.every((row) => row.kind === "suppliers"));
  const first = suppliers[0];
  const races = await Promise.all(
    ["One", "Two"].map((name) =>
      request(`${path}/master/suppliers/${first.id}`, "PATCH", {
        ...first,
        name: `QA Updated ${name}`,
        expectedUpdatedAt: first.updatedAt,
      }),
    ),
  );
  assert.deepEqual(
    races.map((response) => response.status).sort(),
    [200, 409],
    "one concurrent update succeeds; stale update rejected",
  );
  assert.equal(
    await prisma.auditLog.count({
      where: { entityId: first.id, action: "UPDATE" },
    }),
    1,
    "one atomic update audit",
  );
  assert.equal((await request(path, "DELETE")).status, 204);
  assert.equal(
    (await request(`${path}/master/suppliers`, "POST", master("DENIED")))
      .status,
    403,
    "archived company is read-only",
  );
  assert.equal(
    (await json(`${path}/master/departments`)).meta.total,
    1,
    "archival preserves history",
  );
  const archived = (await json("/companies")).find((c) => c.id === company.id);
  assert.equal(archived.status, "INACTIVE");
  const restored = await json(path, "PATCH", {
    ...archived,
    status: "ACTIVE",
    expectedUpdatedAt: archived.updatedAt,
  });
  assert.equal(restored.status, "ACTIVE");
  assert.equal(
    (await request(path, "PATCH", restored, viewerCookie)).status,
    403,
    "company membership cannot be forged",
  );
  await json(
    `${path}/master/suppliers`,
    "POST",
    master("AFTER-RESTORE", { category: "Jasa" }),
    201,
  );
  console.log(
    "Phase 2 passed: company lifecycle, currency/code locks, all six domain profiles, same-company FK, dependency protection, server pagination/filter/sort/search, concurrent update conflict, and atomic audit logs.",
  );
} finally {
  if (testCompanyId) {
    const owned = await prisma.company.findUnique({
      where: { id: testCompanyId },
    });
    assert.equal(owned?.code, companyCode, "cleanup owns disposable company");
    await prisma.$transaction(async (tx) => {
      await tx.masterRecord.deleteMany({
        where: {
          companyId: testCompanyId,
          kind: { in: ["departments", "warehouses"] },
        },
      });
      await tx.masterRecord.deleteMany({ where: { companyId: testCompanyId } });
      await tx.auditLog.deleteMany({ where: { companyId: testCompanyId } });
      await tx.membership.deleteMany({ where: { companyId: testCompanyId } });
      await tx.company.delete({ where: { id: testCompanyId } });
    });
  }
  await prisma.$disconnect();
}
