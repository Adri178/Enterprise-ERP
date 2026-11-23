import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { act, type ReactNode } from "react";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { createRoot } from "react-dom/client";
import { PrismaClient } from "@prisma/client";
import { EmployeesPage } from "../src/components/employees-page";
import { LeavesPage } from "../src/components/leaves-page";
import {
  WorkspaceProvider,
  useWorkspace,
} from "../src/components/workspace-provider";
import { id } from "../src/lib/i18n";

async function json(path: string, method = "GET", body?: unknown) {
  let result: Awaited<ReturnType<Response["json"]>>;
  await act(async () => {
    const r = await fetch(`/api${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    result = await r.json();
    assert.ok(r.ok, `${path}: ${JSON.stringify(result)}`);
  });
  return result;
}
async function waitFor(check: () => boolean) {
  for (let i = 0; i < 200; i++) {
    if (check()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
  }
  throw new Error(
    `HR UI did not settle: ${document.body.textContent?.slice(-2000)}`,
  );
}
const dialog = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).at(-1)!;
const button = (text: string, parent: ParentNode = document) =>
  Array.from(parent.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => b.textContent?.trim() === text,
  )!;
async function click(text: string, parent?: ParentNode) {
  assert.ok(button(text, parent), text);
  await act(async () => button(text, parent).click());
}
async function input(label: string, value: string) {
  const target = Array.from(dialog().querySelectorAll("label"))
    .find((l) => l.textContent?.startsWith(label))!
    .querySelector("input,textarea,select")!;
  await act(async () => {
    const proto =
      target.tagName === "TEXTAREA"
        ? window.HTMLTextAreaElement.prototype
        : target.tagName === "SELECT"
          ? window.HTMLSelectElement.prototype
          : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(target, value);
    target.dispatchEvent(new window.Event("input", { bubbles: true }));
    target.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
}
async function select(label: string, name: string) {
  const trigger = Array.from(
    dialog().querySelectorAll<HTMLButtonElement>('[role="combobox"]'),
  ).find(
    (b) =>
      b.getAttribute("aria-labelledby") &&
      dialog()
        .querySelector(`[id="${b.getAttribute("aria-labelledby")}"]`)
        ?.textContent?.startsWith(label),
  )!;
  assert.ok(trigger, label);
  await act(async () => trigger.click());
  await waitFor(
    () =>
      !!Array.from(dialog().querySelectorAll("button")).find((b) =>
        b.textContent?.includes(name),
      ),
  );
  await act(async () =>
    Array.from(dialog().querySelectorAll<HTMLButtonElement>("button"))
      .find((b) => b.textContent?.includes(name))!
      .click(),
  );
}
async function submit() {
  await act(async () => {
    dialog()
      .querySelector("form")!
      .dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
  });
}
function Controls() {
  const { switchCompany } = useWorkspace();
  return <button onClick={() => switchCompany("alpha")}>Alpha QA</button>;
}
const searchParams = new URLSearchParams();
function Scene({
  reviewer = false,
  children,
}: {
  reviewer?: boolean;
  children: ReactNode;
}) {
  return (
    <SearchParamsContext.Provider value={searchParams}>
      <WorkspaceProvider key={reviewer ? "reviewer" : "admin"}>
        {children}
      </WorkspaceProvider>
    </SearchParamsContext.Provider>
  );
}

test("HR UI creates and edits an Employee, routes Department by Branch, submits leave, approves as another User, and preserves company context", async () => {
  const prisma = new PrismaClient(),
    code = `HQ${Date.now().toString(36).toUpperCase()}`,
    root = createRoot(document.getElementById("root")!);
  let companyId: string | undefined;
  try {
    const user = await json("/auth/me"),
      company = await json("/companies", "POST", {
        code,
        name: `QA HR ${code}`,
        industry: "Pengujian",
        city: "Jakarta",
        currency: "IDR",
        status: "ACTIVE",
        address: "",
        email: "",
        phone: "",
        taxId: "",
      });
    companyId = company.id;
    const path = `/companies/${companyId}`;
    const master = (kind: string, code: string, extra = {}) =>
      json(`${path}/master/${kind}`, "POST", {
        code,
        name: `QA ${code}`,
        category: "Operasional",
        status: "ACTIVE",
        email: "",
        phone: "",
        description: "",
        ...extra,
      });
    const br1 = await master("branches", "BR-ONE", { city: "Jakarta" }),
      br2 = await master("branches", "BR-TWO", { city: "Bandung" });
    await master("departments", "DEP-ONE", { branchId: br1.id });
    const dep2 = await master("departments", "DEP-TWO", { branchId: br2.id });
    const reviewer = await prisma.user.findUniqueOrThrow({
      where: { email: "reviewer@enterprise.local" },
    });
    await prisma.membership.create({
      data: { companyId: companyId!, userId: reviewer.id, role: "MANAGER" },
    });
    localStorage.clear();
    localStorage.setItem(`enterprise-erp-active:${user.id}`, companyId!);
    await act(async () =>
      root.render(
        <Scene>
          <EmployeesPage />
        </Scene>,
      ),
    );
    await waitFor(
      () =>
        !!button(id.addRecord(id.employee)) &&
        !button(id.addRecord(id.employee)).disabled,
    );
    await click(id.addRecord(id.employee));
    await input(id.employeeCode, "EMP-UI");
    await input(id.employeeName, "QA HR Employee");
    await input(id.employeeJob, "Operations Specialist");
    await input(id.employeeEmail, "employee.ui@example.local");
    await input(id.employmentStart, "2026-01-01");
    await select(id.branch, "QA BR-ONE");
    await select(id.department, "QA DEP-ONE");
    await select(id.branch, "QA BR-TWO");
    assert.ok(
      dialog().textContent?.includes(id.selectRecord(id.department)),
      "Changing Branch clears the Department selection",
    );
    await select(id.department, "QA DEP-TWO");
    await submit();
    await waitFor(
      () =>
        !document.querySelector('[role="dialog"]') &&
        !!document.querySelector("tbody")?.textContent?.includes("EMP-UI"),
    );
    let employee = (await json(`${path}/hr/employees?q=EMP-UI`)).data[0];
    assert.equal(employee.branchId, br2.id);
    assert.equal(employee.departmentId, dep2.id);
    await click(id.edit);
    await input(id.employeeJob, "Operations Lead");
    await submit();
    await waitFor(
      () =>
        !document.querySelector('[role="dialog"]') &&
        !!document
          .querySelector("tbody")
          ?.textContent?.includes("Operations Lead"),
    );
    await act(async () =>
      root.render(
        <Scene>
          <LeavesPage />
        </Scene>,
      ),
    );
    await click(id.addRecord(id.leaveRequest));
    await select(id.employee, "QA HR Employee");
    await input(id.leaveFrom, "2026-11-03");
    await input(id.leaveTo, "2026-11-04");
    await input(id.leaveReason, "Keperluan keluarga QA UI");
    await submit();
    await waitFor(() => !!button(id.leaveSubmit, dialog()));
    assert.equal(button(id.leaveApprove, dialog()), undefined);
    await click(id.leaveSubmit, dialog());
    await click(id.confirm, dialog());
    await waitFor(() => !!dialog().textContent?.includes(id.leaveSelfReview));
    const pending = (await json(`${path}/hr/leave-requests?status=PENDING`))
      .data[0];
    assert.equal(pending.days, 2);
    await click(id.close, dialog());
    await act(async () => {
      const { setLiveSession } = await import(
        pathToFileURL(resolve("scripts/live-ui-test-setup.mjs")).href
      );
      await setLiveSession("reviewer@enterprise.local");
    });
    localStorage.setItem(`enterprise-erp-active:${reviewer.id}`, companyId!);
    await act(async () =>
      root.render(
        <Scene reviewer>
          <Controls />
          <LeavesPage />
        </Scene>,
      ),
    );
    await waitFor(() => !!button(pending.number));
    await click(pending.number);
    await waitFor(() => !!button(id.leaveApprove, dialog()));
    await click(id.leaveApprove, dialog());
    await input(id.leaveNote, "Disetujui oleh reviewer UI");
    await click(id.confirm, dialog());
    await waitFor(() => !!dialog().textContent?.includes(id.leaveFinalHint));
    assert.equal(button(id.leaveApprove, dialog()), undefined);
    const approved = await json(`${path}/hr/leave-requests/${pending.id}`);
    assert.equal(approved.status, "APPROVED");
    assert.equal(approved.reviewerName, reviewer.name);
    await click(id.close, dialog());
    await act(async () =>
      root.render(
        <Scene reviewer>
          <Controls />
          <EmployeesPage />
        </Scene>,
      ),
    );
    await waitFor(() => !!button(id.edit));
    await click(id.edit);
    await input(id.status, "INACTIVE");
    await input(id.employmentEnd, "2026-11-30");
    await submit();
    await waitFor(() => dialog().textContent?.startsWith(id.confirm) === true);
    await click(id.confirm, dialog());
    await waitFor(
      () =>
        !document.querySelector('[role="dialog"]') &&
        !!document.querySelector("tbody")?.textContent?.includes(id.inactive),
    );
    employee = (await json(`${path}/hr/employees?q=EMP-UI`)).data[0];
    assert.equal(employee.status, "INACTIVE");
    assert.equal(employee.endDate, "2026-11-30");
    await click("Alpha QA");
    assert.equal(
      document.querySelector("tbody")?.textContent?.includes("EMP-UI") || false,
      false,
    );
    await waitFor(
      () => !!document.body.textContent?.includes("PT Alpha Distribusi"),
    );
  } finally {
    await act(async () => root.unmount());
    localStorage.clear();
    if (companyId) {
      assert.equal(
        (await prisma.company.findUnique({ where: { id: companyId } }))?.code,
        code,
      );
      await prisma.$transaction(async (tx) => {
        await tx.leaveRequest.deleteMany({ where: { companyId } });
        await tx.employee.deleteMany({ where: { companyId } });
        await tx.documentSequence.deleteMany({ where: { companyId } });
        await tx.masterRecord.deleteMany({
          where: { companyId, kind: "departments" },
        });
        await tx.masterRecord.deleteMany({ where: { companyId } });
        await tx.auditLog.deleteMany({ where: { companyId } });
        await tx.membership.deleteMany({ where: { companyId } });
        await tx.company.delete({ where: { id: companyId } });
      });
    }
    await prisma.$disconnect();
  }
});
