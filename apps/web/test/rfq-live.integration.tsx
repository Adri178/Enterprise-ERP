import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { PrismaClient } from "@prisma/client";
import type { Company, MasterRecord, PurchaseDocument } from "@erp/shared";
import { WorkspaceProvider, useWorkspace } from "../src/components/workspace-provider";
import { RfqPage } from "../src/components/rfq-page";
import { id } from "../src/lib/i18n";
const t = id.rfq;
async function json(path: string, method = "GET", body?: unknown, status = 200) {
  let value: Awaited<ReturnType<Response["json"]>>;
  await act(async () => { const response = await fetch(`/api${path}`, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) }); value = await response.json(); assert.equal(response.status, status, `${path}: ${JSON.stringify(value)}`); });
  return value;
}
async function waitFor(check: () => boolean) {
  for (let i = 0; i < 200; i++) { if (check()) { await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); }); if (check()) return; } await act(async () => { await new Promise(resolve => setTimeout(resolve, 35)); }); }
  throw new Error(`RFQ live UI did not settle: ${document.body.textContent?.slice(-2200)}`);
}
const dialog = () => Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).at(-1)!;
const button = (name: string, parent: ParentNode = document) => Array.from(parent.querySelectorAll<HTMLButtonElement>("button")).find(value => value.textContent?.trim() === name)!;
async function click(name: string, parent?: ParentNode) { assert.ok(button(name, parent), name); await act(async () => button(name, parent).click()); }
async function fill(selector: string, value: string) {
  const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!; assert.ok(input, selector);
  await act(async () => { Object.getOwnPropertyDescriptor(input.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new window.Event("input", { bubbles: true })); input.dispatchEvent(new window.Event("change", { bubbles: true })); });
}
async function select(label: string, name: string) {
  const control = Array.from(dialog().querySelectorAll<HTMLButtonElement>('[role="combobox"]')).find(value => document.getElementById(value.getAttribute("aria-labelledby")!)?.textContent?.includes(label)); assert.ok(control, label);
  await act(async () => control.click()); await waitFor(() => Array.from(dialog().querySelectorAll("button")).some(value => value.textContent?.includes(name)));
  await act(async () => Array.from(dialog().querySelectorAll("button")).find(value => value.textContent?.includes(name))!.click());
}
function Controls() { const { switchCompany } = useWorkspace(); return <button onClick={() => switchCompany("gamma")}>Gamma QA</button>; }
type Fixture = { company: Company; suppliers: MasterRecord[]; items: MasterRecord[]; date: string; source: PurchaseDocument; request: () => Promise<PurchaseDocument> };
test("RFQ web selects real requirements/Suppliers, compares offers, requires another reviewer and creates a linked real Order", async () => {
  const { createRfqFixture, cleanupRfqFixture } = await import(pathToFileURL(resolve("scripts/rfq-test-fixtures.mjs")).href);
  const { setLiveSession, restoreLiveSession } = await import(pathToFileURL(resolve("scripts/live-ui-test-setup.mjs")).href);
  const prisma = new PrismaClient(), root = createRoot(document.getElementById("root")!);
  let company: Company | undefined, csv: Blob | undefined, release: (() => void) | undefined;
  const nativeFetch = globalThis.fetch, nativeCreate = URL.createObjectURL, nativeRevoke = URL.revokeObjectURL, nativeClick = window.HTMLAnchorElement.prototype.click;
  try {
    const user = await json("/auth/me"), handle = await createRfqFixture(json, "U"); company = handle.company;
    const fixture = await handle.prepare() as Fixture, path = `/companies/${company!.id}/rfqs`;
    const reviewer = await prisma.user.findUniqueOrThrow({ where: { email: "reviewer@enterprise.local" } });
    await prisma.membership.create({ data: { companyId: company!.id, userId: reviewer.id, role: "MANAGER" } });
    localStorage.clear(); localStorage.setItem(`enterprise-erp-active:${user.id}`, company!.id);
    const scene = (context: string, params = new URLSearchParams()) => <SearchParamsContext.Provider value={params}><WorkspaceProvider key={context}><Controls /><RfqPage /></WorkspaceProvider></SearchParamsContext.Provider>;
    await act(async () => root.render(scene("admin"))); await waitFor(() => !!button(t.add) && !button(t.add).disabled && !!document.body.textContent?.includes(t.empty));
    await click(t.add); await select(t.source, fixture.source.number); await click(id.save, dialog());
    await waitFor(() => !!dialog().textContent?.includes("Pilih minimal dua Supplier")); assert.equal(await prisma.rfq.count({ where: { companyId: company!.id } }), 0);
    await fill("#rfq-deadline", "2099-12-31");
    for (const supplier of fixture.suppliers.slice(0, 2)) await select(t.addSupplier, supplier.name);
    await click(id.save, dialog()); await waitFor(() => !!button(t.open, dialog()));
    const stored = await prisma.rfq.findFirstOrThrow({ where: { companyId: company!.id } }); assert.equal(stored.sourceId, fixture.source.id);
    assert.ok(!dialog().textContent?.includes(id.design.title));
    await click(t.open, dialog()); await click(id.confirm, dialog());
    await waitFor(() => dialog().textContent?.includes(`${fixture.suppliers[0].name} · ${t.recordOffer}`) === true);
    for (let index = 0; index < 2; index++) {
      await click(`${fixture.suppliers[index].name} · ${t.recordOffer}`, dialog());
      await fill("#rfq-offer-ref", `QT-UI-${index + 1}`);
      if (index === 0) { await fill("#rfq-price-0", "0"); await click(t.saveOffer, dialog()); await waitFor(() => document.querySelector("#rfq-price-0")?.getAttribute("aria-invalid") === "true"); assert.equal(await prisma.rfqOffer.count({ where: { companyId: company!.id } }), 0); }
      await fill("#rfq-price-0", index ? "150.5" : "125.25"); await fill("#rfq-price-1", index ? "150.5" : "125.25");
      await click(t.saveOffer, dialog()); await waitFor(() => !document.querySelector("#rfq-offer-ref") && !!dialog()?.textContent?.includes(`QT-UI-${index + 1}`));
    }
    const comparison = dialog().querySelector<HTMLTableElement>(`table[aria-label="${t.offers}"]`)!;
    assert.equal(comparison.querySelectorAll("tbody tr").length, 2);
    const supplierRow = Array.from(comparison.querySelectorAll("tbody tr")).find(value => value.textContent?.includes(fixture.suppliers[1].name))!;
    await click(t.propose, supplierRow); await fill("#rfq-reason", "Pengiriman lebih cepat; harga di atas estimasi ditinjau."); await click(id.confirm, dialog());
    await waitFor(() => !!button(t.approve, dialog())?.disabled && !!dialog().textContent?.includes(t.differentReviewer));
    assert.equal((await prisma.rfq.findUniqueOrThrow({ where: { id: stored.id } })).proposedBy, user.id);
    await act(async () => { await setLiveSession(reviewer.email); }); localStorage.setItem(`enterprise-erp-active:${reviewer.id}`, company!.id);
    await act(async () => root.render(scene("reviewer"))); await waitFor(() => !!button(stored.number)); await click(stored.number);
    await waitFor(() => !!button(t.approve, dialog()) && !button(t.approve, dialog()).disabled);
    await click(t.approve, dialog()); await fill("#rfq-reason", "Supplier dan harga telah ditinjau oleh reviewer UI."); await click(id.confirm, dialog());
    await waitFor(() => !!button(t.order, dialog())); await click(t.order, dialog()); await click(id.confirm, dialog());
    await waitFor(() => !!dialog()?.textContent?.includes("PO-") && !!button(id.postDocument, dialog()));
    const order = await prisma.purchaseDocument.findFirstOrThrow({ where: { companyId: company!.id, kind: "PURCHASE_ORDER" } }); assert.equal(order.rfqId, stored.id); assert.equal(order.supplierId, fixture.suppliers[1].id); assert.equal(order.amount.toFixed(2), "752.50");
    await click(id.close, dialog());
    await act(async () => { restoreLiveSession(); }); localStorage.setItem(`enterprise-erp-active:${user.id}`, company!.id);
    await act(async () => root.render(scene("admin-return", new URLSearchParams({ sourceId: fixture.source.id })))); await waitFor(() => !button(t.export).disabled && document.querySelectorAll("tbody tr").length === 1);
    URL.createObjectURL = value => { csv = value as Blob; return "blob:rfq-test"; }; URL.revokeObjectURL = () => {}; window.HTMLAnchorElement.prototype.click = () => {};
    await click(t.export); await waitFor(() => !!csv); assert.equal((await csv!.text()).trim().split("\r\n").length, 2);
    await waitFor(() => !button(t.export).disabled); csv = undefined;
    globalThis.fetch = async (input, options) => { const response = await nativeFetch(input, options); if (String(input).includes(`${path}/export`)) await new Promise<void>(resolve => { release = resolve; }); return response; };
    await click(t.export); await waitFor(() => !!release); await click("Gamma QA"); await waitFor(() => !!button(t.add)?.disabled && document.body.textContent?.includes(t.readOnly) === true);
    await act(async () => { release!(); await new Promise(resolve => setTimeout(resolve, 40)); }); assert.equal(csv, undefined); assert.ok(!dialog()); assert.ok(!document.body.textContent?.includes(stored.number)); assert.equal(button(id.reset), undefined, "prior Company URL-selected Request must be cleared");
  } finally {
    release?.(); globalThis.fetch = nativeFetch; URL.createObjectURL = nativeCreate; URL.revokeObjectURL = nativeRevoke; window.HTMLAnchorElement.prototype.click = nativeClick; restoreLiveSession();
    await act(async () => root.unmount()); if (company) await cleanupRfqFixture(prisma, company); await prisma.$disconnect();
  }
});
