import assert from "node:assert/strict";
import { config } from "dotenv";

config({ path: new URL("../apps/api/.env", import.meta.url), quiet: true });
if (process.env.NODE_ENV === "production") throw new Error("Development mount verification only");
const base = new URL(process.env.TEST_API_URL || "http://127.0.0.1:4011/erp-api");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("Mount verification must use a loopback API");
const prefix = base.pathname.replace(/\/+$/, "");
assert.ok(prefix, "TEST_API_URL must include the API mount");
const origin = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
const request = (path, options = {}) => fetch(new URL(`${prefix}/api${path}`, base.origin), options);
assert.equal((await request("/health?q=a%2Fb%20c")).status, 200);
assert.equal((await fetch(new URL("/api/health", base.origin))).status, 200, "already-stripped path");
assert.equal((await fetch(new URL(`${prefix}-other/api/health`, base.origin))).status, 404, "mount boundary");
assert.equal((await request("/auth/me")).status, 401);
const login = await request("/auth/login", {
  method: "POST", headers: { "Content-Type": "application/json", Origin: origin },
  body: JSON.stringify({ email: "admin@enterprise.local", password: process.env.DEMO_PASSWORD }),
});
assert.equal(login.status, 201);
const issued = login.headers.get("set-cookie"), cookie = issued?.split(";")[0];
assert.ok(cookie);
assert.ok(issued.includes("Path=/erp;"), "frontend cookie mount");
assert.ok(/HttpOnly/i.test(issued));
const profile = await request("/auth/me", { headers: { Cookie: cookie } });
assert.equal(profile.status, 200); assert.equal(profile.headers.get("cache-control"), "no-store");
const user = await profile.json(); assert.ok(user.companies.length > 0);
const companyId = encodeURIComponent(user.companies[0].id);
assert.equal((await request(`/companies/${companyId}/master/suppliers?pageSize=1`, { headers: { Cookie: cookie } })).status, 200);
assert.equal((await request("/companies/not-authorized/master-summary", { headers: { Cookie: cookie } })).status, 403);
assert.equal((await request("/auth/logout", { method: "POST", headers: { Cookie: cookie, Origin: "https://other.example" } })).status, 403);
const logout = await request("/auth/logout", { method: "POST", headers: { Cookie: cookie, Origin: origin } });
assert.equal(logout.status, 201);
assert.ok(logout.headers.get("set-cookie").includes("Path=/erp;"));
console.log("Passenger API mount passed: retained/stripped prefixes, query handling, boundary 404, login/profile/catalog, Company isolation, Origin checks and scoped cookie clearing.");
