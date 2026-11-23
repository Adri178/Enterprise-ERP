import { test } from "node:test";
import assert from "node:assert/strict";
import {
  employeeSchema,
  employeeQuerySchema,
  leaveRequestSchema,
  leaveWorkingDays,
  leaveActions,
  leaveActionSchema,
} from "../src/human-resources";
const employee = {
  code: "emp-001",
  name: "Employee Demo",
  email: "demo@example.local",
  phone: "",
  jobTitle: "Operator",
  branchId: "br",
  departmentId: "dep",
  employmentType: "PERMANENT",
  status: "ACTIVE",
  startDate: "2026-01-01",
  endDate: "",
};
test("Employee validation enforces employment dates, stable code format, contact and query bounds", () => {
  assert.equal(employeeSchema.parse(employee).code, "EMP-001");
  for (const change of [
    { endDate: "2026-02-01" },
    { status: "INACTIVE" },
    { status: "INACTIVE", endDate: "2025-12-31" },
    { startDate: "2026-02-30" },
    { branchId: "" },
    { employmentType: "OTHER" },
    { email: "invalid" },
    { code: "../" },
  ])
    assert.equal(
      employeeSchema.safeParse({ ...employee, ...change }).success,
      false,
    );
  assert.equal(
    employeeSchema.safeParse({
      ...employee,
      status: "INACTIVE",
      endDate: "2026-03-31",
    }).success,
    true,
  );
  for (const q of [
    { page: 0 },
    { pageSize: 101 },
    { sort: "companyId" },
    { branchId: "" },
  ])
    assert.equal(employeeQuerySchema.safeParse(q).success, false);
});
test("Leave dates count weekdays across weekends and year boundaries without claiming entitlements", () => {
  assert.equal(leaveWorkingDays("2026-10-23", "2026-10-26"), 2);
  assert.equal(leaveWorkingDays("2026-10-24", "2026-10-25"), 0);
  assert.equal(leaveWorkingDays("2025-12-31", "2026-01-02"), 3);
  assert.equal(leaveWorkingDays("2026-01-01", "9999-12-31"), 0);
  const input = {
    requestKey: "6b784c70-b687-4dd4-b91a-ad96b511dc03",
    employeeId: "emp",
    type: "ANNUAL",
    fromDate: "2026-10-23",
    toDate: "2026-10-26",
    reason: "Keperluan keluarga",
  };
  assert.equal(leaveRequestSchema.safeParse(input).success, true);
  for (const change of [
    { toDate: "2026-10-22" },
    { fromDate: "2026-10-24", toDate: "2026-10-25" },
    { toDate: "2027-10-24" },
    { reason: "a" },
    { requestKey: "bad" },
  ])
    assert.equal(
      leaveRequestSchema.safeParse({ ...input, ...change }).success,
      false,
    );
});
test("Leave transitions separate maker and reviewer and require rejection notes and versions", () => {
  assert.deepEqual(leaveActions("PENDING", true, true), ["cancel"]);
  assert.deepEqual(leaveActions("PENDING", false, false), [
    "approve",
    "reject",
  ]);
  assert.deepEqual(leaveActions("DRAFT", false, false), []);
  for (const status of ["APPROVED", "REJECTED", "CANCELLED"] as const)
    assert.deepEqual(leaveActions(status, true, true), []);
  assert.equal(
    leaveActionSchema.safeParse({ action: "approve" }).success,
    false,
  );
  assert.equal(
    leaveActionSchema.safeParse({
      action: "reject",
      expectedUpdatedAt: "2026-10-21T00:00:00.000Z",
      note: "no",
    }).success,
    false,
  );
});
