// Optional Windows development helper. Owns only .local/postgres on port 55432.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
const root = resolve(import.meta.dirname, "..");
const local = join(root, ".local");
const cluster = join(local, "postgres");
const bin = process.env.POSTGRES_BIN || "C:/Program Files/PostgreSQL/18/bin";
function run(name, args, env = {}) {
  const result = spawnSync(join(bin, `${name}.exe`), args, {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
    env: { ...process.env, ...env },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${name} failed (${result.status})`);
}
if (process.argv.includes("--stop")) {
  run("pg_ctl", ["-D", cluster, "stop", "-m", "fast"]);
  process.exit(0);
}
mkdirSync(local, { recursive: true });
const passwordFile = join(local, "postgres-password");
if (!existsSync(passwordFile))
  writeFileSync(passwordFile, randomBytes(24).toString("hex"), { mode: 0o600 });
const password = readFileSync(passwordFile, "utf8").trim();
if (!existsSync(join(cluster, "PG_VERSION")))
  run("initdb", [
    "-D",
    cluster,
    "-U",
    "erp",
    "--pwfile",
    passwordFile,
    "--auth=scram-sha-256",
    "--encoding=UTF8",
    "--locale=C",
  ]);
const state = spawnSync(join(bin, "pg_ctl.exe"), ["-D", cluster, "status"], {
  windowsHide: true,
  stdio: "ignore",
});
if (state.status !== 0)
  run("pg_ctl", [
    "-D",
    cluster,
    "-l",
    join(local, "postgres.log"),
    "-o",
    "-p 55432 -h 127.0.0.1",
    "start",
    "-w",
  ]);
const dbExists = spawnSync(
  join(bin, "psql.exe"),
  [
    "-h",
    "127.0.0.1",
    "-p",
    "55432",
    "-U",
    "erp",
    "-d",
    "postgres",
    "-tAc",
    "SELECT 1 FROM pg_database WHERE datname='enterprise_erp'",
  ],
  {
    encoding: "utf8",
    windowsHide: true,
    env: { ...process.env, PGPASSWORD: password },
  },
);
if (dbExists.status !== 0) throw new Error("PostgreSQL connection failed");
if (dbExists.stdout.trim() !== "1")
  run(
    "createdb",
    ["-h", "127.0.0.1", "-p", "55432", "-U", "erp", "enterprise_erp"],
    { PGPASSWORD: password },
  );
const envPath = join(root, "apps/api/.env");
if (!existsSync(envPath))
  writeFileSync(
    envPath,
    `DATABASE_URL=postgresql://erp:${password}@127.0.0.1:55432/enterprise_erp?schema=public\nJWT_SECRET=${randomBytes(48).toString("hex")}\nFRONTEND_ORIGIN=http://localhost:3000\nAPI_HOST=127.0.0.1\nPORT=4010\nNODE_ENV=development\nDEMO_PASSWORD=DevOnly!ERP2026\n`,
    { mode: 0o600 },
  );
console.log(
  "Dedicated development PostgreSQL is ready on 127.0.0.1:55432. API environment is configured.",
);
