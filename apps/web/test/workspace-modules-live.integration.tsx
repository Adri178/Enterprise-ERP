import { test } from "node:test";
import assert from "node:assert/strict";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import type { PurchaseSummary, SalesSummary } from "@erp/shared";
import { WorkspaceProvider, useWorkspace } from "../src/components/workspace-provider";
import { MasterDataPage } from "../src/components/catalog-page";
import { TradePage } from "../src/components/trade-page";
import { AccountingPage } from "../src/components/accounting-page";
import { tradeMetrics } from "../src/lib/trade-ui";
import { number } from "../src/lib/utils";

type View = "suppliers" | "items" | "procurement" | "sales" | "accounting";
const views: View[] = ["suppliers", "items", "procurement", "sales", "accounting"];
function Pages() {
  const { company, switchCompany } = useWorkspace();
  const [view, setView] = useState<View>("suppliers");
  return <>
    {views.map(v => <button key={v} data-view={v} onClick={() => setView(v)}>{v}</button>)}
    <button data-company="beta" onClick={() => switchCompany("beta")}>Beta</button>
    <output data-company-name>{company.name}</output>
    <div key={`${view}:${company.id}`}>
      {view === "suppliers" || view === "items" ? <MasterDataPage kind={view} parent="Master Data" />
        : view === "accounting" ? <AccountingPage /> : <TradePage domain={view} />}
    </div>
  </>;
}
async function waitFor(check: () => boolean) {
  for (let i = 0; i < 180; i++) {
    if (check()) return;
    await act(async () => { await new Promise(r => setTimeout(r, 40)); });
  }
  throw Error("Module page did not settle");
}
test("consistent module surfaces preserve real scoped lists, summary values and workflow destinations", async () => {
  localStorage.clear();
  const host = document.getElementById("root")!, root = createRoot(host);
  const click = async (selector: string) => { await act(async () => host.querySelector<HTMLButtonElement>(selector)!.click()); };
  const values = () => [...host.querySelectorAll(".summary-strip .metric-value")].map(n => n.textContent);
  try {
    await act(async () => root.render(<SearchParamsContext.Provider value={new URLSearchParams()}><WorkspaceProvider><Pages /></WorkspaceProvider></SearchParamsContext.Provider>));
    for (const view of ["suppliers", "items"] as const) {
      await click(`[data-view="${view}"]`);
      await waitFor(() => !!host.querySelector(".erp-table") && host.querySelector(".list-record-count")?.textContent !== "—");
      assert.ok(host.querySelector(".toolbar-search input"));
      assert.ok(host.querySelector(".list-filter-controls select"));
      const count = Number(host.querySelector(".list-record-count")!.textContent!.replaceAll(".", ""));
      assert.ok(Number.isFinite(count));
    }
    for (const domain of ["procurement", "sales"] as const) {
      await click(`[data-view="${domain}"]`);
      await waitFor(() => host.querySelector(".summary-strip")?.getAttribute("aria-busy") === "false" && !!host.querySelector(".erp-table"));
      let summary!: PurchaseSummary | SalesSummary;
      await act(async () => { summary = await (await fetch(`/api/companies/alpha/${domain}/summary`)).json(); });
      assert.deepEqual(values(), tradeMetrics(domain, summary, "IDR").map(m => m.value));
      const destinations = [...host.querySelectorAll<HTMLAnchorElement>(".workflow-strip a")].map(a => a.getAttribute("href"));
      assert.equal(destinations.length, 5);
      assert.ok(destinations.every(href => href?.startsWith("/") && !href.includes("undefined")));
      assert.match(host.querySelector(".list-panel-context")!.textContent!, /Alpha/);
    }
    await click('[data-view="accounting"]');
    await waitFor(() => host.querySelector(".summary-strip")?.getAttribute("aria-busy") === "false");
    let accounting!: { activeLedger: number; posted: number; drafts: number };
    await act(async () => { accounting = await (await fetch("/api/companies/alpha/accounting/summary")).json(); });
    assert.deepEqual(values(), [accounting.activeLedger, accounting.posted, accounting.drafts].map(number));
    assert.deepEqual([...host.querySelectorAll(".module-shortcut")].map(n => n.getAttribute("href")), ["/automatic-accounting", "/chart-of-accounts", "/journal-entries", "/general-ledger", "/trial-balance"]);
    assert.equal(host.querySelectorAll(".settlement-link").length, 3);
    await click('[data-view="sales"]');
    await click('[data-company="beta"]');
    await waitFor(() => host.querySelector("[data-company-name]")?.textContent?.includes("Beta") === true && host.querySelector(".summary-strip")?.getAttribute("aria-busy") === "false" && !!host.querySelector(".erp-table"));
    let beta!: SalesSummary;
    await act(async () => { beta = await (await fetch("/api/companies/beta/sales/summary")).json(); });
    assert.deepEqual(values(), tradeMetrics("sales", beta, "IDR").map(m => m.value));
    assert.match(host.querySelector(".list-panel-context")!.textContent!, /Beta/);
  } finally {
    await act(async () => root.unmount());
    localStorage.clear();
  }
});
