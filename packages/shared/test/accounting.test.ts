import { test } from "node:test";
import assert from "node:assert/strict";
import { accountSchema, journalSchema, journalEditSchema, journalTotals, ledgerQuerySchema, trialBalanceQuerySchema } from "../src/accounting";
const journal = { requestKey: "aa202626-1021-4ee0-b234-000000000001", date: "2026-10-21", description: "Modal pengembangan", reference: "", lines: [
  { accountId: "cash", debit: 0.1, credit: 0, description: "" },
  { accountId: "bank", debit: 0.2, credit: 0, description: "" },
  { accountId: "equity", debit: 0, credit: 0.3, description: "" },
] };
test("manual Journal balances integer cents and rejects invalid lines, repeated Accounts and excess totals", () => {
  assert.equal(journalSchema.safeParse(journal).success, true);
  assert.deepEqual(journalTotals(journal.lines), { debit: 30, credit: 30 });
  for (const lines of [
    [{ ...journal.lines[0], debit: 0 }, journal.lines[2]],
    [{ ...journal.lines[0], credit: 0.1 }, journal.lines[2]],
    [{ ...journal.lines[0], debit: 0.101 }, journal.lines[2]],
    [{ ...journal.lines[0], debit: -1 }, journal.lines[2]],
    [{ ...journal.lines[0], debit: 0.3 }, { ...journal.lines[2], accountId: "cash" }],
    [{ ...journal.lines[0], debit: 1e12 }, { ...journal.lines[1], debit: 1 }, { ...journal.lines[2], credit: 1e12 }, { ...journal.lines[2], accountId: "other", credit: 1 }],
    journal.lines.slice(0, 1),
  ]) assert.equal(journalSchema.safeParse({ ...journal, lines }).success, false);
  assert.equal(journalEditSchema.safeParse(journal).success, false);
  assert.equal(journalEditSchema.safeParse({ ...journal, expectedUpdatedAt: "2026-10-21T10:00:00.000Z" }).success, true);
});
test("Accounting validates chart roots and bounded, ordered report periods", () => {
  const account = { code: "1100", name: "Kas", type: "ASSET", isGroup: false, parentId: "", status: "ACTIVE" };
  assert.equal(accountSchema.safeParse(account).success, false);
  assert.equal(accountSchema.safeParse({ ...account, isGroup: true }).success, true);
  assert.equal(accountSchema.safeParse({ ...account, parentId: "root" }).success, true);
  assert.equal(trialBalanceQuerySchema.safeParse({ from: "2026-01-01", to: "2027-01-01" }).success, true);
  for (const period of [{ from: "2026-10-22", to: "2026-10-21" }, { from: "2026-01-01", to: "2027-01-02" }, { from: "0000-01-01", to: "0000-01-02" }]) assert.equal(trialBalanceQuerySchema.safeParse(period).success, false);
  assert.equal(ledgerQuerySchema.safeParse({ from: "2026-10-01", to: "2026-10-21" }).success, false);
  assert.equal(ledgerQuerySchema.safeParse({ from: "2026-10-01", to: "2026-10-21", accountId: "cash", pageSize: 101 }).success, false);
});
