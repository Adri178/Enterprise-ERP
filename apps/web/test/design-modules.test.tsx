import { test } from "node:test";
import assert from "node:assert/strict";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { id } from "../src/lib/i18n";
import { createDemoData } from "../src/lib/demo-data";
import { attendanceFormSchema, attendanceMinutes, checkAttendanceUnique, leadFormSchema, leadSchema, offerTotal, rfqFormSchema, rfqSchema, selectOffer, transitionLead, type Attendance, type Lead, type Rfq } from "../src/lib/design/models";
import { attendanceFixtures, leadFixtures, rfqFixtures } from "../src/lib/design/fixtures";
import { designStorageKey, parseDesignRecords } from "../src/lib/design/use-design-records";
import { LeadsPage } from "../src/components/design/leads-page";
import { RfqPage } from "../src/components/design/rfq-page";
import { AttendancePage } from "../src/components/design/attendance-page";
import { WorkspaceProvider, useWorkspace } from "../src/components/workspace-provider";

const d = id.design, companies = createDemoData().companies, alpha = companies.find(company => company.id === "alpha")!, beta = companies.find(company => company.id === "beta")!;
test("design validation rejects invalid identity/contact, duplicate RFQ Items and missing Suppliers", () => {
  const lead = leadFixtures(alpha)[0], rfq = rfqFixtures(alpha)[0];
  assert.equal(leadFormSchema.safeParse({ ...lead, contact: " ", email: "invalid" }).success, false);
  assert.equal(rfqFormSchema.safeParse({ ...rfq, lines: [rfq.lines[0], rfq.lines[0]] }).success, false);
  assert.equal(rfqFormSchema.safeParse({ ...rfq, supplierIds: [] }).success, false);
  assert.equal(rfqFormSchema.safeParse({ ...rfq, deadline: "2026-02-30" }).success, false);
});
test("RFQ comparison uses quantities and blocks selection without an invited complete offer", () => {
  const draft = rfqFixtures(alpha)[0], sent = rfqFixtures(alpha)[1];
  assert.equal(offerTotal(sent, sent.offers[0]), 5700000);
  assert.throws(() => selectOffer(draft, "mitra"));
  assert.throws(() => selectOffer(sent, "nusantara"));
  assert.equal(rfqSchema.safeParse({ ...sent, offers: [{ ...sent.offers[0], prices: [] }] }).success, false);
  const selected = selectOffer(sent, "mitra");
  assert.equal(selected.status, "SELECTED");
  assert.equal(selected.selectedSupplierId, "mitra");
  assert.throws(() => selectOffer(selected, "sentosa"));
  assert.equal(sent.status, "SENT", "the source fixture is not mutated");
});
test("Attendance validates clock order, nonworking statuses, real dates and duplicate Employee dates", () => {
  const row = attendanceFixtures(alpha)[0], input = { ...row, reason: "" };
  assert.equal(attendanceMinutes(row), 540);
  assert.equal(attendanceFormSchema.safeParse({ ...input, checkOut: "07:59" }).success, false);
  assert.equal(attendanceFormSchema.safeParse({ ...input, status: "LEAVE" }).success, false);
  assert.equal(attendanceFormSchema.safeParse({ ...input, date: "2026-02-30" }).success, false);
  assert.throws(() => checkAttendanceUnique([row], input));
  assert.doesNotThrow(() => checkAttendanceUnique([row], input, row.id));
});
test("design storage isolates Company records and refuses malformed or cross-company persisted data", () => {
  const rows = leadFixtures(alpha);
  assert.notEqual(designStorageKey("leads", alpha.id), designStorageKey("leads", beta.id));
  assert.deepEqual(parseDesignRecords(leadSchema, JSON.stringify(rows), alpha.id), rows);
  assert.throws(() => parseDesignRecords(leadSchema, JSON.stringify(rows), beta.id));
  assert.throws(() => parseDesignRecords(leadSchema, "invalid json", alpha.id));
  assert.throws(() => parseDesignRecords(leadSchema, JSON.stringify([rows[0], rows[0]]), alpha.id));
  assert.throws(() => transitionLead({ ...rows[0], status: "QUALIFIED" }, "CONTACTED"));
});

