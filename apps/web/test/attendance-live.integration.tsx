import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { PrismaClient } from "@prisma/client";
import { attendanceToday } from "@erp/shared";
import { WorkspaceProvider, useWorkspace } from "../src/components/workspace-provider";
import { AttendancePage } from "../src/components/attendance-page";
import { id } from "../src/lib/i18n";

const t = id.attendance;
async function json(path: string, method = "GET", body?: unknown) {
  let value: Awaited<ReturnType<Response["json"]>>;
  await act(async () => { const response = await fetch(`/api${path}`, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) }); value = await response.json(); assert.ok(response.ok, `${path}: ${JSON.stringify(value)}`); });
  return value;
}
async function waitFor(check: () => boolean) {
  for (let i = 0; i < 180; i++) { if (check()) { await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); }); if (check()) return; } await act(async () => { await new Promise(resolve => setTimeout(resolve, 35)); }); }
  throw new Error(`Attendance live UI did not settle: ${document.body.textContent?.slice(-1800)}`);
}
const dialog = () => Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).at(-1)!;
const button = (name: string, parent: ParentNode = document) => Array.from(parent.querySelectorAll<HTMLButtonElement>("button")).find(button => button.textContent?.trim() === name)!;
async function click(name: string, parent?: ParentNode) { assert.ok(button(name, parent), name); await act(async () => button(name, parent).click()); }
async function fill(selector: string, value: string) {
  const element = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!; assert.ok(element, selector);
  await act(async () => { Object.getOwnPropertyDescriptor(element.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype, "value")!.set!.call(element, value); element.dispatchEvent(new window.Event("input", { bubbles: true })); element.dispatchEvent(new window.Event("change", { bubbles: true })); });
}
function Controls() { const { switchCompany } = useWorkspace(); return <button onClick={() => switchCompany("gamma")}>Gamma QA</button>; }

