import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
config({ path: new URL("../apps/api/.env", import.meta.url), quiet: true });
const prisma = new PrismaClient(),
  file = new URL(
    "../.local/inventory-migration-baseline.json",
    import.meta.url,
  );
try {
  const ledger = await prisma.stockLedger.findMany({
    select: {
      id: true,
      companyId: true,
      documentId: true,
      itemId: true,
      warehouseId: true,
      quantity: true,
      unitPrice: true,
      value: true,
      date: true,
      createdAt: true,
    },
    orderBy: { id: "asc" },
  });
  const balances = await prisma.stockBalance.findMany({
    orderBy: { id: "asc" },
  });
  const hash = createHash("sha256")
    .update(JSON.stringify({ ledger, balances }))
    .digest("hex");
  if (process.argv.includes("--before")) {
    await mkdir(new URL("../.local/", import.meta.url), { recursive: true });
    await writeFile(
      file,
      JSON.stringify({
        hash,
        ledger: ledger.length,
        balances: balances.length,
      }),
    );
    console.log(
      `Inventory migration baseline: ${ledger.length} ledger rows, ${balances.length} balances.`,
    );
  } else {
    assert.equal(
      hash,
      JSON.parse(await readFile(file, "utf8")).hash,
      "existing Stock data unchanged",
    );
    console.log(
      `Inventory migration preserved ${ledger.length} ledger rows and ${balances.length} balances exactly.`,
    );
  }
} finally {
  await prisma.$disconnect();
}
