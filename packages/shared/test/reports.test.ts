import { test } from "node:test";
import assert from "node:assert/strict";
import {
  reportQuerySchema,
  reportExportSchema,
  reportMonths,
} from "../src/reports";

test("Reports validates real dates, inclusive bounded periods, enum sorting, and pagination", () => {
  const base = { from: "2026-01-01", to: "2026-12-31" };
  assert.equal(reportQuerySchema.parse(base).domain, "sales");
  assert.equal(
    reportQuerySchema.parse({ from: "2024-01-01", to: "2024-12-31" }).page,
    1,
  );
  for (const extra of [
    { to: "2027-01-02" },
    { to: "2025-12-31" },
    { from: "2026-02-30" },
    { from: "0000-01-01", to: "0000-01-31" },
    { page: 0 },
    { pageSize: 101 },
    { sort: "date; DROP TABLE" },
    { domain: "all" },
    { settlement: "DRAFT" },
    { q: "x".repeat(121) },
  ])
    assert.equal(
      reportQuerySchema.safeParse({ ...base, ...extra }).success,
      false,
      JSON.stringify(extra),
    );
  assert.equal(
    reportExportSchema.parse({ ...base, q: "  100%_  " }).q,
    "100%_",
  );
  assert.deepEqual(reportMonths("2025-12-31", "2026-02-01"), [
    "2025-12",
    "2026-01",
    "2026-02",
  ]);
  assert.deepEqual(reportMonths("9999-12-01", "9999-12-31"), ["9999-12"]);
});
