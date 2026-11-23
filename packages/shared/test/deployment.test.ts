import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeBasePath, deploymentApiPath, deploymentRequestPath } from "../src/deployment";
test("deployment paths support root and nested mounts while rejecting domains and relative segments", () => {
  assert.equal(normalizeBasePath(), ""); assert.equal(normalizeBasePath("/"), ""); assert.equal(normalizeBasePath(" /erp/ "), "/erp"); assert.equal(normalizeBasePath("/portfolio/erp"), "/portfolio/erp");
  for (const bad of ["erp", "https://adzr.my.id/erp", "//erp", "/erp/../admin", "/erp?x=1", "/erp#hash", "/erp\\admin", "/erp with spaces"]) assert.throws(() => normalizeBasePath(bad));
});

test("Passenger request adaptation preserves query/encoding and handles stripped or retained mount paths", () => {
  for (const raw of ["/login", "/api/auth/me?company=alpha", "/_next/static/chunk.js", "/items?q=a%2Fb%20c&x=%252F"]) {
    const restored = deploymentRequestPath("/erp", raw, "restore");
    assert.equal(restored, `/erp${raw}`);
    assert.equal(deploymentRequestPath("/erp", restored, "restore"), restored);
    assert.equal(deploymentRequestPath("/erp", restored, "strip"), raw);
    assert.equal(deploymentRequestPath("", raw, "strip"), raw);
  }
  assert.equal(deploymentRequestPath("/erp", "/erp?x=1", "strip"), "/?x=1");
  assert.equal(deploymentRequestPath("/erp", "/erp", "strip"), "/");
  assert.equal(deploymentRequestPath("/erp", "/erp-api/api/health", "strip"), "/erp-api/api/health");
  assert.equal(deploymentRequestPath("/erp-api", "/erp-apix/api/health", "strip"), "/erp-apix/api/health");
  assert.equal(deploymentRequestPath("/erp-api", "/api/health", "strip"), "/api/health");
  assert.equal(deploymentRequestPath("/erp", "/%2Ferp/login", "restore"), "/erp/%2Ferp/login");
  for (const invalid of ["https://other.example/login", "//other.example/login", "login", "/a\\b", "/a\r\nb"]) {
    assert.throws(() => deploymentRequestPath("/erp", invalid, "restore"));
    assert.throws(() => deploymentRequestPath("/erp-api", invalid, "strip"));
  }
});
test("API calls remain within the mounted ERP rather than reaching a portfolio root endpoint", () => {
  assert.equal(deploymentApiPath("", "/auth/me"), "/api/auth/me"); assert.equal(deploymentApiPath("/erp", "/auth/login"), "/erp/api/auth/login"); assert.equal(deploymentApiPath("/portfolio/erp/", "/companies/alpha/items?q=abc"), "/portfolio/erp/api/companies/alpha/items?q=abc");
  assert.throws(() => deploymentApiPath("/erp", "https://other.example/api")); assert.throws(() => deploymentApiPath("/erp", "//other.example"));
});
