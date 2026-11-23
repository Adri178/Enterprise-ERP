import { test } from "node:test";
import assert from "node:assert/strict";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { PrismaClient } from "@prisma/client";
import { BomsPage } from "../src/components/boms-page";
import { WorkOrdersPage } from "../src/components/work-orders-page";
import { ProductionPlanPage } from "../src/components/production-plan-page";
import { StockLedgerPage } from "../src/components/stock-ledger-page";
import { WorkspaceProvider, useWorkspace } from "../src/components/workspace-provider";
import { id } from "../src/lib/i18n";
async function json(path: string, method = "GET", body?: unknown) {
  let result: Awaited<ReturnType<Response["json"]>>;
  await act(async () => { const r = await fetch(`/api${path}`, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) }); result = await r.json(); assert.ok(r.ok, `${path}: ${JSON.stringify(result)}`); }); return result;
}
const dialog = () => Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).at(-1)!;
const button = (text: string, parent: ParentNode = document) => Array.from(parent.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent?.trim() === text)!;
async function click(text: string, parent?: ParentNode) { assert.ok(button(text, parent), text); await act(async () => button(text, parent).click()); }
async function waitFor(check: () => boolean) { for (let n = 0; n < 250; n++) { if (check()) return; await act(async () => { await new Promise((r) => setTimeout(r, 40)); }); } throw new Error(`Manufacturing UI did not settle: ${document.body.textContent?.slice(-2500)}`); }
async function input(label: string, text: string, parent: ParentNode = dialog()) {
  const target = parent.querySelector(`[aria-label="${label}"]`) || Array.from(parent.querySelectorAll("label")).find((l) => l.textContent?.startsWith(label))?.querySelector("input,textarea,select"); assert.ok(target, label);
  await act(async () => { const proto = target.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : target.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(target, text); target.dispatchEvent(new window.Event("input", { bubbles: true })); target.dispatchEvent(new window.Event("change", { bubbles: true })); });
}
async function pick(label: string, name: string) {
  const parent = dialog(), trigger = Array.from(parent.querySelectorAll<HTMLButtonElement>('[role="combobox"]')).find((b) => parent.querySelector(`[id="${b.getAttribute("aria-labelledby")}"]`)?.textContent?.startsWith(label)); assert.ok(trigger, label);
  await act(async () => trigger.click()); await waitFor(() => !!Array.from(dialog().querySelectorAll("button")).find((b) => b.textContent?.includes(name)));
  await act(async () => Array.from(dialog().querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent?.includes(name))!.click());
}
async function submit() { await act(async () => { dialog().querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); }); }
const params = new URLSearchParams();
function Controls() { const { switchCompany } = useWorkspace(); return <button onClick={() => switchCompany("gamma")}>QA Gamma</button>; }
function Scene() {
  const [page, setPage] = useState("boms");
  return <SearchParamsContext.Provider value={params}><WorkspaceProvider><Controls />{["boms", "orders", "plan", "ledger"].map((p) => <button key={p} onClick={() => setPage(p)}>{`QA ${p}`}</button>)}{page === "boms" ? <BomsPage /> : page === "orders" ? <WorkOrdersPage /> : page === "plan" ? <ProductionPlanPage /> : <StockLedgerPage ledger />}</WorkspaceProvider></SearchParamsContext.Provider>;
}
test("Manufacturing UI edits and activates BOM, releases Work Order, shows material shortage, prevents partial posting, completes production and opens its Stock source", async () => {
  const prisma = new PrismaClient(), code = `MU${Date.now().toString(36).toUpperCase()}`, root = createRoot(document.getElementById("root")!); let companyId: string | undefined;
  try {
    const user = await json("/auth/me"), company = await json("/companies", "POST", { code, name: `QA Manufacturing ${code}`, industry: "Pengujian", city: "Jakarta", currency: "IDR", status: "ACTIVE", address: "", email: "", phone: "", taxId: "" }); companyId = company.id;
    const path = `/companies/${companyId}`, master = (kind: string, code: string, extra = {}) => json(path + `/master/${kind}`, "POST", { code, name: `QA ${code}`, category: "Manufacturing", email: "", phone: "", description: "", status: "ACTIVE", ...extra });
    const branch = await master("branches", "BR", { city: "Jakarta" }), warehouse = await master("warehouses", "WH", { branchId: branch.id });
    const a = await master("items", "RAW-A", { unit: "pcs", purchasePrice: 0, sellingPrice: 0, trackStock: true, reorderLevel: 0 }), b = await master("items", "RAW-B", { unit: "pcs", purchasePrice: 0, sellingPrice: 0, trackStock: true, reorderLevel: 0 }), output = await master("items", "FG", { unit: "pcs", purchasePrice: 0, sellingPrice: 0, trackStock: true, reorderLevel: 0 });
    const receive = async (lines: { itemId: string; quantity: number; unitPrice: number }[], date = "2026-10-01") => { const r = await json(path + "/stock/operations", "POST", { requestKey: crypto.randomUUID(), kind: "ADJUSTMENT", date, warehouseId: warehouse.id, targetWarehouseId: "", description: "QA Manufacturing material receipt", lines }); await json(path + `/stock/operations/${r.id}/actions`, "POST", { action: "post", expectedUpdatedAt: r.updatedAt }); };
    await receive([{ itemId: a.id, quantity: 5, unitPrice: 3.33 }, { itemId: b.id, quantity: 1, unitPrice: 2 }]);
    localStorage.clear(); localStorage.setItem(`enterprise-erp-active:${user.id}`, companyId!); await act(async () => root.render(<Scene />));
    await waitFor(() => !!button(id.createDocument(id.bom)) && !button(id.createDocument(id.bom)).disabled);
    await click(id.createDocument(id.bom)); await input(id.bomCode, "BOM-UI"); await input(id.bomName, "QA UI Assembly"); await pick(id.outputItem, "QA FG"); await pick(`${id.materialItem} 1`, "QA RAW-A"); await input(`${id.materialQuantity} 1`, "2"); await click(id.addLine, dialog()); await pick(`${id.materialItem} 2`, "QA RAW-B"); await submit();
    await waitFor(() => !!button(id.bomActivate, dialog())); await click(id.edit, dialog()); await waitFor(() => !!dialog().querySelector("form")); await input(id.bomName, "QA UI Assembly revised"); await submit(); await waitFor(() => !!button(id.bomActivate, dialog())); await click(id.bomActivate, dialog()); await click(id.confirm, dialog()); await waitFor(() => !!button(id.bomRetire, dialog())); await click(id.close, dialog());
    await click("QA orders"); await waitFor(() => !!button(id.createDocument(id.workOrder))); await click(id.createDocument(id.workOrder)); await pick(id.bom, "BOM-UI"); await input(id.batches, "2"); await input(id.productionDate, "2026-10-01"); await pick(id.productionWarehouse, "QA WH"); await input(id.description, "QA UI production"); await submit();
    await waitFor(() => !!button(id.workOrderRelease, dialog())); const number = dialog().querySelector("h2")!.textContent!; await click(id.close, dialog());
    await click("QA plan"); await waitFor(() => !!document.body.textContent?.includes(id.productionPlanEmpty));
    await click("QA orders"); await waitFor(() => !!button(number)); await click(number); await waitFor(() => !!button(id.workOrderRelease, dialog())); await click(id.workOrderRelease, dialog()); await click(id.confirm, dialog()); await waitFor(() => !!button(id.workOrderComplete, dialog())); await click(id.close, dialog());
    await click("QA plan");
    // The report defaults to the current month; this workflow deliberately uses October fixtures.
    await input(id.reportFrom, "2026-10-01", document); await input(id.reportTo, "2026-10-31", document); await click(id.apply);
    await waitFor(() => document.querySelectorAll("tbody tr").length === 2);
    const bRow = Array.from(document.querySelectorAll("tbody tr")).find((r) => r.textContent?.includes("RAW-B"))!; assert.equal(bRow.querySelector("td:last-child")!.textContent, "1");
    await input(id.reportTo, "2026-09-01", document); await click(id.apply); assert.ok(document.querySelector('[role="alert"]')); assert.equal(document.querySelectorAll("tbody tr").length, 2);
    await click("QA orders"); await waitFor(() => !!button(number)); await click(number); await waitFor(() => !!button(id.workOrderComplete, dialog())); await click(id.workOrderComplete, dialog()); await input(id.productionPostingDate, "2026-10-02");
    const before = await prisma.stockBalance.findMany({ where: { companyId }, orderBy: { id: "asc" } }); await click(id.confirm, dialog()); await waitFor(() => !!dialog().querySelector('[role="alert"]')); assert.match(dialog().textContent || "", /Stock tidak mencukupi/); assert.deepEqual(await prisma.stockBalance.findMany({ where: { companyId }, orderBy: { id: "asc" } }), before);
    await receive([{ itemId: b.id, quantity: 1, unitPrice: 2 }], "2026-10-02"); await click(id.confirm, dialog()); await waitFor(() => !!dialog()?.textContent?.includes(id.completed) && !!dialog().querySelector('a[href="/stock-movement"]'));
    const completed = (await json(path + `/manufacturing/work-orders?q=${encodeURIComponent(number)}`)).data[0]; assert.equal(completed.amount, 17.32); assert.equal(completed.outputQuantity, 2); await click(id.close, dialog());
    const balances = await prisma.stockBalance.findMany({ where: { companyId } }); assert.equal(balances.find((r) => r.itemId === output.id)?.value.toFixed(2), "17.32"); assert.equal(balances.find((r) => r.itemId === a.id)?.quantity, 1);
    await click("QA plan"); await waitFor(() => !!document.body.textContent?.includes(id.productionPlanEmpty));
    await click("QA ledger"); await waitFor(() => !!button(number)); await click(number); await waitFor(() => !!dialog()?.textContent?.includes(id.productionOutput)); assert.ok(dialog().textContent?.includes(number));
    await click("QA Gamma"); assert.equal(document.querySelectorAll('[role="dialog"]').length, 0); assert.equal(document.querySelectorAll("tbody tr").length, 0);
    await click("QA orders"); await waitFor(() => !!button(id.createDocument(id.workOrder)) && button(id.createDocument(id.workOrder)).disabled); assert.ok(!document.body.textContent?.includes("QA UI Assembly"));
  } finally {
    await act(async () => root.unmount()); localStorage.clear();
    if (companyId) { assert.equal((await prisma.company.findUnique({ where: { id: companyId } }))?.code, code); await prisma.$transaction(async (tx) => { await tx.stockLedger.deleteMany({ where: { companyId } }); await tx.stockBalance.deleteMany({ where: { companyId } }); await tx.workOrderLine.deleteMany({ where: { companyId } }); await tx.workOrder.deleteMany({ where: { companyId } }); await tx.bomLine.deleteMany({ where: { companyId } }); await tx.billOfMaterials.deleteMany({ where: { companyId } }); await tx.stockOperationLine.deleteMany({ where: { companyId } }); await tx.stockOperation.deleteMany({ where: { companyId } }); await tx.documentSequence.deleteMany({ where: { companyId } }); await tx.masterRecord.deleteMany({ where: { companyId, kind: "warehouses" } }); await tx.masterRecord.deleteMany({ where: { companyId } }); await tx.auditLog.deleteMany({ where: { companyId } }); await tx.membership.deleteMany({ where: { companyId } }); await tx.company.delete({ where: { id: companyId } }); }); } await prisma.$disconnect();
  }
});
