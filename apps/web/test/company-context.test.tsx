import { test } from "node:test";
import assert from "node:assert/strict";
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  WorkspaceProvider,
  useWorkspace,
} from "../src/components/workspace-provider";
let context: ReturnType<typeof useWorkspace>;
function Probe() {
  const current = useWorkspace();
  useEffect(() => {
    context = current;
  }, [current]);
  return (
    <>
      <h1>{current.company.name}</h1>
      <button onClick={() => current.switchCompany("beta")}>Beta</button>
      <button onClick={() => current.switchCompany("gamma")}>Gamma</button>
      <button onClick={() => current.switchCompany("alpha")}>Alpha</button>
      <output>
        {current.records.suppliers.map((r) => r.companyId).join(",")}
      </output>
    </>
  );
}
test("company switch updates context, isolates writes, enforces Viewer, and persists demo drafts", async () => {
  localStorage.clear();
  const host = document.getElementById("root")!;
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <WorkspaceProvider>
        <Probe />
      </WorkspaceProvider>,
    );
  });
  assert.match(host.querySelector("h1")!.textContent!, /Alpha/);
  assert.ok(context.records.suppliers.every((r) => r.companyId === "alpha"));
  await act(async () => {
    host.querySelectorAll("button")[0].click();
  });
  assert.match(host.querySelector("h1")!.textContent!, /Beta/);
  assert.ok(context.records.suppliers.every((r) => r.companyId === "beta"));
  const before = context.records.suppliers.length;
  await act(async () => {
    await context.saveRecord("suppliers", {
      code: "SUP-TEST",
      name: "Test Company Supplier",
      category: "Jasa",
      status: "ACTIVE",
      email: "",
      phone: "",
      description: "",
    });
  });
  assert.equal(context.records.suppliers.length, before + 1);
  assert.equal(context.records.suppliers[0].companyId, "beta");
  await act(async () => {
    context.addDraft({
      type: "Purchase Order",
      party: "Test Company Supplier",
      amount: 50000,
      date: "2026-10-21",
    });
  });
  assert.equal(context.transactions[0].companyId, "beta");
  assert.equal(context.transactions[0].status, "DRAFT");
  await act(async () => {
    host.querySelectorAll("button")[2].click();
  });
  assert.ok(!context.records.suppliers.some((r) => r.code === "SUP-TEST"));
  assert.ok(!context.transactions.some((t) => t.status === "DRAFT"));
  await act(async () => {
    host.querySelectorAll("button")[1].click();
  });
  assert.equal(context.writable, false);
  await assert.rejects(
    context.saveRecord("suppliers", {
      code: "DENIED",
      name: "Forbidden Supplier",
      category: "Jasa",
      status: "ACTIVE",
      email: "",
      phone: "",
      description: "",
    }),
  );
  await act(async () => {
    root.unmount();
  });
  const restored = createRoot(host);
  await act(async () => {
    restored.render(
      <WorkspaceProvider>
        <Probe />
      </WorkspaceProvider>,
    );
  });
  assert.equal(context.company.id, "gamma");
  await act(async () => {
    host.querySelectorAll("button")[0].click();
  });
  assert.ok(context.records.suppliers.some((r) => r.code === "SUP-TEST"));
  assert.ok(context.transactions.some((t) => t.status === "DRAFT"));
  await act(async () => {
    restored.unmount();
  });
  localStorage.clear();
});

test("company creation, relation checks, currency locks, stale edits, and archival preserve company boundaries", async () => {
  localStorage.clear();
  const host = document.getElementById("root")!;
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <WorkspaceProvider>
        <Probe />
      </WorkspaceProvider>,
    );
  });
  await act(async () => {
    host.querySelectorAll("button")[0].click();
  });
  await assert.rejects(
    context.saveCompany(
      {
        code: "DENIED",
        name: "Denied Company",
        industry: "Teknologi",
        city: "Jakarta",
        currency: "IDR",
        status: "ACTIVE",
        email: "",
        phone: "",
        taxId: "",
        address: "",
      },
      "beta",
    ),
  );
  await act(async () => {
    host.querySelectorAll("button")[2].click();
  });
  const foreignBranch = context.records.branches[0];
  await assert.rejects(
    context.saveCompany(
      { ...context.company, currency: "USD" },
      context.company.id,
    ),
  );
  await act(async () => {
    await context.saveCompany({
      code: "QA",
      name: "PT QA Company",
      industry: "Teknologi",
      city: "Jakarta",
      currency: "SGD",
      status: "ACTIVE",
      email: "",
      phone: "",
      taxId: "",
      address: "",
    });
  });
  assert.equal(context.company.code, "QA");
  assert.equal(context.company.currency, "SGD");
  assert.equal(context.records.suppliers.length, 0);
  await assert.rejects(
    context.saveRecord("departments", {
      code: "D-001",
      name: "Department QA",
      category: "Operasional",
      status: "ACTIVE",
      email: "",
      phone: "",
      description: "",
      branchId: foreignBranch.id,
    }),
  );
  await act(async () => {
    await context.saveRecord("branches", {
      code: "B-001",
      name: "Branch QA",
      city: "Jakarta",
      category: "Operasional",
      status: "ACTIVE",
      email: "",
      phone: "",
      description: "",
    });
  });
  const branch = context.records.branches[0];
  await act(async () => {
    await context.saveRecord("departments", {
      code: "D-001",
      name: "Department QA",
      category: "Operasional",
      status: "ACTIVE",
      email: "",
      phone: "",
      description: "",
      branchId: branch.id,
    });
  });
  await assert.rejects(context.deleteRecord("branches", branch.id));
  await assert.rejects(
    context.saveRecord(
      "branches",
      { ...branch, status: "INACTIVE" },
      branch.id,
    ),
  );
  await act(async () => {
    await context.saveRecord("items", {
      code: "I-001",
      name: "Items QA",
      category: "Elektronik",
      status: "ACTIVE",
      email: "",
      phone: "",
      description: "",
      sellingPrice: 100,
      unit: "pcs",
      trackStock: true,
    });
  });
  assert.equal(context.company.currencyLocked, true);
  await assert.rejects(
    context.saveCompany(
      { ...context.company, currency: "USD" },
      context.company.id,
    ),
  );
  const item = context.records.items[0];
  await act(async () => {
    await context.saveRecord(
      "items",
      { ...item, name: "Items QA Updated" },
      item.id,
      item.updatedAt,
    );
  });
  await assert.rejects(
    context.saveRecord(
      "items",
      { ...item, name: "Stale Items" },
      item.id,
      item.updatedAt,
    ),
  );
  const companyId = context.company.id;
  await act(async () => {
    await context.archiveCompany(companyId);
  });
  assert.equal(context.company.status, "INACTIVE");
  assert.equal(context.writable, false);
  assert.equal(context.records.departments.length, 1);
  await assert.rejects(context.deleteRecord("items", item.id));
  await act(async () => {
    await context.saveCompany(
      { ...context.company, status: "ACTIVE" },
      companyId,
      context.company.updatedAt,
    );
  });
  assert.equal(context.writable, true);
  assert.equal(context.records.items[0].name, "Items QA Updated");
  await act(async () => {
    root.unmount();
  });
  localStorage.clear();
});
