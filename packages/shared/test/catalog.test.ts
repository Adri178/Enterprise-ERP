import { test } from "node:test";
import assert from "node:assert/strict";
import {
  catalogQuerySchema,
  companySchema,
  masterSchemaFor,
  normalizeMasterInput,
} from "../src/index";
import { createDemoData, restoreDemoData } from "../src/demo";
const common = {
  code: "SUP-001",
  name: "Contoh Record",
  category: "Jasa",
  status: "ACTIVE" as const,
  email: "",
  phone: "",
  description: "",
};
test("domain validation requires Branch context and prevents non-stock reorder quantities", () => {
  assert.equal(masterSchemaFor("branches").safeParse(common).success, false);
  assert.ok(
    masterSchemaFor("branches").safeParse({ ...common, city: "Jakarta" })
      .success,
  );
  assert.equal(masterSchemaFor("departments").safeParse(common).success, false);
  assert.equal(
    masterSchemaFor("warehouses").safeParse({ ...common, branchId: "" })
      .success,
    false,
  );
  assert.equal(
    masterSchemaFor("items").safeParse({
      ...common,
      trackStock: false,
      reorderLevel: 10,
    }).success,
    false,
  );
  assert.equal(
    masterSchemaFor("items").safeParse({ ...common, sellingPrice: 10.123 })
      .success,
    false,
  );
  assert.equal(
    masterSchemaFor("customers").safeParse({ ...common, creditLimit: -1 })
      .success,
    false,
  );
  assert.equal(
    masterSchemaFor("suppliers").safeParse({ ...common, paymentTermsDays: 366 })
      .success,
    false,
  );
  assert.equal(normalizeMasterInput("suppliers", common).paymentTermsDays, 30);
});
test("catalog query bounds and sort whitelist reject unsafe or excessive parameters", () => {
  assert.equal(catalogQuerySchema.parse({}).pageSize, 10);
  for (const invalid of [
    { pageSize: 1000 },
    { page: 0 },
    { sort: "untrusted" },
    { direction: "DROP" },
    { q: "x".repeat(121) },
  ])
    assert.equal(catalogQuerySchema.safeParse(invalid).success, false);
});
test("company profile normalizes codes and validates supported currency and email", () => {
  const profile = {
    code: "new",
    name: "PT Contoh Digital",
    industry: "Teknologi",
    city: "Jakarta",
    currency: "IDR",
  };
  assert.equal(companySchema.parse(profile).code, "NEW");
  assert.equal(
    companySchema.safeParse({ ...profile, currency: "INVALID" }).success,
    false,
  );
  assert.equal(
    companySchema.safeParse({ ...profile, email: "invalid" }).success,
    false,
  );
});
test("Phase 1 demo storage upgrade preserves custom catalog rows and transaction drafts", () => {
  const original = createDemoData();
  const legacy = {
    records: Object.fromEntries(
      Object.entries(original.records).map(([kind, rows]) => [
        kind,
        rows.map((row) => ({
          id: row.id,
          companyId: row.companyId,
          code: row.code,
          name: row.name,
          category: row.category,
          email: row.email,
          phone: row.phone,
          description: row.description,
          status: row.status,
          createdAt: row.createdAt,
        })),
      ]),
    ),
    transactions: [
      ...original.transactions,
      {
        id: "DRAFT-PRESERVED",
        companyId: "alpha",
        type: "Sales Order",
        party: "QA Customer",
        amount: 42,
        date: "2026-10-21",
        status: "DRAFT",
      },
    ],
  };
  legacy.records.suppliers.push({
    ...original.records.suppliers[0],
    id: "custom-preserved",
    code: "CUSTOM-01",
    name: "Custom Supplier",
    description: "Perubahan pengguna",
  });
  const restored = restoreDemoData(legacy);
  assert.equal(restored.companies.length, 3);
  assert.ok(
    restored.records.suppliers.some(
      (row) =>
        row.id === "custom-preserved" &&
        row.description === "Perubahan pengguna",
    ),
  );
  assert.ok(
    restored.transactions.some(
      (row) => row.id === "DRAFT-PRESERVED" && row.amount === 42,
    ),
  );
  assert.ok(
    restored.records.departments.every((row) =>
      restored.records.branches.some(
        (branch) =>
          branch.companyId === row.companyId && branch.id === row.branchId,
      ),
    ),
  );
});
