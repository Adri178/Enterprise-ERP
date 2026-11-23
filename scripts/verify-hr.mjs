import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
config({ path: new URL("../apps/api/.env", import.meta.url), quiet: true });
if (process.env.NODE_ENV === "production")
  throw new Error("Development verification only");
const prisma = new PrismaClient(),
  base = process.env.TEST_API_URL || "http://127.0.0.1:4010/api",
  code = `QH${Date.now().toString(36).toUpperCase()}`;
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
async function json(
  path,
  method = "GET",
  body,
  expected = 200,
  session = cookie,
) {
  const r = await request(path, method, body, session),
    data = await r.json();
  assert.equal(
    r.status,
    expected,
    `${method} ${path}: ${JSON.stringify(data)}`,
  );
  return data;
}
async function login(email) {
  const r = await request(
    "/auth/login",
    "POST",
    { email, password: process.env.DEMO_PASSWORD },
    "",
  );
  assert.equal(r.status, 201);
  return r.headers.get("set-cookie").split(";")[0];
}
try {
  cookie = await login("admin@enterprise.local");
  const reviewerSession = await login("reviewer@enterprise.local"),
    viewer = await login("viewer@enterprise.local");
  const company = await json(
    "/companies",
    "POST",
    {
      code,
      name: "QA HR Disposable",
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
    path = `${root}/hr`;
  const reviewer = await prisma.user.findUniqueOrThrow({
      where: { email: "reviewer@enterprise.local" },
    }),
    viewerUser = await prisma.user.findUniqueOrThrow({
      where: { email: "viewer@enterprise.local" },
    });
  await prisma.membership.createMany({
    data: [
      { companyId, userId: reviewer.id, role: "MANAGER" },
      { companyId, userId: viewerUser.id, role: "VIEWER" },
    ],
  });
  const master = (kind, code, extra = {}) =>
    json(
      `${root}/master/${kind}`,
      "POST",
      {
        code,
        name: `QA ${code}`,
        category: "Operasional",
        email: "",
        phone: "",
        description: "",
        status: "ACTIVE",
        ...extra,
      },
      201,
    );
  const branch = await master("branches", "BR1", { city: "Jakarta" }),
    otherBranch = await master("branches", "BR2", { city: "Bandung" });
  let department = await master("departments", "DEP1", {
    branchId: branch.id,
    costCenter: "HR",
  });
  const otherDepartment = await master("departments", "DEP2", {
    branchId: otherBranch.id,
  });
  const input = {
    code: "emp-001",
    name: "QA Employee",
    email: "QA.Employee@example.local",
    phone: "",
    jobTitle: "Operations Specialist",
    employmentType: "PERMANENT",
    status: "ACTIVE",
    branchId: branch.id,
    departmentId: department.id,
    startDate: "2026-01-01",
    endDate: "",
  };
  let employee = await json(
    path + "/employees",
    "POST",
    { ...input, companyId: "beta" },
    201,
  );
  assert.equal(employee.companyId, companyId);
  assert.equal(employee.code, "EMP-001");
  assert.equal(employee.email, input.email.toLowerCase());
  await json(path + "/employees", "POST", input, 409);
  await json(
    path + "/employees",
    "POST",
    { ...input, code: "EMP-002", branchId: otherBranch.id },
    400,
  );
  await json(
    path + "/employees",
    "POST",
    { ...input, code: "EMP-002" },
    403,
    viewer,
  );
  const foreign = await prisma.employee.findFirstOrThrow({
    where: { companyId: "beta" },
  });
  await json(path + `/employees/${foreign.id}`, "GET", undefined, 404);
  await json(
    path + "/employees",
    "POST",
    {
      ...input,
      code: "EMP-002",
      branchId: foreign.branchId,
      departmentId: foreign.departmentId,
    },
    400,
  );
  const dbInput = {
    ...input,
    code: "DB-EMP",
    companyId,
    startDate: new Date(input.startDate),
    endDate: null,
  };
  await assert.rejects(
    () =>
      prisma.employee.create({
        data: { ...dbInput, branchId: otherBranch.id },
      }),
    (e) => e.code === "P2003",
  );
  await assert.rejects(
    () =>
      prisma.employee.create({
        data: {
          ...dbInput,
          branchId: foreign.branchId,
          departmentId: foreign.departmentId,
        },
      }),
    (e) => e.code === "P2003",
  );
  await assert.rejects(() =>
    prisma.employee.update({
      where: { id: employee.id },
      data: { status: "INACTIVE", endDate: null },
    }),
  );
  await json(path + `/employees/${employee.id}`, "PATCH", { ...input }, 400);
  await json(
    path + `/employees/${employee.id}`,
    "PATCH",
    { ...input, code: "NEW-CODE", expectedUpdatedAt: employee.updatedAt },
    409,
  );
  const oldVersion = employee.updatedAt;
  const changes = await Promise.all(
    ["QA Employee A", "QA Employee B"].map((name) =>
      request(path + `/employees/${employee.id}`, "PATCH", {
        ...employee,
        name,
        expectedUpdatedAt: oldVersion,
      }),
    ),
  );
  assert.deepEqual(changes.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    await prisma.auditLog.count({
      where: {
        companyId,
        entity: "employees",
        entityId: employee.id,
        action: "UPDATE",
      },
    }),
    1,
  );
  employee = await json(path + `/employees/${employee.id}`);
  const patch = (extra, expected = 200) =>
    json(
      path + `/employees/${employee.id}`,
      "PATCH",
      { ...employee, ...extra, expectedUpdatedAt: employee.updatedAt },
      expected,
    );
  const leaveInput = {
    requestKey: randomUUID(),
    employeeId: employee.id,
    type: "ANNUAL",
    fromDate: "2026-11-02",
    toDate: "2026-11-06",
    reason: "Keperluan keluarga QA",
  };
  let leave = await json(
    path + "/leave-requests",
    "POST",
    { ...leaveInput, days: 999 },
    201,
  );
  assert.equal(leave.days, 5);
  assert.match(leave.number, new RegExp(`^LV-${code}-2026-00001$`));
  assert.equal("requestHash" in leave, false);
  assert.equal("requestKey" in leave, false);
  assert.equal(
    (await json(path + "/leave-requests", "POST", leaveInput, 201)).id,
    leave.id,
  );
  await json(
    path + "/leave-requests",
    "POST",
    { ...leaveInput, reason: "Different payload" },
    409,
  );
  await json(
    path + "/leave-requests",
    "POST",
    leaveInput,
    409,
    reviewerSession,
  );
  await json(
    path + "/leave-requests",
    "POST",
    { ...leaveInput, requestKey: randomUUID(), employeeId: foreign.id },
    400,
  );
  await json(
    path + "/leave-requests",
    "POST",
    { ...leaveInput, requestKey: randomUUID(), fromDate: "2025-12-31" },
    400,
  );
  assert.equal((await json(path + "/summary")).pending, 0);
  const action = (doc, action, session = cookie, note = "", expected = 201) =>
    json(
      path + `/leave-requests/${doc.id}/actions`,
      "POST",
      { action, note, expectedUpdatedAt: doc.updatedAt },
      expected,
      session,
    );
  leave = await action(leave, "submit");
  await action(leave, "approve", cookie, "", 403);
  await assert.rejects(() =>
    prisma.leaveRequest.update({
      where: { id: leave.id },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewerId: leave.createdBy,
      },
    }),
  );
  const overlap = await json(
    path + "/leave-requests",
    "POST",
    { ...leaveInput, requestKey: randomUUID() },
    201,
  );
  await action(overlap, "submit", cookie, "", 409);
  await action(overlap, "submit", reviewerSession, "", 409);
  await patch({ status: "INACTIVE", endDate: "2026-12-31" }, 409);
  await patch({ startDate: "2026-11-03" }, 409);
  await patch(
    { branchId: otherBranch.id, departmentId: otherDepartment.id },
    409,
  );
  await json(
    `${root}/master/departments/${department.id}`,
    "PATCH",
    {
      ...department,
      status: "INACTIVE",
      expectedUpdatedAt: department.updatedAt,
    },
    409,
  );
  await json(
    `${root}/master/departments/${department.id}`,
    "PATCH",
    {
      ...department,
      branchId: otherBranch.id,
      expectedUpdatedAt: department.updatedAt,
    },
    409,
  );
  await assert.rejects(
    () =>
      prisma.department.update({
        where: { id: department.id },
        data: { branchId: otherBranch.id },
      }),
    (e) => e.message.includes("Employee_companyId_departmentId_branchId_fkey"),
  );
  assert.equal(
    (await request(`${root}/master/departments/${department.id}`, "DELETE"))
      .status,
    409,
  );
  assert.equal(
    (await json(`${root}/master/departments?branchId=${branch.id}`)).meta.total,
    1,
  );
  assert.equal((await json(path + "/summary")).pending, 1);
  const pendingVersion = { ...leave };
  leave = await action(
    leave,
    "approve",
    reviewerSession,
    "Disetujui oleh reviewer QA",
  );
  assert.equal(leave.status, "APPROVED");
  assert.equal(leave.reviewerName, reviewer.name);
  await action(pendingVersion, "approve", reviewerSession, "", 409);
  await action(leave, "cancel", cookie, "", 409);
  await action(overlap, "submit", cookie, "", 409);
  await action(overlap, "cancel");
  let rejected = await json(
    path + "/leave-requests",
    "POST",
    {
      ...leaveInput,
      requestKey: randomUUID(),
      fromDate: "2026-11-09",
      toDate: "2026-11-10",
    },
    201,
  );
  rejected = await action(rejected, "submit");
  await action(rejected, "reject", reviewerSession, "no", 400);
  rejected = await action(
    rejected,
    "reject",
    reviewerSession,
    "Jadwal perlu disesuaikan",
  );
  assert.equal(rejected.status, "REJECTED");
  let replacement = await json(
    path + "/leave-requests",
    "POST",
    {
      ...leaveInput,
      requestKey: randomUUID(),
      fromDate: "2026-11-09",
      toDate: "2026-11-10",
    },
    201,
  );
  replacement = await action(replacement, "submit");
  await action(replacement, "cancel");
  const candidates = [];
  for (const dates of [
    ["2026-12-01", "2026-12-04"],
    ["2026-12-03", "2026-12-07"],
  ])
    candidates.push(
      await json(
        path + "/leave-requests",
        "POST",
        {
          ...leaveInput,
          requestKey: randomUUID(),
          fromDate: dates[0],
          toDate: dates[1],
        },
        201,
      ),
    );
  const outcomes = await Promise.all(
    candidates.map((doc) =>
      request(path + `/leave-requests/${doc.id}/actions`, "POST", {
        action: "submit",
        expectedUpdatedAt: doc.updatedAt,
      }),
    ),
  );
  assert.deepEqual(
    outcomes.map((r) => r.status).sort(),
    [201, 409],
    "Concurrent overlapping submissions reserve the period once",
  );
  let winner = await json(
    path +
      `/leave-requests/${candidates[outcomes[0].status === 201 ? 0 : 1].id}`,
  );
  const reviews = await Promise.all(
    [0, 1].map(() =>
      request(
        path + `/leave-requests/${winner.id}/actions`,
        "POST",
        { action: "approve", expectedUpdatedAt: winner.updatedAt },
        reviewerSession,
      ),
    ),
  );
  assert.deepEqual(reviews.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    await prisma.auditLog.count({
      where: {
        companyId,
        entity: "leaveRequests",
        entityId: winner.id,
        action: "APPROVE",
      },
    }),
    1,
  );
  winner = await json(path + `/leave-requests/${winner.id}`);
  assert.equal(winner.status, "APPROVED");
  employee = await patch({ status: "INACTIVE", endDate: "2026-12-31" });
  await json(
    path + "/leave-requests",
    "POST",
    {
      ...leaveInput,
      requestKey: randomUUID(),
      fromDate: "2026-12-14",
      toDate: "2026-12-15",
    },
    400,
  );
  department = await json(
    `${root}/master/departments/${department.id}`,
    "PATCH",
    {
      ...department,
      status: "INACTIVE",
      expectedUpdatedAt: department.updatedAt,
    },
  );
  await patch({ status: "ACTIVE", endDate: "" }, 400);
  department = await json(
    `${root}/master/departments/${department.id}`,
    "PATCH",
    {
      ...department,
      status: "ACTIVE",
      expectedUpdatedAt: department.updatedAt,
    },
  );
  employee = await patch({ status: "ACTIVE", endDate: "" });
  for (let i = 2; i <= 13; i++)
    await json(
      path + "/employees",
      "POST",
      {
        ...input,
        code: `EMP-${String(i).padStart(3, "0")}`,
        name: `QA Employee ${i}`,
      },
      201,
    );
  assert.equal((await json(path + "/employees?page=999")).meta.page, 2);
  assert.equal(
    (await json(path + `/employees?branchId=${otherBranch.id}`)).meta.total,
    0,
  );
  assert.equal(
    (await json(path + `/employees?departmentId=${department.id}&pageSize=100`))
      .meta.total,
    13,
  );
  assert.equal(
    (await json(path + `/employees?q=${employee.code}`)).meta.total,
    1,
  );
  assert.equal(
    (
      await json(
        path + `/leave-requests?status=APPROVED&employeeId=${employee.id}`,
      )
    ).meta.total,
    2,
  );
  await json(path + "/employees?pageSize=101", "GET", undefined, 400);
  await json(path + "/employees?sort=companyId", "GET", undefined, 400);
  assert.equal(
    (await request(path + "/summary", "GET", undefined, "")).status,
    401,
  );
  assert.equal(
    (await request("/companies/beta/hr/summary", "GET", undefined, viewer))
      .status,
    403,
  );
  assert.equal(
    (await json(path + "/summary", "GET", undefined, 200, viewer)).active,
    13,
  );
  assert.equal(
    (await json(path + "/leave-requests", "GET", undefined, 200, viewer)).meta
      .total > 0,
    true,
  );
  assert.equal((await request(root, "DELETE")).status, 204);
  await json(path + "/employees", "POST", { ...input, code: "EMP-099" }, 403);
  await action(winner, "cancel", cookie, "", 403);
  assert.equal((await json(path + "/summary")).total, 13);
  console.log(
    "HR passed: scoped organization FK, Employee lifecycle/version races, role enforcement, idempotent Leave numbering, maker/reviewer separation, date/overlap rules, concurrent submissions/reviews, immutable terminal states, protected organization links, pagination and audit integrity.",
  );
} finally {
  if (companyId) {
    assert.equal(
      (await prisma.company.findUnique({ where: { id: companyId } }))?.code,
      code,
    );
    await prisma.$transaction(async (tx) => {
      await tx.leaveRequest.deleteMany({ where: { companyId } });
      await tx.employee.deleteMany({ where: { companyId } });
      await tx.documentSequence.deleteMany({ where: { companyId } });
      await tx.masterRecord.deleteMany({
        where: { companyId, kind: "departments" },
      });
      await tx.masterRecord.deleteMany({ where: { companyId } });
      await tx.auditLog.deleteMany({ where: { companyId } });
      await tx.membership.deleteMany({ where: { companyId } });
      await tx.company.delete({ where: { id: companyId } });
    });
  }
  await prisma.$disconnect();
}
