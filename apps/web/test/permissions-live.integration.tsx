import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { PrismaClient } from "@prisma/client";
import { CompanyUsersPage } from "../src/components/company-users-page";
import { AccessAuditPage } from "../src/components/access-audit-page";
import { ChangePasswordForm } from "../src/components/change-password-form";
import { WorkspaceProvider, useWorkspace } from "../src/components/workspace-provider";
import { id } from "../src/lib/i18n";
async function json(path: string, method = "GET", body?: unknown) {
  let result: Awaited<ReturnType<Response["json"]>>;
  await act(async () => { const r = await fetch(`/api${path}`, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) }); result = await r.json(); assert.ok(r.ok, `${path}: ${JSON.stringify(result)}`); }); return result;
}
const dialog = () => Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).at(-1);
const button = (text: string, parent: ParentNode = document) => Array.from(parent.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent?.trim() === text)!;
async function click(text: string, parent?: ParentNode) { assert.ok(button(text, parent), text); await act(async () => button(text, parent).click()); }
async function waitFor(check: () => boolean) { for (let n = 0; n < 250; n++) { if (check()) return; await act(async () => { await new Promise((r) => setTimeout(r, 40)); }); } throw new Error(`Access UI did not settle: ${document.body.textContent?.slice(-2500)}`); }
async function input(label: string, text: string, parent: ParentNode = dialog() || document) {
  const target = Array.from(parent.querySelectorAll("label")).find((l) => l.textContent?.startsWith(label))?.querySelector("input,textarea,select") || parent.querySelector(`[aria-label="${label}"]`); assert.ok(target, label);
  await act(async () => { const proto = target.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : target.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(target, text); target.dispatchEvent(new window.Event("input", { bubbles: true })); target.dispatchEvent(new window.Event("change", { bubbles: true })); });
}
async function submit(parent: ParentNode = dialog() || document) { await act(async () => { parent.querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); }); }
function Controls({ a, b }: { a: string; b: string }) { const { switchCompany } = useWorkspace(); return <><button onClick={() => switchCompany(a)}>QA A</button><button onClick={() => switchCompany(b)}>QA B</button></>; }
const search = new URLSearchParams();
function Scene({ a, b }: { a: string; b: string }) {
  const [page, setPage] = useState("users");
  return <SearchParamsContext.Provider value={search}><WorkspaceProvider><Controls a={a} b={b} /><button onClick={() => setPage("users")}>QA Users</button><button onClick={() => setPage("audit")}>QA Audit</button>{page === "users" ? <CompanyUsersPage /> : <AccessAuditPage />}</WorkspaceProvider></SearchParamsContext.Provider>;
}
test("Permissions UI creates a scoped User, confirms Role changes, enforces initial password replacement, grants existing identity elsewhere and audits company-only deactivation", async () => {
  const prisma = new PrismaClient(), prefix = `U${Date.now().toString(36).toUpperCase()}`, root = createRoot(document.getElementById("root")!), companies: { id: string; code: string; name: string }[] = [];
  let createdUserId: string | undefined;
  const initialPassword = `Initial!${crypto.randomUUID()}`, newPassword = `Changed!${crypto.randomUUID()}`, email = `qa.${prefix.toLowerCase()}@example.local`;
  const { setLiveSession, restoreLiveSession } = await import(pathToFileURL(resolve("scripts/live-ui-test-setup.mjs")).href);
  try {
    const admin = await json("/auth/me");
    for (const letter of ["A", "B"]) companies.push(await json("/companies", "POST", { code: prefix + letter, name: `QA Access UI ${letter}`, industry: "Pengujian", city: "Jakarta", currency: "IDR", status: "ACTIVE", address: "", email: "", phone: "", taxId: "" }));
    const [a, b] = companies; localStorage.clear(); localStorage.setItem(`enterprise-erp-active:${admin.id}`, a.id);
    await act(async () => root.render(<Scene a={a.id} b={b.id} />)); await waitFor(() => document.querySelectorAll("tbody tr").length === 1);
    assert.equal(button(id.edit, document.querySelector("tbody tr")!).disabled, true);
    await click(id.addUserAccess); await input(id.accessMode, "NEW"); await input(id.name, "QA Access UI User"); await input(id.email, email); await input(id.initialPassword, initialPassword); await input(id.accessReason, "QA new user onboarding"); await submit();
    await waitFor(() => !dialog() && !!document.body.textContent?.includes(email));
    let row = Array.from(document.querySelectorAll("tbody tr")).find((r) => r.textContent?.includes(email))!; assert.ok(row.textContent?.includes(id.passwordChangeRequired));
    createdUserId = (await json(`/companies/${a.id}/access/users?q=${encodeURIComponent(email)}`)).data[0].userId;
    await click(id.edit, row); await input(id.role, "MANAGER"); await input(id.accessReason, "QA operational role"); await submit();
    assert.ok(dialog()?.textContent?.includes(id.accessConfirm)); await click(id.confirm, dialog()); await waitFor(() => !dialog() && Array.from(document.querySelectorAll("tbody tr")).some((r) => r.textContent?.includes(email) && r.querySelectorAll("td")[1].textContent === "MANAGER"));
    let changed = false; await act(async () => root.render(<ChangePasswordForm onChanged={() => { changed = true; }} />));
    await act(async () => setLiveSession(email, initialPassword)); assert.equal((await json("/auth/me")).mustChangePassword, true);
    const blocked = await fetch(`/api/companies/${a.id}/master-summary`); assert.equal(blocked.status, 403); assert.equal((await blocked.json()).code, "PASSWORD_CHANGE_REQUIRED");
    await input(id.passwordCurrent, initialPassword, document); await input(id.passwordNew, newPassword, document); await input(id.passwordConfirm, "AnotherSecret2026!", document); await submit(document);
    assert.ok(document.body.textContent?.includes("Konfirmasi password tidak sama")); await input(id.passwordConfirm, newPassword, document); await submit(document); await waitFor(() => changed);
    assert.equal((await fetch("/api/auth/me")).status, 401); await act(async () => setLiveSession(email, newPassword)); assert.equal((await json("/auth/me")).mustChangePassword, false);
    localStorage.setItem(`enterprise-erp-active:${createdUserId}`, a.id); await act(async () => root.render(<Scene a={a.id} b={b.id} />)); await waitFor(() => !!document.body.textContent?.includes(a.name) && !!document.body.textContent?.includes(id.accessAdminOnly)); assert.equal(button(id.addUserAccess).disabled, true);
    await act(async () => root.render(<></>)); restoreLiveSession(); localStorage.setItem(`enterprise-erp-active:${admin.id}`, a.id); await act(async () => root.render(<Scene a={a.id} b={b.id} />));
    await waitFor(() => document.querySelectorAll("tbody tr").length === 2); await click("QA B"); assert.equal(document.querySelectorAll("tbody tr").length, 0); await waitFor(() => document.querySelectorAll("tbody tr").length === 1);
    await click(id.addUserAccess); assert.ok(!Array.from(dialog()!.querySelectorAll("label")).some((l) => l.textContent?.startsWith(id.initialPassword))); await input(id.email, email); await input(id.accessReason, "QA second company access"); await submit(); await waitFor(() => !dialog() && !!document.body.textContent?.includes(email));
    row = Array.from(document.querySelectorAll("tbody tr")).find((r) => r.textContent?.includes(email))!; await click(id.edit, row); await act(async () => { dialog()!.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click(); }); await input(id.accessReason, "QA deactivate B only"); await submit(); await click(id.confirm, dialog()); await waitFor(() => !dialog() && Array.from(document.querySelectorAll("tbody tr")).some((r) => r.textContent?.includes(email) && r.textContent?.includes(id.inactive)));
    let memberships: Awaited<ReturnType<typeof prisma.membership.findMany>> = []; await act(async () => { memberships = await prisma.membership.findMany({ where: { userId: createdUserId } }); }); assert.equal(memberships.find((m) => m.companyId === a.id)?.role, "MANAGER"); assert.equal(memberships.find((m) => m.companyId === a.id)?.active, true); assert.equal(memberships.find((m) => m.companyId === b.id)?.active, false);
    await click("QA Audit"); await waitFor(() => document.querySelectorAll("tbody tr").length === 2); assert.ok(document.body.textContent?.includes("QA deactivate B only")); assert.ok(document.body.textContent?.includes(id.accessGranted));
    await click("QA A"); assert.equal(document.querySelectorAll("tbody tr").length, 0); await waitFor(() => document.querySelectorAll("tbody tr").length === 2); assert.ok(!document.body.textContent?.includes("QA deactivate B only")); assert.ok(document.body.textContent?.includes("QA operational role"));
  } finally {
    await act(async () => root.unmount()); restoreLiveSession(); localStorage.clear();
    if (companies.length) await prisma.$transaction(async (tx) => { for (const c of companies) assert.equal((await tx.company.findUnique({ where: { id: c.id } }))?.code, c.code); const ids = companies.map((c) => c.id); await tx.auditLog.deleteMany({ where: { companyId: { in: ids } } }); await tx.membership.deleteMany({ where: { companyId: { in: ids } } }); await tx.company.deleteMany({ where: { id: { in: ids } } }); if (createdUserId) { await tx.userSecurityEvent.deleteMany({ where: { userId: createdUserId } }); await tx.user.delete({ where: { id: createdUserId } }); } });
    await prisma.$disconnect();
  }
});