function Switcher() {
  const workspace = useWorkspace();
  return <nav>{["alpha", "beta", "gamma"].map(company => <button key={company} onClick={() => workspace.switchCompany(company)}>{company}</button>)}</nav>;
}
async function waitFor(check: () => boolean) {
  for (let i = 0; i < 100; i++) { if (check()) return; await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); }); }
  throw new Error(`Design UI did not settle: ${document.body.textContent?.slice(-1800)}`);
}
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!;
const button = (name: string, parent: ParentNode = document) => Array.from(parent.querySelectorAll<HTMLButtonElement>("button")).find(button => button.textContent?.trim() === name)!;
async function click(name: string, parent?: ParentNode) { const target = button(name, parent); assert.ok(target, `Button ${name}`); await act(async () => target.click()); }
async function fill(selector: string, value: string) {
  const element = document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector)!;
  assert.ok(element, selector);
  await act(async () => {
    const prototype = element.tagName === "SELECT" ? window.HTMLSelectElement.prototype : element.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new window.Event("input", { bubbles: true }));
    element.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
}
async function render(children: ReactNode, prepare?: () => void) {
  localStorage.clear();
  prepare?.();
  const root = createRoot(document.getElementById("root")!);
  await act(async () => root.render(<WorkspaceProvider><Switcher />{children}</WorkspaceProvider>));
  await waitFor(() => !document.querySelector('[role="status"]'));
  return root;
}
function stored<T>(kind: string, company = "alpha"): T[] { return JSON.parse(localStorage.getItem(designStorageKey(kind, company)) || "[]"); }

test("Leads form persists data and stages; Company switch closes dialogs and enforces Gamma read-only", async () => {
  const root = await render(<LeadsPage />);
  try {
    await click(`${d.add} Lead`);
    await fill("#lead-contact", "QA Lead Alpha"); await fill("#lead-organization", "QA Organisasi");
    await click(id.save, dialog());
    await waitFor(() => stored<Lead>("leads").some(row => row.contact === "QA Lead Alpha"));
    const record = stored<Lead>("leads").find(row => row.contact === "QA Lead Alpha")!;
    await click(record.number); await click(d.contactLead, dialog());
    await waitFor(() => stored<Lead>("leads").find(row => row.id === record.id)?.status === "CONTACTED");
    await click("beta"); await waitFor(() => !dialog() && document.body.textContent!.includes(beta.name));
    assert.ok(!document.body.textContent?.includes("QA Lead Alpha"));
    assert.equal(localStorage.getItem(designStorageKey("leads", "beta")), null, "reading fixtures does not write another Company");
    await click("gamma"); await waitFor(() => button(`${d.add} Lead`).disabled);
    assert.ok(document.body.textContent?.includes(d.readOnly));
    await click("alpha"); await waitFor(() => !!button(record.number));
    assert.ok(document.body.textContent?.includes("QA Lead Alpha"));
  } finally { await act(async () => root.unmount()); }
});
test("RFQ detail compares offers, confirms a Supplier and preserves the selected demo state", async () => {
  const root = await render(<RfqPage />);
  try {
    await click(rfqFixtures(alpha)[1].number);
    assert.ok(dialog().textContent?.includes(d.lowest));
    await click(d.selectSupplier, dialog());
    assert.ok(dialog().textContent?.includes(d.selectHint));
    await click(id.confirm, dialog());
    await waitFor(() => stored<Rfq>("rfq").some(row => row.status === "SELECTED"));
    const selected = stored<Rfq>("rfq").find(row => row.status === "SELECTED")!;
    assert.equal(selected.selectedSupplierId, "mitra");
    assert.ok(!button(d.selectSupplier, dialog()));
    assert.ok(dialog().querySelector('a[href="/purchase-orders"]'));
    await click("beta"); await waitFor(() => !dialog() && document.body.textContent!.includes(beta.name));
    assert.ok(!stored<Rfq>("rfq", "beta").length);
  } finally { await act(async () => root.unmount()); }
});
test("Attendance corrections require a reason, persist before/after history and reject duplicate dates", async () => {
  const root = await render(<AttendancePage />);
  try {
    await click(attendanceFixtures(alpha)[0].number); await click(d.correction, dialog());
    await fill("#attendance-out", "18:00");
    await click(id.save, dialog());
    await waitFor(() => !!dialog()?.textContent?.includes(d.correctionReasonRequired));
    assert.equal(stored<Attendance>("attendance").length, 0);
    await fill("#attendance-reason", "Koreksi jam pulang sesuai catatan demo"); await click(id.save, dialog());
    await waitFor(() => stored<Attendance>("attendance")[0]?.corrections.length === 1);
    const saved = stored<Attendance>("attendance")[0];
    assert.equal(saved.checkOut, "18:00"); assert.equal(saved.corrections[0].before.checkOut, "17:00"); assert.equal(saved.corrections[0].after.checkOut, "18:00");
    await click(`${d.add} ${d.attendance}`); await click(id.save, dialog());
    await waitFor(() => !!dialog()?.textContent?.includes(d.attendanceDuplicate));
    assert.equal(stored<Attendance>("attendance").length, 3);
    await click("gamma"); await waitFor(() => !dialog() && button(`${d.add} ${d.attendance}`).disabled);
  } finally { await act(async () => root.unmount()); }
});

