import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { assertCompanyRole } from "../src/auth/access";
test("missing membership and forged company context are denied", () => {
  assert.throws(() => assertCompanyRole(null, "beta", []), ForbiddenException);
  assert.throws(
    () => assertCompanyRole({ companyId: "alpha", role: "ADMIN" }, "beta", []),
    ForbiddenException,
  );
});
test("membership role is enforced per company for writes", () => {
  assert.throws(() => assertCompanyRole({ companyId: "alpha", role: "ADMIN", active: false }, "alpha", []), ForbiddenException);
  assert.doesNotThrow(() =>
    assertCompanyRole({ companyId: "alpha", role: "VIEWER" }, "alpha", []),
  );
  assert.throws(
    () =>
      assertCompanyRole({ companyId: "alpha", role: "VIEWER" }, "alpha", [
        "ADMIN",
        "MANAGER",
      ]),
    ForbiddenException,
  );
  assert.doesNotThrow(() =>
    assertCompanyRole({ companyId: "beta", role: "MANAGER" }, "beta", [
      "ADMIN",
      "MANAGER",
    ]),
  );
});
