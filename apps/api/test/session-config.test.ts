import { test } from "node:test";
import assert from "node:assert/strict";
import { sessionCookieOptions, frontendOrigin } from "../src/auth/session-config";
test("session issue and clearing options share the mount path with production-only secure cookies", () => {
  const saved = { path: process.env.SESSION_COOKIE_PATH, mode: process.env.NODE_ENV, origin: process.env.FRONTEND_ORIGIN };
  try {
    delete process.env.SESSION_COOKIE_PATH; process.env.NODE_ENV = "development";
    assert.deepEqual(sessionCookieOptions(), { path: "/", httpOnly: true, secure: false, sameSite: "strict" });
    process.env.SESSION_COOKIE_PATH = "/erp/"; process.env.NODE_ENV = "production";
    assert.deepEqual(sessionCookieOptions(), { path: "/erp", httpOnly: true, secure: true, sameSite: "strict" });
    process.env.FRONTEND_ORIGIN = "https://adzr.my.id/"; assert.equal(frontendOrigin(), "https://adzr.my.id");
    for (const invalid of ["https://adzr.my.id/erp", "https://adzr.my.id?x=1", "https://user:secret@adzr.my.id", "file:///tmp"]) { process.env.FRONTEND_ORIGIN = invalid; assert.throws(frontendOrigin); }
  } finally { for (const [key, value] of Object.entries({ SESSION_COOKIE_PATH: saved.path, NODE_ENV: saved.mode, FRONTEND_ORIGIN: saved.origin })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});
