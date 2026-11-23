import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { RfqService } from "../apps/api/dist/procurement/rfq.service.js";
import { createRfqFixture, cleanupRfqFixture } from "./rfq-test-fixtures.mjs";
config({ path: new URL("../apps/api/.env", import.meta.url), quiet: true });
const database = new URL(process.env.DATABASE_URL), base = new URL(process.env.TEST_API_URL || "http://127.0.0.1:4010/api");
if (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1"].includes(database.hostname) || database.port !== "55432" || database.pathname !== "/enterprise_erp" || !["localhost", "127.0.0.1"].includes(base.hostname)) throw new Error("Dedicated local development database/API required");
const prisma = new PrismaClient(), owned = []; let cookie = "", checks = 0;
async function request(path, method = "GET", body, session = cookie) { return fetch(base.href + path, { method, headers: { "Content-Type": "application/json", ...(session ? { Cookie: session } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
async function json(path, method = "GET", body, status = 200, session = cookie) { const response = await request(path, method, body, session), result = await response.json(); assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(result)}`); checks++; return result; }
async function login(email) { const response = await request("/auth/login", "POST", { email, password: process.env.DEMO_PASSWORD }, ""); assert.equal(response.status, 201); return response.headers.get("set-cookie").split(";")[0]; }
async function fixture(suffix) { const handle = await createRfqFixture(json, suffix); owned.push(handle.company); return handle.prepare(); }
async function rejected(run, expected) { await assert.rejects(() => prisma.$transaction(run), error => error.code === expected || `${error.message} ${JSON.stringify(error.meta || {})}`.includes(expected)); checks++; }
try {
  cookie = await login("admin@enterprise.local"); const reviewerCookie = await login("reviewer@enterprise.local"), viewerCookie = await login("viewer@enterprise.local");
  const main = await fixture("A"), foreign = await fixture("B"), path = `/companies/${main.company.id}/rfqs`;
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@enterprise.local" } }), reviewer = await prisma.user.findUniqueOrThrow({ where: { email: "reviewer@enterprise.local" } }), viewer = await prisma.user.findUniqueOrThrow({ where: { email: "viewer@enterprise.local" } });
  await prisma.membership.createMany({ data: [{ companyId: main.company.id, userId: reviewer.id, role: "MANAGER" }, { companyId: main.company.id, userId: viewer.id, role: "VIEWER" }] });
  const sourceBefore = await prisma.purchaseDocument.findUniqueOrThrow({ where: { id: main.source.id } });
  const create = (sourceId = main.source.id, patch = {}) => ({ requestKey: randomUUID(), sourceId, date: main.date, deadline: main.date, supplierIds: main.suppliers.slice(0, 2).map(row => row.id), description: "QA operational RFQ", ...patch });
  await json(path, "GET", undefined, 401, ""); await json(`/companies/${foreign.company.id}/rfqs`, "GET", undefined, 403, viewerCookie);
  await json(path, "POST", create(), 403, viewerCookie); await json(path, "POST", create(foreign.source.id), 404);
  await json(path, "POST", create(main.source.id, { companyId: foreign.company.id }), 400);
  await json(path, "POST", create(main.source.id, { supplierIds: [main.suppliers[0].id] }), 400);
  await json(path, "POST", create(main.source.id, { supplierIds: [main.suppliers[0].id, main.suppliers[0].id] }), 400);
  await json(path, "POST", create(main.source.id, { supplierIds: [main.suppliers[0].id, foreign.suppliers[0].id] }), 400);
  const input = create(), created = await json(path, "POST", input, 201), id = created.id;
  assert.ok(!("requestKey" in created) && !("requestHash" in created));
  assert.equal((await json(path, "POST", { ...input, requestKey: input.requestKey.toUpperCase(), supplierIds: [...input.supplierIds].reverse() }, 201)).id, id);
  await json(path, "POST", { ...input, description: "Changed" }, 409); await json(path, "POST", input, 409, reviewerCookie); await json(path, "POST", create(), 409);
  assert.equal((await json(`${path}/eligible-requests`)).data.some(row => row.id === main.source.id), false);
  await json(`${main.path}/from-source`, "POST", { requestKey: randomUUID(), sourceId: main.source.id, kind: "PURCHASE_ORDER", date: main.date, description: "" }, 409);
  let row = await json(`${path}/${id}`);
  const action = (current, name, patch = {}, status = 201, session = cookie) => json(`${path}/${current.id}/actions`, "POST", { action: name, expectedUpdatedAt: current.updatedAt, ...patch }, status, session);
  const offerInput = (current, supplierId = main.suppliers[0].id, patch = {}) => ({ expectedUpdatedAt: current.updatedAt, supplierId, reference: "QT-QA-001", date: main.date, validUntil: "2099-12-31", deliveryDays: 4, description: "QA Supplier quotation", lines: main.items.map(item => ({ itemId: item.id, unitPrice: 125.25 })), ...patch });
  await json(`${path}/${id}/offers`, "POST", offerInput(row), 409);
  row = await action(row, "open");
  await action(created, "open", {}, 409);
  await json(`${path}/${id}/offers`, "POST", offerInput(row, main.suppliers[2].id), 400);
  await json(`${path}/${id}/offers`, "POST", offerInput(row, main.suppliers[0].id, { lines: [{ itemId: main.items[0].id, unitPrice: 1 }] }), 400);
  await json(`${path}/${id}/offers`, "POST", offerInput(row, main.suppliers[0].id, { lines: [{ itemId: foreign.items[0].id, unitPrice: 1 }, { itemId: main.items[1].id, unitPrice: 1 }] }), 400);
  await json(`${path}/${id}/offers`, "POST", offerInput(row, main.suppliers[0].id, { date: "9999-12-31" }), 400);
  await json(`${path}/${id}/offers`, "POST", offerInput(row, main.suppliers[0].id, { currency: "USD" }), 400);
  await json(`${path}/${id}/offers`, "POST", offerInput(row), 201); row = await json(`${path}/${id}`);
  assert.equal(row.offers[0].amount, "626.25"); await action(row, "propose", { offerId: row.offers[0].id, reason: "Pilihan QA" }, 409);
  const originalOfferId = row.offers[0].id;
  await json(`${path}/${id}/offers`, "POST", offerInput(row, main.suppliers[0].id, { reference: "QT-QA-001-REV", deliveryDays: 3, description: "Revisi penawaran Supplier", lines: main.items.map((item, index) => ({ itemId: item.id, unitPrice: index ? 155.35 : 110.1 })) }), 201);
  row = await json(`${path}/${id}`); assert.equal(row.offers[0].id, originalOfferId); assert.equal(row.offers[0].amount, "686.25"); assert.equal(row.offers[0].lines.length, 2);
  const revised = row.history.find(value => value.action === "OFFER_UPDATED"); assert.equal(revised.changes.before.amount, "626.25"); assert.equal(revised.changes.after.amount, "686.25");
  await json(`${path}/${id}/offers`, "POST", offerInput(row, main.suppliers[1].id, { reference: "QT-QA-002", deliveryDays: 2, lines: main.items.map(item => ({ itemId: item.id, unitPrice: 150.5 })) }), 201);
  await json(`${path}/${id}/offers`, "POST", offerInput(row), 409); row = await json(`${path}/${id}`);
  assert.deepEqual(row.offers.map(value => value.amount), ["686.25", "752.50"]);
  const foreignRfq = await json(`/companies/${foreign.company.id}/rfqs`, "POST", { ...create(foreign.source.id), supplierIds: foreign.suppliers.slice(0, 2).map(value => value.id) }, 201);
  await json(`/companies/${foreign.company.id}/rfqs/${id}`, "GET", undefined, 404);
  await rejected(tx => tx.rfqSupplier.create({ data: { companyId: main.company.id, rfqId: foreignRfq.id, supplierId: main.suppliers[2].id, supplierName: "Invalid scope" } }), "P2003");
  await rejected(tx => tx.purchaseDocument.update({ where: { id: main.source.id }, data: { supplierId: main.suppliers[1].id } }), "RFQ Purchase Request history is immutable");
  const chosen = row.offers.find(value => value.supplierId === main.suppliers[1].id);
  await action(row, "propose", { offerId: chosen.id, reason: "x" }, 400);
  row = await action(row, "propose", { offerId: chosen.id, reason: "Pengiriman lebih cepat; nilai di atas estimasi ditinjau." });
  await action(row, "approve", { reason: "Setuju pilihan" }, 409);
  await rejected(tx => tx.rfq.update({ where: { id }, data: { status: "APPROVED", reviewedBy: admin.id, reviewedAt: new Date(), reviewNote: "Invalid self Approval", revision: { increment: 1 }, updatedAt: new Date(Date.now() + 20) } }), "Rfq_review_valid");
  await json(`${path}/${id}/offers`, "POST", offerInput(row), 409);
  await rejected(tx => tx.rfqOffer.update({ where: { id: chosen.id }, data: { deliveryDays: 9 } }), "RFQ offers can change only while open");
  row = await action(row, "approve", { reason: "Supplier dan selisih biaya telah ditinjau." }, 201, reviewerCookie);
  const approved = await json(`${path}/${id}`); assert.equal(approved.reviewerName, reviewer.name); assert.equal(approved.proposedBy, admin.id);
  const orderInput = { requestKey: randomUUID(), expectedUpdatedAt: row.updatedAt, date: main.date, description: "QA approved RFQ Order" };
  // Failure of either audit must leave numbering, Order and RFQ history unchanged.
  const sequenceBefore = await prisma.documentSequence.findMany({ where: { companyId: main.company.id }, orderBy: { prefix: "asc" } });
  await prisma.$executeRawUnsafe(`CREATE FUNCTION qa_rfq_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity = 'rfq' AND NEW.action = 'ORDER_CREATED' AND NEW."companyId" = '${main.company.id}' THEN RAISE EXCEPTION 'QA forced RFQ audit rollback'; END IF; RETURN NEW; END; $$`);
  await prisma.$executeRawUnsafe('CREATE TRIGGER qa_rfq_audit_failure BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION qa_rfq_audit_failure()');
  try { await assert.rejects(() => new RfqService(prisma).order(main.company.id, admin.id, id, orderInput), error => `${error.message} ${JSON.stringify(error.meta || {})}`.includes("QA forced RFQ audit rollback")); await json(`${path}/${id}/purchase-order`, "POST", orderInput, 500); }
  finally { await prisma.$executeRawUnsafe('DROP TRIGGER qa_rfq_audit_failure ON "AuditLog"'); await prisma.$executeRawUnsafe('DROP FUNCTION qa_rfq_audit_failure()'); }
  assert.deepEqual(await prisma.documentSequence.findMany({ where: { companyId: main.company.id }, orderBy: { prefix: "asc" } }), sequenceBefore);
  assert.equal(await prisma.purchaseDocument.count({ where: { companyId: main.company.id, kind: "PURCHASE_ORDER" } }), 0);
  const orderInputs = [orderInput, { ...orderInput, requestKey: randomUUID() }], races = await Promise.all(orderInputs.map(value => request(`${path}/${id}/purchase-order`, "POST", value)));
  assert.deepEqual(races.map(value => value.status).sort(), [201, 409]); checks += 2;
  const winner = races.findIndex(value => value.status === 201), order = await races[winner].json(), winningInput = orderInputs[winner];
  assert.equal(order.rfqId, id); assert.equal(order.supplierId, main.suppliers[1].id); assert.equal(order.amount, 752.5); assert.equal(order.status, "DRAFT");
  assert.equal((await json(`${path}/${id}/purchase-order`, "POST", { ...winningInput, requestKey: winningInput.requestKey.toUpperCase() }, 201)).id, order.id);
  await json(`${path}/${id}/purchase-order`, "POST", winningInput, 409, reviewerCookie);
  await rejected(tx => tx.purchaseDocument.update({ where: { id: order.id }, data: { supplierId: main.suppliers[0].id } }), "Purchase Order must match its approved RFQ selection");
  await rejected(tx => tx.purchaseDocument.update({ where: { id: order.id }, data: { rfqId: null } }), "Purchase Order must use the approved active RFQ");
  await rejected(tx => tx.purchaseLine.update({ where: { id: order.lines[0].id }, data: { unitPrice: 1, amount: order.lines[0].quantity } }), "Purchase Order lines must match the approved RFQ offer");
  assert.equal(await prisma.stockLedger.count({ where: { companyId: main.company.id } }), 0);
  let current = order;
  for (const kind of ["PURCHASE_ORDER", "PURCHASE_RECEIPT", "PURCHASE_INVOICE", "PAYMENT"]) {
    if (kind !== "PURCHASE_ORDER") current = await json(`${main.path}/from-source`, "POST", { requestKey: randomUUID(), sourceId: current.id, kind, date: main.date, description: "QA downstream RFQ" }, 201);
    current = await json(`${main.path}/${current.id}/actions`, "POST", { action: "post", expectedUpdatedAt: current.updatedAt }, 201);
    assert.equal(current.supplierId, main.suppliers[1].id); assert.equal(current.amount, 752.5);
  }
  const balances = await prisma.stockBalance.findMany({ where: { companyId: main.company.id } }); assert.deepEqual(balances.map(value => value.quantity).sort(), [2, 3]);
  assert.deepEqual(await prisma.purchaseDocument.findUniqueOrThrow({ where: { id: main.source.id } }), sourceBefore);
  const second = await main.request(), draft = await json(path, "POST", create(second.id), 201);
  await action(draft, "cancel", { reason: "Kebutuhan sourcing berubah." });
  const replacement = await json(path, "POST", create(second.id), 201); assert.notEqual(replacement.id, draft.id);
  await action(replacement, "cancel", { reason: "Gunakan Supplier acuan semula." });
  await json(`${main.path}/from-source`, "POST", { requestKey: randomUUID(), sourceId: second.id, kind: "PURCHASE_ORDER", date: main.date, description: "" }, 201);
  const listing = await json(`${path}?pageSize=1&page=2`); assert.equal(listing.meta.total, 3); assert.equal(listing.data.length, 1);
  const exported = await json(`${path}/export?pageSize=1&page=2`); assert.equal(exported.data.length, 3); assert.equal((await json(`${path}?status=APPROVED`)).meta.total, 1);
  await action(approved, "cancel", { reason: "Cannot void an active Order" }, 409);
  await rejected(tx => tx.rfq.update({ where: { id }, data: { status: "CANCELLED", cancelReason: "Cannot void an active Order", revision: { increment: 1 }, updatedAt: new Date(Date.now() + 20) } }), "RFQ with an active Purchase Order cannot be cancelled");
  async function proposed(source, patch = {}) {
    let current = await json(path, "POST", create(source.id, patch), 201); current = await action(current, "open");
    for (const supplier of main.suppliers.slice(0, 2)) { await json(`${path}/${current.id}/offers`, "POST", offerInput(current, supplier.id, patch.date ? { date: patch.date, validUntil: patch.date } : {}), 201); current = await json(`${path}/${current.id}`); }
    return current;
  }
  let award = await proposed(await main.request());
  award = await action(award, "propose", { offerId: award.offers[0].id, reason: "Sourcing baru untuk dibatalkan." });
  award = await action(award, "approve", { reason: "Supplier ditinjau sebelum kebutuhan berubah." }, 201, reviewerCookie);
  const cancelled = await action(award, "cancel", { reason: "Kebutuhan berubah sebelum Purchase Order dibuat." });
  assert.equal(cancelled.selectedOfferId, award.selectedOfferId); assert.equal(cancelled.reviewedBy, award.reviewedBy); assert.equal(cancelled.reviewNote, award.reviewNote);
  assert.equal((await json(path, "POST", create(award.sourceId), 201)).status, "DRAFT");
  let rejectedAward = await proposed(await main.request()); rejectedAward = await action(rejectedAward, "propose", { offerId: rejectedAward.offers[0].id, reason: "Perbandingan untuk ditinjau." });
  rejectedAward = await action(rejectedAward, "reject", { reason: "Syarat Supplier perlu diperbaiki." }, 201, reviewerCookie);
  assert.equal((await json(path, "POST", create(rejectedAward.sourceId), 201)).status, "DRAFT");
  const oldDate = new Date(`${main.date}T00:00:00Z`); oldDate.setUTCDate(oldDate.getUTCDate() - 1); const expiredDate = oldDate.toISOString().slice(0, 10);
  const expired = await proposed(await main.request(expiredDate), { date: expiredDate, deadline: expiredDate });
  await action(expired, "propose", { offerId: expired.offers[0].id, reason: "Penawaran sudah kedaluwarsa." }, 409);
  let racingAward = await proposed(await main.request()); racingAward = await action(racingAward, "propose", { offerId: racingAward.offers[0].id, reason: "Uji konkurensi pembatalan." }); racingAward = await action(racingAward, "approve", { reason: "Ditinjau untuk uji konkurensi." }, 201, reviewerCookie);
  // Hold the shared row until both requests establish transaction snapshots. The
  // losing raw FOR UPDATE must produce a conflict rather than a generic HTTP 500.
  let attempts;
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Rfq" WHERE id = ${racingAward.id} FOR UPDATE`;
    attempts = Promise.all([request(`${path}/${racingAward.id}/actions`, "POST", { action: "cancel", expectedUpdatedAt: racingAward.updatedAt, reason: "Pembatalan bersamaan Order." }), request(`${path}/${racingAward.id}/purchase-order`, "POST", { requestKey: randomUUID(), expectedUpdatedAt: racingAward.updatedAt, date: main.date, description: "Race with cancellation" })]);
    await new Promise(resolve => setTimeout(resolve, 200));
  });
  const competition = await attempts;
  assert.deepEqual(competition.map(value => value.status).sort(), [201, 409]); checks += 2;
  const settled = await json(`${path}/${racingAward.id}`); assert.equal(settled.orders.filter(value => value.status !== "CANCELLED").length, settled.status === "CANCELLED" ? 0 : 1);
  await json(path, "GET", undefined, 200, viewerCookie); await json(path, "POST", create(), 403, viewerCookie);
  await prisma.company.update({ where: { id: main.company.id }, data: { status: "INACTIVE" } });
  await json(`${path}/${id}`, "GET", undefined, 200); await json(`${path}/${id}/purchase-order`, "POST", winningInput, 403);
  console.log(`RFQ passed: ${checks} HTTP/database expectations; scoped sourcing, quotation comparison, independent Approval, atomic Orders, audit rollback, concurrency, complete downstream workflow and archival.`);
} finally { for (const company of owned.reverse()) await cleanupRfqFixture(prisma, company); await prisma.$disconnect(); }
