import { spawn } from "node:child_process";
import { config } from "dotenv";
config({ path: new URL("../apps/api/.env", import.meta.url), quiet: true });
if (process.env.NODE_ENV === "production") throw new Error("Development UI verification only");
const origin = new URL(process.env.TEST_WEB_URL || "http://localhost:3000");
const mount = origin.pathname.replace(/\/+$/, "");
const response = await fetch(new URL(`${mount}/api/auth/login`, origin), { method: "POST", headers: { "Content-Type": "application/json", Origin: origin.origin }, body: JSON.stringify({ email: "admin@enterprise.local", password: process.env.DEMO_PASSWORD }) });
if (response.status !== 201) throw new Error(`Development UI login failed (${response.status})`);
const session = response.headers.get("set-cookie")?.split(";")[0];
if (!session) throw new Error("No development UI session");
// Share one authenticated test session in child-process memory, never in files or output.
const files = process.argv.slice(2);
const child = spawn(process.execPath, ["--import", "./scripts/live-ui-test-setup.mjs", "--test", "--test-concurrency=1", ...(files.length ? files : [".local/test-build/web/test/*.integration.js"])], { stdio: "inherit", env: { ...process.env, ERP_TEST_SESSION: session } });
child.on("error", () => { process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
