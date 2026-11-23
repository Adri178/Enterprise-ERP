import { test } from "node:test";
import assert from "node:assert/strict";
import { securePasswordSchema, grantCompanyUserSchema, editCompanyUserSchema, changePasswordSchema, accessAuditQuerySchema, companyUsersQuerySchema } from "../src/permissions";
test("User access validates normalized email, fixed Roles, reasons and versions without accepting global account changes", () => {
  const input = { mode: "EXISTING", requestKey: "aa202626-1021-4ee0-b234-000000000001", email: "  PERSON@Example.local  ", role: "VIEWER", reason: "Akses operasional", active: false, userActive: false, initialPassword: "IgnoredSecret2026" };
  const result = grantCompanyUserSchema.parse(input);
  assert.equal(result.email, "person@example.local"); assert.ok(!("initialPassword" in result)); assert.ok(!("userActive" in result)); assert.ok(!("active" in result));
  for (const value of [{ ...input, role: "SUPER_ADMIN" }, { ...input, mode: "NEW" }, { ...input, reason: "" }, { ...input, requestKey: "again" }]) assert.equal(grantCompanyUserSchema.safeParse(value).success, false);
  const edit = { role: "MANAGER", active: false, reason: "Rotasi tugas", expectedUpdatedAt: "2026-10-22T00:00:00.000Z" };
  assert.equal(editCompanyUserSchema.safeParse(edit).success, true); assert.equal(editCompanyUserSchema.safeParse({ ...edit, expectedUpdatedAt: undefined }).success, false);
  assert.equal(companyUsersQuerySchema.safeParse({ sort: "passwordHash" }).success, false); assert.equal(companyUsersQuerySchema.safeParse({ pageSize: 101 }).success, false);
  assert.equal(accessAuditQuerySchema.safeParse({ from: "2026-10-22", to: "2026-10-21" }).success, false);
});
test("password policy respects bcrypt UTF-8 byte bounds and matching, different new passwords", () => {
  assert.equal(securePasswordSchema.safeParse("x".repeat(72)).success, true); assert.equal(securePasswordSchema.safeParse("x".repeat(73)).success, false);
  assert.equal(securePasswordSchema.safeParse("😀".repeat(18)).success, true); assert.equal(securePasswordSchema.safeParse("😀".repeat(19)).success, false);
  assert.equal(securePasswordSchema.safeParse("short").success, false); assert.equal(securePasswordSchema.safeParse("LongSecret\0Password").success, false);
  const change = { currentPassword: "CurrentSecret2026!", newPassword: "DifferentSecret2026!", confirmPassword: "DifferentSecret2026!" };
  assert.equal(changePasswordSchema.safeParse(change).success, true); assert.equal(changePasswordSchema.safeParse({ ...change, confirmPassword: "AnotherSecret" }).success, false);
  assert.equal(changePasswordSchema.safeParse({ ...change, currentPassword: change.newPassword }).success, false);
});
