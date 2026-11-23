import { test } from "node:test";
import assert from "node:assert/strict";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { PrismaClient } from "@prisma/client";
import { AccountsPage } from "../src/components/accounts-page";
import { JournalsPage } from "../src/components/journals-page";
import { AccountingReportsPage } from "../src/components/accounting-reports-page";
import { WorkspaceProvider, useWorkspace } from "../src/components/workspace-provider";
import { id } from "../src/lib/i18n";
async function json(path: string, method = "GET", body?: unknown) {
  let result: Awaited<ReturnType<Response["json"]>>;
  await act(async () => {
    const r = await fetch(`/api${path}`, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    result = await r.json(); assert.ok(r.ok, `${path}: ${JSON.stringify(result)}`);
  }); return result;
}
const dialog = () => Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).at(-1)!;
const button = (text: string, parent: ParentNode = document) => Array.from(parent.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent?.trim() === text)!;
async function click(text: string, parent?: ParentNode) { assert.ok(button(text, parent), text); await act(async () => button(text, parent).click()); }
async function waitFor(check: () => boolean) {
  for (let n = 0; n < 250; n++) { if (check()) return; await act(async () => { await new Promise((r) => setTimeout(r, 40)); }); }
  throw new Error(`Accounting UI did not settle: ${document.body.textContent?.slice(-2500)}`);
}
async function value(target: Element, text: string) {
  await act(async () => {
    const proto = target.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : target.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(target, text);
    target.dispatchEvent(new window.Event("input", { bubbles: true })); target.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
}
async function input(label: string, text: string, parent: ParentNode = dialog()) {
  const target = Array.from(parent.querySelectorAll("label")).find((l) => l.textContent?.startsWith(label))?.querySelector("input,textarea,select") || parent.querySelector(`[aria-label="${label}"]`);
  assert.ok(target, label); await value(target, text);
}
async function submit() { await act(async () => { dialog().querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); }); }
async function pick(name: string, index = 0) {
  await act(async () => { dialog().querySelectorAll<HTMLButtonElement>('[role="combobox"]')[index].click(); });
  await waitFor(() => !!Array.from(dialog().querySelectorAll("button")).find((b) => b.textContent?.includes(name)));
  await act(async () => Array.from(dialog().querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent?.includes(name))!.click());
}
function Scene({ cashId }: { cashId: string }) {
  const [page, setPage] = useState("accounts");
  const params = new URLSearchParams(`accountId=${cashId}&from=2026-10-01&to=2026-10-31`);
  return <SearchParamsContext.Provider value={params}><WorkspaceProvider><Controls />{["accounts", "journals", "ledger", "trial"].map((p) => <button key={p} onClick={() => setPage(p)}>{`QA ${p}`}</button>)}{page === "accounts" ? <AccountsPage /> : page === "journals" ? <JournalsPage /> : <AccountingReportsPage kind={page === "ledger" ? "ledger" : "trial"} />}</WorkspaceProvider></SearchParamsContext.Provider>;
}
function Controls() { const { switchCompany } = useWorkspace(); return <button onClick={() => switchCompany("alpha")}>QA Alpha</button>; }
test("Accounting UI creates an Account and balanced Journal, edits draft, posts, exports every ledger page, reverses and isolates Company context", async () => {
  const prisma = new PrismaClient(), code = `AQ${Date.now().toString(36).toUpperCase()}`, root = createRoot(document.getElementById("root")!);
  let companyId: string | undefined, exported: Blob | undefined;
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL, anchorClick = window.HTMLAnchorElement.prototype.click;
  URL.createObjectURL = (blob) => { exported = blob as Blob; return "blob:qa-accounting"; }; URL.revokeObjectURL = () => {}; window.HTMLAnchorElement.prototype.click = () => {};
  try {
    const user = await json("/auth/me"), company = await json("/companies", "POST", { code, name: `QA Accounting ${code}`, industry: "Pengujian", city: "Jakarta", currency: "IDR", status: "ACTIVE", address: "", email: "", phone: "", taxId: "" });
    companyId = company.id; const path = `/companies/${companyId}/accounting`;
    const account = (code: string, name: string, type: string, parentId = "") => json(path + "/accounts", "POST", { code, name, type, isGroup: !parentId, parentId, status: "ACTIVE" });
    const assets = await account("10", "QA Assets", "ASSET"), equity = await account("30", "QA Equity", "EQUITY");
    const bank = await account("1200", "QA Bank", "ASSET", assets.id), capital = await account("3100", "QA Capital", "EQUITY", equity.id);
    localStorage.clear(); localStorage.setItem(`enterprise-erp-active:${user.id}`, companyId!);
    await act(async () => root.render(<Scene cashId="" />));
    await waitFor(() => !!button(id.addRecord(id.account)) && !button(id.addRecord(id.account)).disabled);
    await click(id.addRecord(id.account)); await input(id.accountCode, "1100"); await input(id.accountName, "QA Cash"); await pick("QA Assets"); await submit();
    await waitFor(() => !dialog() && !!button("QA Cash"));
    const cash = (await json(path + "/accounts?q=1100")).data[0];
    await act(async () => root.render(<Scene cashId={cash.id} />));
    await click("QA journals"); await waitFor(() => !!button(id.createDocument(id.journalEntry)));
    await click(id.createDocument(id.journalEntry)); await input(id.date, "2026-10-02"); await input(id.description, "QA UI capital journal");
    await pick("QA Cash", 0); await input(`${id.debit} 1`, "0.1");
    await pick("QA Bank", 1); await input(`${id.debit} 2`, "0.2");
    await click(id.add, dialog()); await pick("QA Capital", 2); await input(`${id.credit} 3`, "0.3");
    assert.ok(dialog().textContent?.includes(id.journalBalanced)); await submit();
    await waitFor(() => !!button(id.journalPost, dialog()));
    const number = dialog().querySelector("h2")!.textContent!;
    await click(id.edit, dialog()); await waitFor(() => !!dialog().querySelector("form"));
    await input(id.journalReference, "QA-EDITED"); await submit();
    await waitFor(() => !!dialog()?.textContent?.includes("QA-EDITED"));
    await click(id.journalPost, dialog()); await click(id.confirm, dialog());
    await waitFor(() => !!dialog()?.textContent?.includes(id.journalReverse)); await click(id.close, dialog());
    for (let n = 0; n < 11; n++) {
      const draft = await json(path + "/journals", "POST", { requestKey: crypto.randomUUID(), date: "2026-10-02", description: "QA UI ledger pagination", reference: "", lines: [{ accountId: cash.id, debit: 0.01, credit: 0, description: "" }, { accountId: capital.id, debit: 0, credit: 0.01, description: "" }] });
      await json(path + `/journals/${draft.id}/actions`, "POST", { action: "post", expectedUpdatedAt: draft.updatedAt });
    }
    await click("QA ledger"); await waitFor(() => document.querySelectorAll("tbody tr").length === 10);
    await click(id.next); await waitFor(() => document.querySelectorAll("tbody tr").length === 2);
    assert.match(document.querySelector("tbody tr:last-child")!.textContent!, /0,21/);
    await click(id.exportReport); await waitFor(() => !!exported);
    const csv = await exported!.text(); assert.ok(csv.includes(number)); assert.equal((csv.match(/"JV-/g) || []).length, 12);
    await click("QA trial"); await waitFor(() => document.querySelectorAll("tbody tr").length === 3);
    assert.match(document.querySelector("tfoot")!.textContent!, /0,41/);
    await click("QA journals"); await waitFor(() => !!document.querySelector(`input[aria-label="${id.search}"]`));
    await input(id.search, number, document); await waitFor(() => !!button(number)); await click(number);
    await waitFor(() => !!button(id.journalReverse, dialog())); await click(id.journalReverse, dialog());
    await input(id.journalReverseDate, "2026-10-03"); await input(id.journalReverseReason, "QA UI reversal verification"); await click(id.confirm, dialog());
    await waitFor(() => !!dialog()?.textContent?.includes(id.journalOriginal));
    assert.ok(dialog().textContent?.includes(number)); await click(id.close, dialog());
    await click("QA ledger"); await waitFor(() => document.querySelectorAll("tbody tr").length === 10);
    await click(id.next); await waitFor(() => document.querySelectorAll("tbody tr").length === 3);
    assert.match(document.querySelector("tbody tr:last-child")!.textContent!, /0,11/);
    await click("QA Alpha");
    assert.equal(document.querySelectorAll("tbody tr").length, 0);
    await waitFor(() => !!document.body.textContent?.includes("PT Alpha Distribusi"));
    assert.ok(!document.body.textContent?.includes("QA Cash"));
    assert.equal((await json(path + "/journals?q=QA-EDITED")).data[0].status, "POSTED");
    assert.equal(bank.companyId, companyId);
  } finally {
    await act(async () => root.unmount()); URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; window.HTMLAnchorElement.prototype.click = anchorClick; localStorage.clear();
    if (companyId) {
      assert.equal((await prisma.company.findUnique({ where: { id: companyId } }))?.code, code);
      await prisma.$transaction(async (tx) => {
        await tx.journalLine.deleteMany({ where: { companyId } }); await tx.journal.deleteMany({ where: { companyId, reversalOfId: { not: null } } }); await tx.journal.deleteMany({ where: { companyId } });
        await tx.account.deleteMany({ where: { companyId, isGroup: false } }); await tx.account.deleteMany({ where: { companyId } }); await tx.documentSequence.deleteMany({ where: { companyId } }); await tx.auditLog.deleteMany({ where: { companyId } }); await tx.membership.deleteMany({ where: { companyId } }); await tx.company.delete({ where: { id: companyId } });
      });
    } await prisma.$disconnect();
  }
});
