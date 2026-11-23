/* eslint-disable @typescript-eslint/no-require-imports */
// Passenger loads this file directly; normal deployments may keep using next start.
const { createServer } = require("node:http");
const next = require("next");
const { normalizeBasePath, deploymentRequestPath } = require("@erp/shared");

async function start() {
  const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
  const app = next({ dev: false, dir: __dirname });
  const handle = app.getRequestHandler();
  await app.prepare();
  const server = createServer((request, response) => {
    try {
      // Some Passenger configurations keep the mount in req.url, others remove it.
      if (typeof globalThis.PhusionPassenger !== "undefined") {
        request.url = deploymentRequestPath(basePath, request.url || "/", "restore");
      }
    } catch {
      response.writeHead(400).end("Request URL tidak valid");
      return;
    }
    Promise.resolve().then(() => handle(request, response)).catch(() => {
      if (!response.headersSent) response.writeHead(500).end("Terjadi kesalahan pada server");
      else response.destroy();
    });
  });
  server.on("error", () => { console.error("Frontend gagal menerima koneksi"); process.exitCode = 1; });
  server.listen(Number(process.env.PORT || 3000), process.env.WEB_HOST || "127.0.0.1");
}

start().catch((error) => {
  console.error("Frontend gagal dimulai:", error instanceof Error ? error.message : "Periksa build dan konfigurasi hosting");
  process.exitCode = 1;
});
