import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { compare } from "bcryptjs";
import { companySchema } from "@erp/shared";
import { demoCompanies } from "@erp/shared/demo";
import { bootstrapInstallation, InstallationExistsError } from "../apps/api/dist/setup/installation.js";

config({ path: new URL("../apps/api/.env", import.meta.url), quiet: true });
if (process.env.NODE_ENV === "production") throw new Error("Development verification only");
const original = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1"].includes(original.hostname) || original.port !== "55432") throw new Error("Dedicated local cluster on 55432 required");
const database = `erp_bootstrap_${randomUUID().replaceAll("-", "")}`;
assert.match(database, /^erp_bootstrap_[a-f0-9]{32}$/);
const target = new URL(original); target.pathname = `/${database}`;
const root = fileURLToPath(new URL("../", import.meta.url));
const control = new PrismaClient(), prisma = new PrismaClient({ datasourceUrl: target.href });
const initialPassword = `Initial!${randomUUID()}`, nextPassword = `Changed!${randomUUID()}`;
const input = { name: "QA Initial Administrator", email: "initial-admin@example.local", initialPassword, companies: demoCompanies.map((company) => companySchema.parse(company)) };
let created = false, server;
const digest = async () => createHash("sha256").update(JSON.stringify(await Promise.all([
  prisma.user.findMany({ orderBy: { id: "asc" } }), prisma.company.findMany({ orderBy: { id: "asc" } }),
  prisma.membership.findMany({ orderBy: [{ companyId: "asc" }, { userId: "asc" }] }),
  prisma.auditLog.findMany({ orderBy: { id: "asc" } }), prisma.userSecurityEvent.findMany({ orderBy: { id: "asc" } }),
]))).digest("hex");
const empty = async () => {
  for (const model of ["user", "company", "membership", "auditLog", "userSecurityEvent"]) assert.equal(await prisma[model].count(), 0);
};

