import { test } from "node:test";
import assert from "node:assert/strict";
import { installationSchema } from "../src/setup/installation";

const company = { code: "ALP", name: "PT Alpha Distribusi", industry: "Distribusi", city: "Jakarta", currency: "IDR" };
const valid = { name: "Administrator", email: "  Admin@Example.com  ", initialPassword: "Test-only!LongPassword", companies: [company] };
test("first installation validates identity, password byte limits and unique normalized Company codes", () => {
  const parsed = installationSchema.parse(valid);
  assert.equal(parsed.email, "admin@example.com");
  assert.equal(parsed.companies[0].status, "ACTIVE");
  for (const input of [
    { ...valid, email: "invalid" }, { ...valid, initialPassword: "short" },
    { ...valid, initialPassword: "字".repeat(25) }, { ...valid, companies: [] },
    { ...valid, companies: [company, { ...company, code: "alp" }] },
    { ...valid, role: "SUPER_ADMIN" },
  ]) assert.equal(installationSchema.safeParse(input).success, false);
});
