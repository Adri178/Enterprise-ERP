import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { config } from "dotenv";
config({ path: new URL("../apps/api/.env", import.meta.url), quiet: true });
if (process.env.NODE_ENV === "production")
  throw new Error("Development verification only");
const prisma = new PrismaClient();
try {
  const rows = await prisma.masterRecord.findMany({ orderBy: { id: "asc" } });
  const digest = createHash("sha256")
    .update(JSON.stringify(rows))
    .digest("hex");
  const path = new URL("../.local/catalog-migration.sha256", import.meta.url);
  if (process.argv.includes("--before")) {
    writeFileSync(path, digest);
    console.log("Catalog fingerprint retained before migration.");
  } else {
    assert.equal(
      digest,
      readFileSync(path, "utf8"),
      "migration preserved all existing catalog fields",
    );
    const kinds = [
      "branches",
      "departments",
      "items",
      "customers",
      "suppliers",
      "warehouses",
    ];
    for (const kind of kinds) {
      const count = rows.filter((row) => row.kind === kind).length;
      const profile = {
        branches: prisma.branch,
        departments: prisma.department,
        items: prisma.item,
        customers: prisma.customer,
        suppliers: prisma.supplier,
        warehouses: prisma.warehouse,
      }[kind];
      assert.equal(await profile.count(), count);
    }
    console.log(
      `Migration verified: ${rows.length} catalog records preserved; all six domain profiles backfilled.`,
    );
  }
} finally {
  await prisma.$disconnect();
}
