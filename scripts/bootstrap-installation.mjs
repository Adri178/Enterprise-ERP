import { stdin, stdout } from "node:process";
import { Writable } from "node:stream";
import { createInterface } from "node:readline/promises";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { demoCompanies } from "@erp/shared/demo";
import { companySchema } from "@erp/shared";
import { bootstrapInstallation, InstallationExistsError, installationSchema } from "../apps/api/dist/setup/installation.js";

config({ path: new URL("../apps/api/.env", import.meta.url), quiet: true });

async function collectInput() {
  if (!stdin.isTTY || !stdout.isTTY) throw new Error("INTERACTIVE_REQUIRED");
  let muted = false;
  const output = new Writable({ write(chunk, encoding, done) { if (!muted) stdout.write(chunk, encoding); done(); } });
  const rl = createInterface({ input: stdin, output, terminal: true });
  const controller = new AbortController();
  rl.on("SIGINT", () => controller.abort());
  const question = (prompt) => rl.question(prompt, { signal: controller.signal });
  const hidden = async (prompt) => {
    stdout.write(prompt);
    muted = true;
    try { return await question(""); }
    finally { muted = false; stdout.write("\n"); }
  };
  try {
    stdout.write("Setup ADMIN pertama dan tiga Company fiktif kosong: Alpha, Beta, Gamma.\n");
    const name = await question("Nama ADMIN: ");
    const email = await question("Email ADMIN: ");
    const initialPassword = await hidden("Password awal (minimal 12 karakter, tidak ditampilkan): ");
    const confirmation = await hidden("Ulangi password awal: ");
    if (initialPassword !== confirmation) throw new Error("PASSWORD_MISMATCH");
    return installationSchema.parse({
      name, email, initialPassword,
      companies: demoCompanies.map((company) => companySchema.parse(company)),
    });
  } finally { rl.close(); }
}

async function main() {
  if (process.env.NODE_ENV !== "production") throw new Error("PRODUCTION_REQUIRED");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_REQUIRED");
  const input = await collectInput();
  const prisma = new PrismaClient();
  try {
    const result = await bootstrapInstallation(prisma, input);
    stdout.write(`Berhasil. ${result.companies.length} Company dan akses ADMIN dibuat.\nLogin menggunakan email yang diisi, lalu ganti password awal saat diminta.\n`);
  } finally { await prisma.$disconnect(); }
}

main().catch((error) => {
  if (error instanceof InstallationExistsError) console.error(error.message);
  else if (error?.message === "PRODUCTION_REQUIRED") console.error("Jalankan dengan NODE_ENV=production pada instalasi baru yang telah menerima migrasi.");
  else if (error?.message === "DATABASE_REQUIRED") console.error("DATABASE_URL belum tersedia. Isi environment privat API terlebih dahulu.");
  else if (error?.message === "INTERACTIVE_REQUIRED") console.error("Jalankan setup langsung di Terminal interaktif. Password tidak diterima melalui argumen atau pipe.");
  else if (error?.message === "PASSWORD_MISMATCH") console.error("Konfirmasi password tidak sama. Belum ada data yang dibuat.");
  else if (error?.name === "AbortError") console.error("Setup dibatalkan.");
  else if (error?.name === "ZodError") console.error("Data tidak valid. Gunakan nama 2–120 karakter, email valid, password 12–72 byte dan kode Company yang berbeda.");
  else console.error("Setup gagal. Periksa koneksi PostgreSQL, hak schema dan hasil migrate deploy. Kredensial tidak ditampilkan.");
  process.exitCode = 1;
});