test("RFQ form creates multiple Item requirements and records a complete Supplier quotation", async () => {
  const root = await render(<RfqPage />);
  try {
    await click(`${d.add} RFQ`);
    await fill("#rfq-title", "QA Kebutuhan Kemasan");
    await click(d.addLine, dialog());
    await fill("#rfq-qty-0", "10"); await fill("#rfq-qty-1", "5");
    await act(async () => dialog().querySelector<HTMLInputElement>('input[type="checkbox"][value="nusantara"]')!.click());
    await click(id.save, dialog());
    await waitFor(() => stored<Rfq>("rfq").some(row => row.title === "QA Kebutuhan Kemasan"));
    const created = stored<Rfq>("rfq").find(row => row.title === "QA Kebutuhan Kemasan")!;
    assert.equal(created.lines.length, 2); assert.deepEqual(created.supplierIds, ["nusantara"]);
    await click(created.number); await click(d.rfqSend, dialog());
    await click(d.offerRecord, dialog());
    await fill("#offer-reference", "DEMO-QA-OFFER-001");
    await fill("#offer-price-0", "2500"); await fill("#offer-price-1", "15000");
    await click(id.save, dialog());
    await waitFor(() => stored<Rfq>("rfq").find(row => row.id === created.id)?.offers.length === 1);
    const saved = stored<Rfq>("rfq").find(row => row.id === created.id)!;
    assert.equal(offerTotal(saved, saved.offers[0]), 100000);
  } finally { await act(async () => root.unmount()); }
});

test("corrupt storage recovers through retry and denied writes leave the form and saved rows intact", async () => {
  const key = designStorageKey("leads", alpha.id);
  const root = await render(<LeadsPage />, () => localStorage.setItem(key, "corrupt"));
  const prototype = Object.getPrototypeOf(localStorage), descriptor = Object.getOwnPropertyDescriptor(prototype, "setItem")!;
  try {
    await waitFor(() => !!document.querySelector('[role="alert"]'));
    assert.equal(localStorage.getItem(key), "corrupt");
    assert.ok(button(`${d.add} Lead`).disabled);
    localStorage.setItem(key, JSON.stringify(leadFixtures(alpha)));
    await click(id.retry);
    await waitFor(() => !!button(leadFixtures(alpha)[0].number));
    assert.ok(!button(`${d.add} Lead`).disabled);
    const before = localStorage.getItem(key);
    await click(`${d.add} Lead`); await fill("#lead-contact", "Denied write"); await fill("#lead-organization", "QA Organisasi");
    Object.defineProperty(prototype, "setItem", { ...descriptor, value: function (this: Storage, name: string, value: string) { if (name === key) throw new Error("QuotaExceededError"); return descriptor.value.call(this, name, value); } });
    await click(id.save, dialog());
    await waitFor(() => !!dialog()?.textContent?.includes(d.saveError));
    assert.equal(localStorage.getItem(key), before);
    assert.equal((document.querySelector("#lead-contact") as HTMLInputElement).value, "Denied write");
  } finally { Object.defineProperty(prototype, "setItem", descriptor); await act(async () => root.unmount()); }
});
