import { test } from "node:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { OperationalDashboard } from "../src/components/operational-dashboard";
import { CompanySwitcher } from "../src/components/workspace-controls";
import { WorkspaceProvider, useWorkspace } from "../src/components/workspace-provider";
import { money, number } from "../src/lib/utils";
import { id } from "../src/lib/i18n";
import type { PurchaseSummary, SalesSummary } from "@erp/shared";

// Layout measurements belong to browser QA; these checks exercise real data and controls.
class TestResizeObserver { observe() {} unobserve() {} disconnect() {} }
function Workspace() {
  const { company } = useWorkspace();
  return <><CompanySwitcher /><OperationalDashboard key={company.id} /></>;
}
async function waitFor(check: () => boolean) {
  for (let i = 0; i < 180; i++) {
    if (check()) return;
    await act(async () => { await new Promise(r => setTimeout(r, 40)); });
  }
  throw Error("Dashboard did not settle");
}
test("new Dashboard renders real scoped metrics, opens transaction forms and reads document details", async () => {
  localStorage.clear();
  const previousResizeObserver = globalThis.ResizeObserver;
  const previousBounds = HTMLElement.prototype.getBoundingClientRect;
  globalThis.ResizeObserver = TestResizeObserver;
  HTMLElement.prototype.getBoundingClientRect = function () {
    // A fixed chart host prevents JSDOM's zero-size warning; this is not visual QA.
    return this.classList.contains("recharts-responsive-container") ? new window.DOMRect(0, 0, 800, 230) : previousBounds.call(this);
  };
  const host = document.getElementById("root")!, root = createRoot(host);
  const open = async (selector: string) => { await act(async () => document.querySelector(selector)!.dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true }))); };
  const pick = async (text: string) => {
    const target = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(n => n.textContent?.includes(text));
    assert.ok(target, text); await act(async () => target.click());
  };
  const close = async () => {
    const target = document.querySelector<HTMLButtonElement>('[role="dialog"] button:has(.lucide-x)');
    assert.ok(target); await act(async () => target.click());
  };
  try {
    await act(async () => root.render(<WorkspaceProvider><Workspace /></WorkspaceProvider>));
    for (const companyId of ["alpha", "beta"]) {
      await waitFor(() => !!host.querySelector('.dashboard-summary[aria-busy="false"]'));
      let purchase!: PurchaseSummary, sales!: SalesSummary;
      await act(async () => {
        [purchase, sales] = await Promise.all([
          fetch(`/api/companies/${companyId}/procurement/summary`).then(r => r.json()) as Promise<PurchaseSummary>,
          fetch(`/api/companies/${companyId}/sales/summary`).then(r => r.json()) as Promise<SalesSummary>,
        ]);
      });
      assert.deepEqual([...host.querySelectorAll(".metric-value")].map(n => n.textContent), [money(sales.sales, "IDR"), money(purchase.purchases, "IDR"), money(purchase.outstanding, "IDR"), money(sales.outstanding, "IDR"), number(purchase.requestsPending), money(purchase.inventoryValue, "IDR")]);
      if (companyId === "alpha") { await open(".company-switcher"); await pick("PT Beta Industri"); await waitFor(() => host.querySelector(".company-name")?.textContent === "PT Beta Industri"); }
    }
    await open(".company-switcher"); await pick("PT Alpha Distribusi");
    await waitFor(() => host.querySelector(".company-name")?.textContent === "PT Alpha Distribusi" && !!host.querySelector('.dashboard-summary[aria-busy="false"]'));
    await open(".page-heading-actions button"); await pick(id.createRequest);
    await waitFor(() => !!document.querySelector('[role="dialog"] form'));
    assert.match(document.querySelector('[role="dialog"]')!.textContent!, /PT Alpha Distribusi/);
    await close();
    assert.equal(document.querySelector('[role="dialog"]'), null);
    await waitFor(() => !!host.querySelector(".dashboard-transactions tbody button"));
    const doc = host.querySelector<HTMLButtonElement>(".dashboard-transactions tbody button")!;
    const documentNumber = doc.textContent!;
    await act(async () => doc.click());
    await waitFor(() => !!document.querySelector('[role="dialog"]')?.textContent?.includes(documentNumber));
    await close();
    assert.equal(document.querySelector('[role="dialog"]'), null);
  } finally {
    await act(async () => root.unmount());
    globalThis.ResizeObserver = previousResizeObserver;
    HTMLElement.prototype.getBoundingClientRect = previousBounds;
    localStorage.clear();
  }
});
