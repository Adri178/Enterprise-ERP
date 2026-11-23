import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { PrismaClient } from "@prisma/client";
import {
  WorkspaceProvider,
  useWorkspace,
} from "../src/components/workspace-provider";
import { ReportsPage } from "../src/components/reports-page";
import { id } from "../src/lib/i18n";
import type { InvoiceReport } from "@erp/shared";

const button = (name: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => b.textContent?.trim() === name,
  )!;
async function click(name: string) {
  assert.ok(button(name), name);
  await act(async () => button(name).click());
}
async function waitFor(check: () => boolean) {
  for (let i = 0; i < 220; i++) {
    if (check()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
  }
  throw new Error(
    `Reports UI did not settle: ${document.body.textContent?.slice(-1800)}`,
  );
}
function input(label: string, value: string) {
  const target = Array.from(document.querySelectorAll("label"))
    .find((el) => el.textContent?.startsWith(label))!
    .querySelector("input")!;
  Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )!.set!.call(target, value);
  target.dispatchEvent(new window.Event("input", { bubbles: true }));
  target.dispatchEvent(new window.Event("change", { bubbles: true }));
}
function SwitchCompany({ companyId }: { companyId: string }) {
  const { switchCompany } = useWorkspace();
  return (
    <>
      <button onClick={() => switchCompany("gamma")}>Gamma QA</button>
      <button onClick={() => switchCompany(companyId)}>Reports QA</button>
    </>
  );
}

test("Reports UI filters periods, sorts and paginates, exports all rows, opens Invoice details, and drops stale company results", async () => {
  const { createReportFixture, cleanupReportFixture } = await import(
    pathToFileURL(resolve("scripts/report-fixtures.mjs")).href
  );
  const prisma = new PrismaClient(),
    code = `QRUI${Date.now().toString(36).toUpperCase()}`;
  const root = createRoot(document.getElementById("root")!);
  let fixture:
    | { companyId: string; invoices: string[]; expectedAmount: number }
    | undefined;
  const originalFetch = globalThis.fetch,
    originalCreate = URL.createObjectURL,
    originalRevoke = URL.revokeObjectURL;
  const anchorClick = window.HTMLAnchorElement.prototype.click;
  let exported: Blob | undefined;
  let last: InvoiceReport | undefined;
  let holdExport = false,
    heldExport: Promise<Response> | undefined,
    resolveExport: ((r: Response) => void) | undefined;
  try {
    fixture = await createReportFixture(prisma, code);
    const user = await (await fetch("/api/auth/me")).json();
    localStorage.clear();
    localStorage.setItem(
      `enterprise-erp-active:${user.id}`,
      fixture!.companyId,
    );
    URL.createObjectURL = (blob) => {
      exported = blob as Blob;
      return "blob:qa-report";
    };
    URL.revokeObjectURL = () => {};
    window.HTMLAnchorElement.prototype.click = () => {};
    globalThis.fetch = async (path, options) => {
      const response = await originalFetch(path, options);
      if (String(path).includes("/reports/invoices?") && response.ok)
        last = await response.clone().json();
      if (holdExport && String(path).includes("/reports/invoices/export?")) {
        heldExport = new Promise<Response>((resolve) => {
          resolveExport = resolve;
        });
        return heldExport;
      }
      return response;
    };
    await act(async () =>
      root.render(
        <WorkspaceProvider>
          <SwitchCompany companyId={fixture!.companyId} />
          <ReportsPage />
        </WorkspaceProvider>,
      ),
    );
    await waitFor(
      () =>
        !!document.querySelector("form") &&
        !!last &&
        !!document.body.textContent?.includes(code),
    );
    await act(async () => {
      input(id.reportFrom, "2026-01-01");
      input(id.reportTo, "2026-01-31");
    });
    await click(id.apply);
    await waitFor(() => document.querySelectorAll("tbody tr").length === 10);
    assert.equal(last?.summary.amount, fixture!.expectedAmount);
    assert.equal(last?.summary.settled, 100.25);
    await click(id.next);
    await waitFor(() => document.querySelectorAll("tbody tr").length === 3);
    assert.ok(button(id.next).disabled);
    await click(id.exportReport);
    await waitFor(() => !!exported);
    const csv = await exported!.text();
    for (const invoice of fixture!.invoices)
      assert.ok(csv.includes(invoice), invoice);
    assert.ok(csv.includes(id.reportGenerated));
    await click(id.previous);
    await waitFor(() => document.querySelectorAll("tbody tr").length === 10);
    await click(id.reportAmount);
    await waitFor(
      () =>
        last?.meta.page === 1 && last?.data[0].number === fixture!.invoices[0],
    );
    const first = Array.from(
      document.querySelectorAll<HTMLButtonElement>("tbody button"),
    ).find((b) => b.textContent === fixture!.invoices[0])!;
    await act(async () => first.click());
    await waitFor(
      () =>
        !!document
          .querySelector('[role="dialog"]')
          ?.textContent?.includes(fixture!.invoices[0]),
    );
    await click(id.close);
    await act(async () => {
      input(id.search, "100_");
    });
    await click(id.apply);
    await waitFor(
      () => !!document.body.textContent?.includes(id.reportEmptyHint),
    );
    assert.equal(last?.summary.count, 0);
    await act(async () => {
      input(id.search, "100%_");
    });
    await click(id.apply);
    await waitFor(() => document.querySelectorAll("tbody tr").length === 10);
    await act(async () => {
      input(id.reportTo, "2025-12-31");
    });
    await click(id.apply);
    assert.match(
      document.querySelector('[role="alert"]')?.textContent || "",
      /mendahului/,
    );
    assert.equal(
      last?.summary.count,
      13,
      "Invalid period retains the applied report",
    );
    await act(async () => {
      input(id.reportFrom, "2026-02-01");
      input(id.reportTo, "2026-02-28");
      input(id.search, "");
    });
    await click(id.apply);
    await click(id.purchaseInvoice);
    await waitFor(
      () =>
        last?.domain === "procurement" &&
        document.querySelectorAll("tbody tr").length === 2,
    );
    assert.equal(last?.summary.outstanding, 777.77);
    // Simulate a slow download response that arrives after Company switching.
    exported = undefined;
    holdExport = true;
    await click(id.exportReport);
    await waitFor(() => !!resolveExport);
    await click("Gamma QA");
    assert.equal(
      document.querySelectorAll("tbody tr").length,
      0,
      "Prior-company results disappear immediately",
    );
    await act(async () =>
      resolveExport!(
        new Response(JSON.stringify({ data: [] }), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    await waitFor(
      () => !!document.body.textContent?.includes(id.reportEmptyHint),
    );
    assert.equal(
      exported,
      undefined,
      "Aborted export must not create a CSV for the prior Company",
    );
    assert.equal(last?.summary.count, 0);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    window.HTMLAnchorElement.prototype.click = anchorClick;
    localStorage.clear();
    if (fixture) await cleanupReportFixture(prisma, fixture.companyId, code);
    await prisma.$disconnect();
  }
});
