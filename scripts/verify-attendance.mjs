import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { attendanceToday } from "@erp/shared";
import "reflect-metadata";
import { AttendanceService } from "../apps/api/dist/human-resources/attendance.service.js";
config({ path: new URL("../apps/api/.env", import.meta.url), quiet: true });
if (process.env.NODE_ENV === "production") throw new Error("Development verification only");
const database = new URL(process.env.DATABASE_URL), base = new URL(process.env.TEST_API_URL || "http://127.0.0.1:4010/api");
if (!["localhost", "127.0.0.1"].includes(database.hostname) || database.port !== "55432" || database.pathname !== "/enterprise_erp" || !["localhost", "127.0.0.1"].includes(base.hostname)) throw new Error("Dedicated local development database/API required");
const prisma = new PrismaClient(), marker = `AT${randomUUID().slice(0, 7).toUpperCase()}`, owned = [];
let cookie = "", checks = 0;
async function request(path, method = "GET", body, session = cookie, extra = {}) { return fetch(base.href + path, { method, headers: { "Content-Type": "application/json", ...(session ? { Cookie: session } : {}), ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
async function json(path, method = "GET", body, status = 200, session = cookie) { const r = await request(path, method, body, session), value = await r.json(); assert.equal(r.status, status, `${method} ${path}: ${JSON.stringify(value)}`); checks++; return value; }
async function login(email) { const r = await request("/auth/login", "POST", { email, password: process.env.DEMO_PASSWORD }, ""); assert.equal(r.status, 201); return r.headers.get("set-cookie").split(";")[0]; }
const day = (() => { const date = new Date(`${attendanceToday()}T00:00:00Z`); while ([0, 6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() - 1); return date.toISOString().slice(0, 10); })(), period = day.slice(0, 7);
async function company(suffix) {
  const row = await json("/companies", "POST", { code: `${marker}${suffix}`, name: `QA Attendance ${suffix}`, industry: "Pengujian", city: "Jakarta", currency: "IDR", status: "ACTIVE", address: "", email: "", phone: "", taxId: "" }, 201); owned.push(row); return row;
}
async function organization(companyId) {
  const master = (kind, code, extra = {}) => json(`/companies/${companyId}/master/${kind}`, "POST", { code, name: `QA Attendance ${code}`, category: "Operasional", status: "ACTIVE", email: "", phone: "", description: "", ...extra }, 201);
  const branch = await master("branches", "BR", { city: "Jakarta" }), department = await master("departments", "DEP", { branchId: branch.id });
  return { branchId: branch.id, departmentId: department.id };
}
async function rawRejected(run, expected) { await assert.rejects(() => prisma.$transaction(run), error => expected === "P2003" ? error.code === expected : `${error.message} ${JSON.stringify(error.meta || {})}`.includes(expected)); checks++; }
try {
  cookie = await login("admin@enterprise.local"); const viewerCookie = await login("viewer@enterprise.local"), reviewerCookie = await login("reviewer@enterprise.local");
  const main = await company("A"), foreign = await company("B"), org = await organization(main.id), otherOrg = await organization(foreign.id), path = `/companies/${main.id}/hr/attendance`;
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@enterprise.local" } }), viewer = await prisma.user.findUniqueOrThrow({ where: { email: "viewer@enterprise.local" } }), reviewer = await prisma.user.findUniqueOrThrow({ where: { email: "reviewer@enterprise.local" } });
  await prisma.membership.createMany({ data: [{ companyId: main.id, userId: viewer.id, role: "VIEWER" }, { companyId: main.id, userId: reviewer.id, role: "MANAGER" }] });
  const employeeInput = (code, organization = org) => ({ code, name: `QA Attendance ${code}`, email: "", phone: "", jobTitle: "Operations", ...organization, employmentType: "PERMANENT", startDate: "2026-01-01", endDate: "", status: "ACTIVE" });
  const employee = await json(`/companies/${main.id}/hr/employees`, "POST", employeeInput("EMP-AT-01"), 201), other = await json(`/companies/${foreign.id}/hr/employees`, "POST", employeeInput("EMP-OTHER", otherOrg), 201);
  const input = (employeeId = employee.id, patch = {}) => ({ requestKey: randomUUID(), employeeId, date: day, status: "PRESENT", checkIn: "08:00", checkOut: "17:00", description: "QA Attendance", ...patch });
  await json(path, "POST", input(), 403, viewerCookie);
  await json(path, "POST", input(other.id), 400);
  await json(path, "POST", input(employee.id, { companyId: foreign.id }), 400);
  await json(path, "POST", input(employee.id, { date: "9999-12-31" }), 400);
  await json(path, "POST", input(employee.id, { date: "2025-12-31" }), 400);
  await json(path, "POST", input(employee.id, { checkOut: "07:00" }), 400);
  assert.equal((await request(path, "GET", undefined, "")).status, 401); checks++;
  const createInput = input(), created = await json(path, "POST", createInput, 201);
  assert.equal(created.durationMinutes, 540); assert.equal(created.companyId, main.id); assert.equal(created.revision, 0);
  assert.ok(!("requestKey" in created) && !("requestHash" in created));
  await rawRejected(tx => tx.attendanceRecord.create({ data: { companyId: main.id, employeeId: other.id, number: "ATT-QA-FK-001", requestKey: randomUUID(), requestHash: "0".repeat(64), employeeCode: other.code, employeeName: other.name, branchName: "QA", departmentName: "QA", date: new Date(day), status: "PRESENT", checkInMinutes: 480, checkOutMinutes: 1020, createdBy: admin.id, editedBy: admin.id } }), "P2003");
  assert.equal((await json(path, "POST", createInput, 201)).id, created.id);
  assert.equal((await json(path, "POST", { ...createInput, requestKey: createInput.requestKey.toUpperCase() }, 201)).id, created.id);
  await json(path, "POST", { ...createInput, description: "Different" }, 409);
  await json(path, "POST", createInput, 409, reviewerCookie);
  await json(path, "POST", input(), 409);
  assert.equal(await prisma.auditLog.count({ where: { companyId: main.id, entityId: created.id, action: "CREATE" } }), 1);
  await json(`/companies/${foreign.id}/hr/attendance/${created.id}`, "GET", undefined, 404);
  await json(`/companies/${foreign.id}/hr/attendance`, "GET", undefined, 403, viewerCookie);
  assert.equal((await request(path, "POST", input(), cookie, { Origin: "https://foreign.example" })).status, 403); checks++;
  const correction = { status: "PRESENT", checkIn: "08:00", checkOut: "18:00", description: "Koreksi QA", reason: "Koreksi jam pulang", expectedUpdatedAt: created.updatedAt };
  await json(`${path}/${created.id}`, "PATCH", { ...correction, reason: "x" }, 400);
  await json(`${path}/${created.id}`, "PATCH", { ...correction, employeeId: other.id }, 400);
  await json(`${path}/${created.id}`, "PATCH", correction, 403, viewerCookie);
  const corrected = await json(`${path}/${created.id}`, "PATCH", correction, 200, reviewerCookie);
  assert.equal(corrected.durationMinutes, 600); assert.equal(corrected.revision, 1);
  await json(`${path}/${created.id}`, "PATCH", correction, 409);
  const detail = await json(`${path}/${created.id}`); assert.equal(detail.historyTotal, 1); assert.equal(detail.history[0].before.checkOut, "17:00"); assert.equal(detail.history[0].after.checkOut, "18:00");
  const races = await Promise.all([request(`${path}/${created.id}`, "PATCH", { ...correction, expectedUpdatedAt: corrected.updatedAt, checkOut: "18:30" }), request(`${path}/${created.id}`, "PATCH", { ...correction, expectedUpdatedAt: corrected.updatedAt, checkOut: "19:00" })]);
  assert.deepEqual(races.map(r => r.status).sort(), [200, 409]); checks += 2;
  assert.equal(await prisma.auditLog.count({ where: { companyId: main.id, entityId: created.id, action: "CORRECT" } }), 2);
  const original = await prisma.attendanceRecord.findUniqueOrThrow({ where: { id: created.id } });
  await rawRejected(tx => tx.attendanceRecord.update({ where: { id: created.id }, data: { checkOutMinutes: 1, revision: { increment: 1 }, updatedAt: new Date(Date.now() + 5) } }), "Attendance_clock_valid");
  await rawRejected(tx => tx.attendanceRecord.update({ where: { id: created.id }, data: { employeeId: other.id, revision: { increment: 1 }, updatedAt: new Date(Date.now() + 5) } }), "Attendance identity and original snapshots are immutable");
  await rawRejected(tx => tx.employee.update({ where: { id: employee.id }, data: { startDate: new Date("2099-01-01") } }), "Employment dates must retain Attendance history");
  assert.deepEqual(await prisma.attendanceRecord.findUniqueOrThrow({ where: { id: created.id } }), original);
  await json(`/companies/${main.id}/hr/employees/${employee.id}`, "PATCH", { ...employeeInput(employee.code), startDate: "2099-01-01", expectedUpdatedAt: employee.updatedAt }, 409);
  // Audit failure must roll back the record revision, not just the audit row.
  await prisma.$executeRawUnsafe(`CREATE FUNCTION public.qa_attendance_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity = 'attendance' AND NEW.action = 'CORRECT' AND NEW."companyId" = '${main.id.replaceAll("'", "''")}' THEN RAISE EXCEPTION 'QA forced Attendance audit rollback'; END IF; RETURN NEW; END; $$`);
  await prisma.$executeRawUnsafe('CREATE TRIGGER qa_attendance_audit_failure BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION public.qa_attendance_audit_failure()');
  try {
    await assert.rejects(() => new AttendanceService(prisma).correct(main.id, admin.id, created.id, { ...correction, expectedUpdatedAt: original.updatedAt.toISOString() }), error => `${error.message} ${JSON.stringify(error.meta || {})}`.includes("QA forced Attendance audit rollback")); checks++;
    await json(`${path}/${created.id}`, "PATCH", { ...correction, expectedUpdatedAt: original.updatedAt.toISOString() }, 500); assert.deepEqual(await prisma.attendanceRecord.findUniqueOrThrow({ where: { id: created.id } }), original);
  }
  finally { await prisma.$executeRawUnsafe('DROP TRIGGER qa_attendance_audit_failure ON "AuditLog"'); await prisma.$executeRawUnsafe('DROP FUNCTION public.qa_attendance_audit_failure()'); }
  // Approved Leave and Attendance must agree in both API directions.
  const leaveEmployee = await json(`/companies/${main.id}/hr/employees`, "POST", employeeInput("EMP-LEAVE"), 201);
  const createLeave = employeeId => json(`/companies/${main.id}/hr/leave-requests`, "POST", { requestKey: randomUUID(), employeeId, type: "ANNUAL", fromDate: day, toDate: day, reason: "QA approved Attendance leave" }, 201);
  const actLeave = (row, action, expected = 201) => json(`/companies/${main.id}/hr/leave-requests/${row.id}/actions`, "POST", { action, expectedUpdatedAt: row.updatedAt, note: "" }, expected, action === "approve" ? reviewerCookie : cookie);
  const pending = await actLeave(await createLeave(leaveEmployee.id), "submit"), approved = await actLeave(pending, "approve");
  await json(path, "POST", input(leaveEmployee.id), 409);
  const cuti = await json(path, "POST", input(leaveEmployee.id, { status: "LEAVE", checkIn: "", checkOut: "" }), 201);
  assert.equal(cuti.leaveRequestId, approved.id); assert.equal(cuti.durationMinutes, 0);
  await json(`${path}/${cuti.id}`, "PATCH", { ...correction, expectedUpdatedAt: cuti.updatedAt }, 409);
  const conflicting = await actLeave(await createLeave(employee.id), "submit"); await actLeave(conflicting, "approve", 409);
  assert.equal((await prisma.leaveRequest.findUniqueOrThrow({ where: { id: conflicting.id } })).status, "PENDING");
  await rawRejected(tx => tx.leaveRequest.update({ where: { id: conflicting.id }, data: { status: "APPROVED", reviewerId: reviewer.id, reviewedAt: new Date() } }), "Approved leave conflicts with Attendance");
  await rawRejected(tx => tx.leaveRequest.update({ where: { id: approved.id }, data: { fromDate: new Date("2099-01-01"), toDate: new Date("2099-01-01") } }), "Approved leave must retain linked Attendance history");
  const notApproved = await json(`/companies/${main.id}/hr/employees`, "POST", employeeInput("EMP-NO-LEAVE"), 201);
  await json(path, "POST", input(notApproved.id, { status: "LEAVE", checkIn: "", checkOut: "" }), 409);
  const concurrentEmployee = await json(`/companies/${main.id}/hr/employees`, "POST", employeeInput("EMP-RACE"), 201);
  const duplicateRaces = await Promise.all([request(path, "POST", input(concurrentEmployee.id)), request(path, "POST", input(concurrentEmployee.id))]);
  assert.deepEqual(duplicateRaces.map(response => response.status).sort(), [201, 409]); checks += 2;
  assert.equal(await prisma.attendanceRecord.count({ where: { companyId: main.id, employeeId: concurrentEmployee.id } }), 1);
  for (let i = 0; i < 10; i++) { const emp = await json(`/companies/${main.id}/hr/employees`, "POST", employeeInput(`EMP-PAGE-${i}`), 201); await json(path, "POST", input(emp.id), 201); }
  const list = await json(`${path}?period=${period}&pageSize=10`); assert.equal(list.meta.total, 13); assert.equal(list.data.length, 10); assert.equal(list.summary.present, 12); assert.equal(list.summary.leave, 1);
  assert.equal(list.summary.durationMinutes, original.checkOutMinutes - original.checkInMinutes + 11 * 540);
  const next = await json(`${path}?period=${period}&pageSize=10&page=2`); assert.equal(next.data.length, 3);
  assert.ok(next.data.every(row => !list.data.some(previous => previous.id === row.id)));
  const exported = await json(`${path}/export?period=${period}&pageSize=1`, "GET", undefined, 200, viewerCookie); assert.equal(exported.data.length, 13);
  const filtered = await json(`${path}?period=${period}&status=LEAVE`); assert.equal(filtered.meta.total, 1); assert.equal(filtered.summary.present, 0); assert.equal(filtered.summary.leave, 1);
  await json(`${path}?period=2026-13`, "GET", undefined, 400); await json(`${path}?pageSize=101`, "GET", undefined, 400); await json(`${path}?companyId=${foreign.id}`, "GET", undefined, 400);
  // Historic records survive Employee deactivation and can still be corrected.
  const latestEmployee = await json(`/companies/${main.id}/hr/employees/${employee.id}`);
  await json(`/companies/${main.id}/hr/employees/${employee.id}`, "PATCH", { ...employeeInput(employee.code), status: "INACTIVE", endDate: day, expectedUpdatedAt: latestEmployee.updatedAt }, 409); // pending Leave requires resolution first
  await actLeave(conflicting, "cancel");
  const inactive = await json(`/companies/${main.id}/hr/employees/${employee.id}`, "PATCH", { ...employeeInput(employee.code), status: "INACTIVE", endDate: day, expectedUpdatedAt: latestEmployee.updatedAt });
  assert.equal(inactive.status, "INACTIVE");
  const latest = await json(`${path}/${created.id}`); await json(`${path}/${created.id}`, "PATCH", { ...correction, expectedUpdatedAt: latest.updatedAt });
  await json(path, "POST", input(employee.id), 400);
  assert.equal((await request(`/companies/${main.id}`, "DELETE")).status, 204); checks++;
  await json(`${path}/${created.id}`, "PATCH", { ...correction, expectedUpdatedAt: latest.updatedAt }, 403);
  assert.equal((await json(`${path}?period=${period}`, "GET", undefined, 200, viewerCookie)).meta.total, 13);
  console.log(`Attendance passed: ${checks} HTTP/database expectations; company/RBAC isolation, idempotency, clocks/dates, corrections/audit rollback, concurrency, Leave consistency, history, pagination/export and archival.`);
} finally {
  for (const company of owned.reverse()) {
    assert.equal((await prisma.company.findUnique({ where: { id: company.id } }))?.code, company.code);
    await prisma.$transaction(async tx => {
      await tx.attendanceRecord.deleteMany({ where: { companyId: company.id } }); await tx.leaveRequest.deleteMany({ where: { companyId: company.id } }); await tx.employee.deleteMany({ where: { companyId: company.id } });
      await tx.documentSequence.deleteMany({ where: { companyId: company.id } }); await tx.masterRecord.deleteMany({ where: { companyId: company.id, kind: "departments" } }); await tx.masterRecord.deleteMany({ where: { companyId: company.id } });
      await tx.auditLog.deleteMany({ where: { companyId: company.id } }); await tx.membership.deleteMany({ where: { companyId: company.id } }); await tx.company.delete({ where: { id: company.id } });
    });
  }
  await prisma.$disconnect();
}
