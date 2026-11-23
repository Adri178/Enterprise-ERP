// Integration check against the dedicated seeded DEVELOPMENT database only.
import assert from "node:assert/strict";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
config({ path: new URL("../apps/api/.env", import.meta.url), quiet: true });
if (process.env.NODE_ENV === "production")
  throw new Error("Integration checks are development-only");
const base = process.env.TEST_API_URL || "http://127.0.0.1:4010/api";
const prisma = new PrismaClient();
const suffix = Date.now().toString();
let cookie = "";
let createdId;
async function request(path, options = {}, session = cookie) {
  return fetch(base + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Cookie: session } : {}),
      ...options.headers,
    },
  });
}
async function login(email) {
  const response = await request(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password: process.env.DEMO_PASSWORD }),
    },
    "",
  );
  assert.equal(response.status, 201, "login");
  const header = response.headers.get("set-cookie");
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=Strict/i);
  return header.split(";")[0];
}
try {
  assert.equal(
    (await request("/companies", {}, "")).status,
    401,
    "anonymous access denied",
  );
  cookie = await login("admin@enterprise.local");
  const companies = await (await request("/companies")).json();
  assert.ok(
    ["alpha", "beta", "gamma"].every((id) =>
      companies.some((company) => company.id === id),
    ),
  );
  const alphaPage = await (
    await request("/companies/alpha/master/suppliers")
  ).json();
  assert.ok(alphaPage.data.every((record) => record.companyId === "alpha"));
  assert.ok(alphaPage.meta.total >= alphaPage.data.length);
  assert.equal(
    (await request("/companies/unknown/master/suppliers")).status,
    403,
    "forged company denied",
  );
  const values = {
    code: `QA-${suffix}`,
    name: "QA Disposable Supplier",
    category: "Distributor",
    email: "",
    phone: "",
    status: "ACTIVE",
    description: "Disposable integration test record",
    companyId: "beta",
  };
  const createdResponse = await request("/companies/alpha/master/suppliers", {
    method: "POST",
    body: JSON.stringify(values),
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  createdId = created.id;
  assert.equal(
    created.companyId,
    "alpha",
    "body cannot override company scope",
  );
  assert.equal(
    (
      await request("/companies/alpha/master/suppliers", {
        method: "POST",
        body: JSON.stringify(values),
      })
    ).status,
    409,
    "duplicate rejected",
  );
  assert.equal(
    (
      await request(`/companies/beta/master/suppliers/${created.id}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      })
    ).status,
    404,
    "cross-company record mutation denied",
  );
  assert.equal(
    (
      await request("/companies/gamma/master/suppliers", {
        method: "POST",
        body: JSON.stringify(values),
      })
    ).status,
    403,
    "per-company viewer role enforced",
  );
  assert.equal(
    (
      await request("/companies/alpha/master/suppliers", {
        method: "POST",
        body: JSON.stringify({ ...values, name: "" }),
      })
    ).status,
    400,
    "validation",
  );
  assert.equal(
    (
      await request("/companies/alpha/master/suppliers", {
        method: "POST",
        headers: { Origin: "https://untrusted.example" },
        body: JSON.stringify(values),
      })
    ).status,
    403,
    "CSRF origin rejected",
  );
  assert.equal(
    (
      await request(`/companies/alpha/master/suppliers/${created.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...values, name: "QA Updated Supplier" }),
      })
    ).status,
    200,
  );
  const beta = await (await request("/companies/beta/master/suppliers")).json();
  assert.ok(!beta.data.some((record) => record.id === created.id));
  const viewer = await login("viewer@enterprise.local");
  assert.equal(
    (await request("/companies/beta/master/suppliers", {}, viewer)).status,
    403,
    "membership required",
  );
  assert.equal(
    (
      await request(
        "/companies/alpha/master/suppliers",
        { method: "POST", body: JSON.stringify(values) },
        viewer,
      )
    ).status,
    403,
    "viewer write denied",
  );
  assert.equal(
    (
      await request(`/companies/alpha/master/suppliers/${created.id}`, {
        method: "DELETE",
      })
    ).status,
    204,
  );
  const audit = await prisma.auditLog.findMany({
    where: { entityId: created.id },
    orderBy: { createdAt: "asc" },
  });
  assert.deepEqual(
    audit.map((row) => row.action),
    ["CREATE", "UPDATE", "DELETE"],
  );
  assert.ok(audit.every((row) => row.companyId === "alpha"));
  const logout = await request("/auth/logout", { method: "POST" });
  assert.match(logout.headers.get("set-cookie"), /Expires=Thu, 01 Jan 1970/i);
  console.log(
    "API integration passed: JWT cookie, CRUD, validation, duplicate handling, company isolation, RBAC, CSRF, atomic audit logs, logout.",
  );
} finally {
  if (createdId) {
    await prisma.masterRecord.deleteMany({
      where: { id: createdId, code: `QA-${suffix}` },
    });
    await prisma.auditLog.deleteMany({
      where: { entityId: createdId, entity: "suppliers" },
    });
  }
  await prisma.$disconnect();
}
