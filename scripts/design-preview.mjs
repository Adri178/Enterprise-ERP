import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const requireWeb = createRequire(new URL("../apps/web/package.json", import.meta.url));
const child = spawn(process.execPath, [requireWeb.resolve("next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "3000"], {
  cwd: fileURLToPath(new URL("../apps/web/", import.meta.url)),
  env: {
    ...process.env,
    NODE_ENV: "development",
    NEXT_PUBLIC_DATA_MODE: "demo",
    NEXT_PUBLIC_BASE_PATH: "",
    API_URL: "http://127.0.0.1:4010",
  },
  stdio: "inherit",
});

child.on("error", () => { console.error("Preview rancangan gagal dimulai. Periksa dependency dan port 3000."); process.exitCode = 1; });
child.on("exit", (code, signal) => { process.exitCode = code ?? (signal === "SIGINT" || signal === "SIGTERM" ? 0 : 1); });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { child.kill(signal); });