try {
  await control.$executeRawUnsafe(`CREATE DATABASE "${database}"`); created = true;
  const migration = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "apps/api/prisma/schema.prisma"], {
    cwd: root, env: { ...process.env, DATABASE_URL: target.href }, encoding: "utf8", stdio: "pipe", timeout: 90000,
  });
  assert.equal(migration.status, 0, "disposable-database migrations");
  const nonInteractive = spawnSync(process.execPath, ["scripts/bootstrap-installation.mjs"], {
    cwd: root, env: { ...process.env, DATABASE_URL: target.href, NODE_ENV: "production" }, encoding: "utf8", stdio: "pipe", timeout: 15000,
  });
  assert.equal(nonInteractive.status, 1); assert.ok(nonInteractive.stderr.includes("Terminal interaktif"));
  await empty();
  await assert.rejects(() => bootstrapInstallation(prisma, { ...input, initialPassword: "short" }));
  await empty();

  // Force a database failure after the User and first Company have been created.
  await prisma.$executeRawUnsafe(`CREATE FUNCTION public.qa_block_bootstrap() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.code = 'BET' THEN RAISE EXCEPTION 'QA forced bootstrap rollback'; END IF; RETURN NEW; END; $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER qa_block_bootstrap BEFORE INSERT ON "Company" FOR EACH ROW EXECUTE FUNCTION public.qa_block_bootstrap()`);
  await assert.rejects(() => bootstrapInstallation(prisma, input), (error) => error.message?.includes("QA forced bootstrap rollback") || error.meta?.database_error?.includes("QA forced bootstrap rollback"));
  await empty();
  await prisma.$executeRawUnsafe(`DROP TRIGGER qa_block_bootstrap ON "Company"`);
  await prisma.$executeRawUnsafe(`DROP FUNCTION public.qa_block_bootstrap()`);

  const concurrent = await Promise.allSettled([bootstrapInstallation(prisma, input), bootstrapInstallation(prisma, input)]);
  const completed = concurrent.filter((result) => result.status === "fulfilled");
  if (completed.length !== 1) console.error(concurrent.map((result) => result.status === "fulfilled" ? { status: "fulfilled" } : { status: "rejected", name: result.reason?.name, code: result.reason?.code }));
  assert.equal(completed.length, 1);
  assert.ok(concurrent.some((result) => result.status === "rejected" && result.reason instanceof InstallationExistsError));
  const installation = completed[0].value;
  assert.equal(installation.companies.length, 3); assert.equal(await prisma.user.count(), 1);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: installation.userId } });
  assert.ok(user.passwordHash.startsWith("$2b$12$")); assert.ok(await compare(initialPassword, user.passwordHash));
  assert.equal(user.mustChangePassword, true); assert.equal(user.sessionVersion, 0);
  const memberships = await prisma.membership.findMany(); assert.equal(memberships.length, 3);
  assert.ok(memberships.every((row) => row.role === "ADMIN" && row.active && row.createdBy === null && row.requestKey === null && row.requestHash === null));
  assert.equal(await prisma.auditLog.count(), 6); assert.equal(await prisma.userSecurityEvent.count(), 1);
  const audit = JSON.stringify(await prisma.auditLog.findMany());
  for (const secret of [initialPassword, user.passwordHash, "initialPassword", "passwordHash"]) assert.ok(!audit.includes(secret));
  const before = await digest();
  await assert.rejects(() => bootstrapInstallation(prisma, { ...input, email: "other-admin@example.local", initialPassword: nextPassword }), InstallationExistsError);
  assert.ok(await digest() === before, "existing installation must remain unchanged");

  server = spawn(process.execPath, ["server.js"], {
    cwd: fileURLToPath(new URL("../apps/api/", import.meta.url)), stdio: "ignore",
    env: { ...process.env, NODE_ENV: "development", DATABASE_URL: target.href, PORT: "4011", API_BASE_PATH: "/erp-api", SESSION_COOKIE_PATH: "/erp" },
  });
  const base = "http://127.0.0.1:4011/erp-api/api";
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error("Temporary API exited before startup");
    try { if ((await fetch(`${base}/health`)).ok) { ready = true; break; } } catch { /* wait for the owned process */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready);
  const origin = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
  const request = (path, method = "GET", body, cookie) => fetch(`${base}${path}`, {
    method, headers: { "Content-Type": "application/json", Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const login = await request("/auth/login", "POST", { email: input.email, password: initialPassword });
  assert.equal(login.status, 201);
  const oldCookie = login.headers.get("set-cookie")?.split(";")[0]; assert.ok(oldCookie);
  assert.equal((await (await request("/auth/me", "GET", undefined, oldCookie)).json()).mustChangePassword, true);
  const blocked = await request(`/companies/${installation.companies[0].id}/master-summary`, "GET", undefined, oldCookie);
  assert.equal(blocked.status, 403); assert.equal((await blocked.json()).code, "PASSWORD_CHANGE_REQUIRED");
  const changed = await request("/auth/change-password", "POST", { currentPassword: initialPassword, newPassword: nextPassword, confirmPassword: nextPassword }, oldCookie);
  assert.equal(changed.status, 201); assert.ok(changed.headers.get("set-cookie").includes("Path=/erp;"));
  assert.equal((await request("/auth/me", "GET", undefined, oldCookie)).status, 401);
  assert.equal((await request("/auth/login", "POST", { email: input.email, password: initialPassword })).status, 401);
  const renewed = await request("/auth/login", "POST", { email: input.email, password: nextPassword }); assert.equal(renewed.status, 201);
  const cookie = renewed.headers.get("set-cookie")?.split(";")[0]; assert.ok(cookie);
  const profile = await (await request("/auth/me", "GET", undefined, cookie)).json();
  assert.equal(profile.mustChangePassword, false); assert.equal(profile.companies.length, 3);
  assert.ok(profile.companies.every((company) => company.role === "ADMIN"));
  for (const company of installation.companies) assert.equal((await request(`/companies/${company.id}/access/users`, "GET", undefined, cookie)).status, 200);
  assert.equal((await request("/companies/not-authorized/master-summary", "GET", undefined, cookie)).status, 403);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).sessionVersion, 1);
  console.log("Installation bootstrap passed: disposable migrations, interactive-only CLI, validation, atomic rollback, concurrent single installer, bcrypt, three scoped ADMIN grants, private audit, existing-data preservation, first-password enforcement and session revocation.");
} finally {
  if (server && server.exitCode === null) {
    await new Promise((resolve) => { server.once("exit", resolve); server.kill(); });
  }
  await prisma.$disconnect();
  if (created) {
    assert.match(database, /^erp_bootstrap_[a-f0-9]{32}$/);
    await control.$executeRawUnsafe(`DROP DATABASE "${database}" WITH (FORCE)`);
  }
  await control.$disconnect();
}
