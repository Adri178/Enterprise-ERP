import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
config({ path: new URL("../apps/api/.env", import.meta.url), quiet: true });
if (process.env.NODE_ENV === "production") throw new Error("Development verification only");
const prisma = new PrismaClient(), base = process.env.TEST_API_URL || "http://127.0.0.1:4010/api", code = `QA${Date.now().toString(36).toUpperCase()}`;
let companyId, cookie = "", checks = 0;
async function request(path, method = "GET", body, session = cookie) {
  return fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(session ? { Cookie: session } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
async function json(path, method = "GET", body, expected = 200, session = cookie) {
  const r = await request(path, method, body, session), data = await r.json();
  assert.equal(r.status, expected, `${method} ${path}: ${JSON.stringify(data)}`); checks++; return data;
}
async function login(email) {
  const r = await request("/auth/login", "POST", { email, password: process.env.DEMO_PASSWORD }, "");
  assert.equal(r.status, 201); return r.headers.get("set-cookie").split(";")[0];
}
try {
  cookie = await login("admin@enterprise.local");
  const manager = await login("reviewer@enterprise.local"), viewer = await login("viewer@enterprise.local");
  const company = await json("/companies", "POST", { code, name: "QA Accounting Disposable", industry: "Pengujian", city: "Jakarta", currency: "IDR", status: "ACTIVE", address: "", email: "", phone: "", taxId: "" }, 201);
  companyId = company.id;
  const root = `/companies/${companyId}`, path = `${root}/accounting`;
  const users = await prisma.user.findMany({ where: { email: { in: ["reviewer@enterprise.local", "viewer@enterprise.local"] } } });
  await prisma.membership.createMany({ data: users.map((u) => ({ companyId, userId: u.id, role: u.email.startsWith("reviewer") ? "MANAGER" : "VIEWER" })) });
  const accountInput = (code, type, isGroup, parentId = "") => ({ code, name: `QA ${code}`, type, isGroup, parentId, status: "ACTIVE" });
  const createAccount = (input, expected = 201, session = cookie) => json(path + "/accounts", "POST", input, expected, session);
  const patchAccount = (row, changes = {}, expected = 200) => json(path + `/accounts/${row.id}`, "PATCH", { ...row, ...changes, parentId: row.parentId || "", expectedUpdatedAt: row.updatedAt }, expected);
  let asset = await createAccount(accountInput("10", "ASSET", true)), equity = await createAccount(accountInput("30", "EQUITY", true));
  let cash = await createAccount(accountInput("1100", "ASSET", false, asset.id)), bank = await createAccount(accountInput("1200", "ASSET", false, asset.id)), capital = await createAccount(accountInput("3100", "EQUITY", false, equity.id));
  await createAccount(accountInput("BAD", "ASSET", false), 400);
  await createAccount(accountInput("BAD", "ASSET", false, equity.id), 400);
  await createAccount(accountInput("BAD", "ASSET", false, cash.id), 400);
  await createAccount(accountInput("1100", "ASSET", false, asset.id), 409);
  await createAccount(accountInput("BAD", "ASSET", true), 403, viewer);
  const foreign = await prisma.account.findFirstOrThrow({ where: { companyId: "beta", isGroup: false } }), foreignGroup = await prisma.account.findFirstOrThrow({ where: { companyId: "beta", isGroup: true, type: "ASSET" } });
  await createAccount(accountInput("BAD", "ASSET", false, foreignGroup.id), 400);
  await assert.rejects(() => prisma.account.create({ data: { ...accountInput("DB-FOREIGN", "ASSET", false, foreignGroup.id), companyId } }));
  await patchAccount(cash, { code: "1101" }, 409);
  await patchAccount(asset, { status: "INACTIVE" }, 409);
  const oldCash = cash; cash = await patchAccount(cash, { name: "QA Cash updated" });
  await patchAccount(oldCash, { name: "Stale Cash" }, 409);
  const accountList = await json(path + "/accounts?node=LEDGER&pageSize=1&direction=desc");
  assert.equal(accountList.meta.total, 3); assert.equal(accountList.data[0].id, capital.id);
  assert.equal((await json(path + "/accounts?q=Cash&type=ASSET&status=ACTIVE")).meta.total, 1);
  const input = (amount = 100.25, date = "2026-10-01") => ({ requestKey: randomUUID(), date, description: "QA manual journal", reference: "QA-REF", lines: [{ accountId: cash.id, debit: amount, credit: 0, description: "" }, { accountId: capital.id, debit: 0, credit: amount, description: "" }] });
  const create = (body, expected = 201, session = cookie) => json(path + "/journals", "POST", body, expected, session);
  const action = (row, action, expected = 201, session = cookie) => json(path + `/journals/${row.id}/actions`, "POST", { action, expectedUpdatedAt: row.updatedAt }, expected, session);
  const keyBody = input(); let opening = await create(keyBody);
  assert.equal(opening.companyId, companyId); assert.equal(opening.currency, "IDR");
  assert.equal((await create(keyBody)).id, opening.id);
  await create({ ...keyBody, description: "Changed idempotency payload" }, 409);
  await create(input(), 403, viewer);
  await create({ ...input(), lines: [{ accountId: cash.id, debit: 0.1, credit: 0, description: "" }, { accountId: capital.id, debit: 0, credit: 0.2, description: "" }] }, 400);
  for (const badAccount of [asset.id, foreign.id]) { const bad = input(); bad.lines[0].accountId = badAccount; await create(bad, 400); }
  const updateInput = { ...input(200.25), expectedUpdatedAt: opening.updatedAt };
  opening = await json(path + `/journals/${opening.id}`, "PATCH", updateInput);
  await json(path + `/journals/${opening.id}`, "PATCH", updateInput, 409);
  assert.equal((await json(path + `/ledger?accountId=${cash.id}&from=2026-10-01&to=2026-10-31`)).closing, "0.00");
  const profile = await json("/auth/me"); assert.equal(profile.companies.find((c) => c.id === companyId).currencyLocked, true);
  await json(root, "PATCH", { ...company, currency: "USD", expectedUpdatedAt: company.updatedAt }, 409);
  const postRace = await Promise.all([request(path + `/journals/${opening.id}/actions`, "POST", { action: "post", expectedUpdatedAt: opening.updatedAt }), request(path + `/journals/${opening.id}/actions`, "POST", { action: "post", expectedUpdatedAt: opening.updatedAt })]);
  assert.deepEqual(postRace.map((r) => r.status).sort(), [201, 409]);
  opening = await json(path + `/journals/${opening.id}`); assert.equal(opening.status, "POSTED");
  assert.equal(await prisma.auditLog.count({ where: { companyId, entityId: opening.id, action: "POST" } }), 1);
  await json(path + `/journals/${opening.id}`, "PATCH", { ...updateInput, expectedUpdatedAt: opening.updatedAt }, 409);
  await action(opening, "cancel", 409);
  await assert.rejects(() => prisma.journalLine.update({ where: { id: opening.lines[0].id }, data: { debit: 999 } }));
  await assert.rejects(() => prisma.journal.update({ where: { id: opening.id }, data: { amount: 999 } }));
  assert.equal((await json(path + `/journals/${opening.id}`)).amount, 200.25);
  const cross = input(); cross.lines[0].accountId = foreign.id;
  await assert.rejects(() => prisma.journalLine.update({ where: { id: opening.lines[0].id }, data: { accountId: foreign.id, accountType: foreign.type } }));
  let cancelled = await create(input(50, "2026-10-05")); cancelled = await action(cancelled, "cancel");
  await action(cancelled, "post", 409);
  const drafts = [];
  for (let n = 1; n <= 12; n++) drafts.push(await create(input(n / 100, "2026-10-02")));
  for (const draft of drafts) await action(draft, "post");
  let pendingInactive = await create(input(1)); cash = await patchAccount(cash, { status: "INACTIVE" });
  await action(pendingInactive, "post", 400); await create(input(), 400);
  cash = await patchAccount(cash, { status: "ACTIVE" }); await action(pendingInactive, "cancel");
  const query = `accountId=${cash.id}&from=2026-10-02&to=2026-10-02`;
  const first = await json(path + `/ledger?${query}&pageSize=10`), second = await json(path + `/ledger?${query}&page=2&pageSize=10`);
  assert.equal(first.opening, "200.25"); assert.equal(first.debit, "0.78"); assert.equal(first.credit, "0.00"); assert.equal(first.closing, "201.03");
  assert.equal(first.meta.total, 12); assert.equal(second.data.length, 2);
  const lastBalance = Number(first.data.at(-1).balance), nextDebit = Number(second.data[0].debit);
  assert.equal(second.data[0].balance, (lastBalance + nextDebit).toFixed(2));
  assert.equal(second.data.at(-1).balance, "201.03");
  const exported = await json(path + `/ledger/export?${query}&page=2&pageSize=1`); assert.equal(exported.data.length, 12); assert.equal(exported.meta.page, 1);
  const trial = await json(path + "/trial-balance?from=2026-10-02&to=2026-10-02&pageSize=1&page=2");
  assert.equal(trial.meta.total, 3); assert.equal(trial.data.length, 1); assert.equal(trial.totals.opening, "0.00"); assert.equal(trial.totals.debit, "0.78"); assert.equal(trial.totals.credit, "0.78"); assert.equal(trial.totals.closingDebit, "201.03"); assert.equal(trial.totals.closingCredit, "201.03");
  assert.equal((await json(path + "/trial-balance/export?from=2026-10-02&to=2026-10-02&pageSize=1")).data.length, 3);
  assert.equal((await json(path + `/ledger?accountId=${bank.id}&from=2026-10-01&to=2026-10-31`)).meta.total, 0);
  await json(path + `/ledger?accountId=${foreign.id}&from=2026-10-01&to=2026-10-31`, "GET", undefined, 404);
  await json(path + `/ledger?accountId=${asset.id}&from=2026-10-01&to=2026-10-31`, "GET", undefined, 404);
  await json(path + `/journals/${(await prisma.journal.findFirstOrThrow({ where: { companyId: "beta" } })).id}`, "GET", undefined, 404);
  await json(path + "/ledger?accountId=none&from=2026-10-22&to=2026-10-01", "GET", undefined, 400);
  await json(path + "/trial-balance?from=2026-01-01&to=2027-01-02", "GET", undefined, 400);
  await json(path + "/accounts?pageSize=101", "GET", undefined, 400);
  const reversalBody = { requestKey: randomUUID(), date: "2026-10-03", description: "QA reversal of manual capital", expectedUpdatedAt: opening.updatedAt };
  const reversePath = path + `/journals/${opening.id}/reversal`;
  await json(reversePath, "POST", reversalBody, 403, manager);
  await json(reversePath, "POST", { ...reversalBody, date: "2026-09-30" }, 400);
  cash = await patchAccount(cash, { status: "INACTIVE" });
  const reverseRace = await Promise.all([request(reversePath, "POST", reversalBody), request(reversePath, "POST", { ...reversalBody, requestKey: randomUUID() })]);
  assert.deepEqual(reverseRace.map((r) => r.status).sort(), [201, 409]);
  const reversal = await reverseRace.find((r) => r.status === 201).json();
  const retryBody = reversalBody.requestKey === (await prisma.journal.findUniqueOrThrow({ where: { id: reversal.id } })).requestKey ? reversalBody : null;
  if (retryBody) assert.equal((await json(reversePath, "POST", retryBody, 201)).id, reversal.id);
  else { const stored = await prisma.journal.findUniqueOrThrow({ where: { id: reversal.id } }); assert.equal((await json(reversePath, "POST", { ...reversalBody, requestKey: stored.requestKey }, 201)).id, reversal.id); }
  assert.equal(reversal.status, "POSTED"); assert.equal(reversal.reversalOf.id, opening.id); assert.equal(reversal.lines[0].credit, 200.25);
  assert.equal((await json(path + `/journals/${opening.id}`)).reversedBy.id, reversal.id);
  await json(reversePath, "POST", { ...reversalBody, requestKey: randomUUID() }, 409);
  await json(path + `/journals/${reversal.id}/reversal`, "POST", { ...reversalBody, requestKey: randomUUID(), expectedUpdatedAt: reversal.updatedAt }, 409);
  const final = await json(path + `/ledger?accountId=${cash.id}&from=2026-10-01&to=2026-10-03`, "GET", undefined, 200, viewer);
  assert.equal(final.closing, "0.78"); assert.equal(final.debit, "201.03"); assert.equal(final.credit, "200.25");
  const finalTrial = await json(path + "/trial-balance?from=2026-10-03&to=2026-10-03");
  assert.equal(finalTrial.totals.debit, "200.25"); assert.equal(finalTrial.totals.closingDebit, "0.78"); assert.equal(finalTrial.totals.closingCredit, "0.78");
  await json(path + "/summary", "GET", undefined, 401, "");
  await json("/companies/beta/accounting/summary", "GET", undefined, 403, viewer);
  await request(root, "DELETE"); await create(input(), 403);
  assert.equal((await json(path + "/summary")).posted, 14);
  console.log(`Accounting passed (${checks} HTTP expectations): scoped chart/FKs, immutable structure, version conflicts, balanced drafts, idempotency, currency lock, concurrent posting/reversal, database balance rollback, precise paginated ledger and Trial Balance, full export, inactive historical Accounts, Roles, archive protection and audit.`);
} finally {
  if (companyId) {
    assert.equal((await prisma.company.findUnique({ where: { id: companyId } }))?.code, code);
    await prisma.$transaction(async (tx) => {
      await tx.journalLine.deleteMany({ where: { companyId } });
      await tx.journal.deleteMany({ where: { companyId, reversalOfId: { not: null } } });
      await tx.journal.deleteMany({ where: { companyId } });
      await tx.account.deleteMany({ where: { companyId, isGroup: false } });
      await tx.account.deleteMany({ where: { companyId } });
      await tx.documentSequence.deleteMany({ where: { companyId } });
      await tx.auditLog.deleteMany({ where: { companyId } });
      await tx.membership.deleteMany({ where: { companyId } });
      await tx.company.delete({ where: { id: companyId } });
    });
  }
  await prisma.$disconnect();
}