test("Attendance web creates/corrects real records, exports all pages and cancels stale Company exports", async () => {
  const prisma = new PrismaClient(), root = createRoot(document.getElementById("root")!), code = `AU${randomUUID().slice(0, 7).toUpperCase()}`;
  let companyId: string | undefined, csv: Blob | undefined, release: (() => void) | undefined;
  const originalFetch = globalThis.fetch, originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL, originalClick = window.HTMLAnchorElement.prototype.click;
  try {
    const user = await json("/auth/me"), company = await json("/companies", "POST", { code, name: "QA Attendance live UI", industry: "Pengujian", city: "Jakarta", currency: "IDR", status: "ACTIVE", address: "", email: "", phone: "", taxId: "" }); companyId = company.id;
    const path = `/companies/${companyId}`, master = (kind: string, code: string, extra = {}) => json(`${path}/master/${kind}`, "POST", { code, name: `QA ${code}`, category: "Operasional", status: "ACTIVE", email: "", phone: "", description: "", ...extra });
    const branch = await master("branches", "BR", { city: "Jakarta" }), department = await master("departments", "DEP", { branchId: branch.id });
    const employeeBody = (code: string) => ({ code, name: `QA Attendance ${code}`, email: "", phone: "", jobTitle: "Operations", branchId: branch.id, departmentId: department.id, employmentType: "PERMANENT", startDate: "2026-01-01", endDate: "", status: "ACTIVE" });
    const employee = await json(`${path}/hr/employees`, "POST", employeeBody("EMP-UI"));
    localStorage.clear(); localStorage.setItem(`enterprise-erp-active:${user.id}`, companyId!);
    const scene = (params: URLSearchParams) => <SearchParamsContext.Provider value={params}><WorkspaceProvider><Controls /><AttendancePage /></WorkspaceProvider></SearchParamsContext.Provider>;
    await act(async () => root.render(scene(new URLSearchParams())));
    await waitFor(() => !!button(t.add) && !button(t.add).disabled && !!document.body.textContent?.includes(t.empty));
    await click(t.add); await act(async () => dialog().querySelector<HTMLButtonElement>('[role="combobox"]')!.click());
    await waitFor(() => Array.from(dialog().querySelectorAll("button")).some(button => button.textContent?.includes(employee.name)));
    await act(async () => Array.from(dialog().querySelectorAll("button")).find(button => button.textContent?.includes(employee.name))!.click());
    await fill("#live-attendance-out", "07:00"); await click(id.save, dialog());
    await waitFor(() => document.querySelector("#live-attendance-out")?.getAttribute("aria-invalid") === "true");
    assert.equal(await prisma.attendanceRecord.count({ where: { companyId } }), 0);
    await fill("#live-attendance-out", "17:00"); await click(id.save, dialog());
    await waitFor(() => !!dialog()?.textContent?.includes(employee.name) && !!button(t.correct, dialog()));
    const record = await prisma.attendanceRecord.findFirstOrThrow({ where: { companyId } }); assert.equal(record.checkOutMinutes, 1020);
    await click(t.correct, dialog()); await fill("#live-attendance-out", "18:00"); await fill("#live-attendance-reason", "Koreksi nyata dari form web"); await click(id.save, dialog());
    await waitFor(() => !!dialog()?.textContent?.includes("Koreksi nyata dari form web"));
    const changed = await prisma.attendanceRecord.findUniqueOrThrow({ where: { id: record.id } }); assert.equal(changed.checkOutMinutes, 1080); assert.equal(changed.revision, 1);
    await click(id.close, dialog());
    for (let i = 0; i < 12; i++) { const row = await json(`${path}/hr/employees`, "POST", employeeBody(`EMP-${i}`)); await json(`${path}/hr/attendance`, "POST", { requestKey: randomUUID(), employeeId: row.id, date: attendanceToday(), status: "PRESENT", checkIn: "08:00", checkOut: "17:00", description: "CSV pagination fixture" }); }
    await click(t.reload); await waitFor(() => !button(t.export).disabled && document.body.textContent!.includes("13"));
    await click(id.next); await waitFor(() => document.querySelectorAll("tbody tr").length === 3);
    URL.createObjectURL = value => { csv = value as Blob; return "blob:attendance-test"; }; URL.revokeObjectURL = () => {}; window.HTMLAnchorElement.prototype.click = () => {};
    await click(t.export); await waitFor(() => !!csv); const text = await csv!.text(); assert.equal(text.trim().split("\r\n").length, 14); assert.ok(text.includes(employee.code));
    await waitFor(() => !button(t.export).disabled);
    await act(async () => root.render(scene(new URLSearchParams({ employeeId: employee.id }))));
    await waitFor(() => !button(t.export).disabled && document.querySelectorAll("tbody tr").length === 1);
    csv = undefined;
    globalThis.fetch = async (input, options) => { const response = await originalFetch(input, options); if (String(input).includes(`${path}/hr/attendance/export`)) await new Promise<void>(resolve => { release = resolve; }); return response; };
    await click(t.export); await waitFor(() => !!release); await click("Gamma QA");
    await waitFor(() => !!button(t.add)?.disabled && document.body.textContent!.includes(t.readOnly));
    await act(async () => { release!(); await new Promise(resolve => setTimeout(resolve, 40)); });
    assert.equal(csv, undefined, "old Company export must not be downloaded"); assert.ok(!dialog()); assert.ok(!document.body.textContent?.includes(employee.name));
    assert.ok(document.querySelector('[role="combobox"]')?.textContent?.includes(t.allEmployees), "URL-selected Employee must not carry into another Company");
  } finally {
    release?.(); globalThis.fetch = originalFetch; URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; window.HTMLAnchorElement.prototype.click = originalClick;
    await act(async () => root.unmount());
    if (companyId) {
      assert.equal((await prisma.company.findUnique({ where: { id: companyId } }))?.code, code);
      await prisma.$transaction(async tx => { await tx.attendanceRecord.deleteMany({ where: { companyId } }); await tx.employee.deleteMany({ where: { companyId } }); await tx.documentSequence.deleteMany({ where: { companyId } }); await tx.masterRecord.deleteMany({ where: { companyId, kind: "departments" } }); await tx.masterRecord.deleteMany({ where: { companyId } }); await tx.auditLog.deleteMany({ where: { companyId } }); await tx.membership.deleteMany({ where: { companyId } }); await tx.company.delete({ where: { id: companyId } }); });
    }
    await prisma.$disconnect();
  }
});
