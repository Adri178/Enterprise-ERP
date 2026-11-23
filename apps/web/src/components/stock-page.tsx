"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Info, Loader2, Package, Search } from "lucide-react";
import { id } from "@/lib/i18n";
import { isLive } from "@/lib/api";
import { useCatalogList } from "@/lib/catalog-hooks";
import { useWorkspace } from "./workspace-provider";
import { PageHeader } from "./page-header";
import { Button } from "./ui/button";
import { StockLedgerPage } from "./stock-ledger-page";
export function StockPage() {
  return isLive ? <StockLedgerPage /> : <DemoStockPage />;
}
function DemoStockPage() {
  const { records, company, refresh } = useWorkspace();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const result = useCatalogList("items", {
    q: query,
    page,
    pageSize: 10,
    sort: "name",
    direction: "asc",
  });
  return (
    <>
      <PageHeader
        title={id.stockOverview}
        parent="Inventory"
        description={`${company.name} · ${id.inventorySubtitle}`}
      />
      <div className="notice mb-5">
        <Info size={16} className="shrink-0" />
        {id.stockHint} {isLive ? id.planned : id.demoHint}
      </div>
      <section className="panel overflow-hidden">
        <div className="table-toolbar">
          <div className="toolbar-search">
            <Search size={15} />
            <input
              className="field"
              aria-label={id.search}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder={id.searchRecords}
            />
          </div>
          <Link href="/warehouses" className="text-link">
            Warehouses
            <ArrowRight size={13} />
          </Link>
        </div>
        {result.loading ? (
          <div className="empty-state" role="status">
            <Loader2 size={25} className="animate-spin" />
            <p>{id.loading}</p>
          </div>
        ) : result.error ? (
          <div className="empty-state">
            <h3>{id.error}</h3>
            <p>{result.error}</p>
            <Button className="mt-3" variant="outline" onClick={refresh}>
              {id.retry}
            </Button>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Items</th>
                  <th>Warehouse</th>
                  <th>{id.stockAvailable}</th>
                  <th>{id.stockMinimum}</th>
                  <th>{id.status}</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((item) => {
                  const index = Number(item.id.split("-").at(-1)) || 0;
                  const tracked = item.trackStock !== false;
                  return (
                    <tr key={item.id}>
                      <td>
                        <span className="font-medium text-slate-700">
                          {item.name}
                        </span>
                        <span className="mt-1 block text-[9px] text-slate-400">
                          {item.code}
                        </span>
                      </td>
                      <td>
                        {isLive ? "—" : records.warehouses[0]?.name || "—"}
                      </td>
                      <td>
                        {isLive || !tracked
                          ? "—"
                          : `${index < 2 ? 8 + index : 50 + index * 15} ${item.unit || "pcs"}`}
                      </td>
                      <td>{`${item.reorderLevel || 0} ${item.unit || "pcs"}`}</td>
                      <td>
                        <span
                          className={
                            !isLive && tracked && index < 2
                              ? "text-amber-600"
                              : "text-muted-foreground"
                          }
                        >
                          {!tracked
                            ? id.notTracked
                            : isLive
                              ? id.planned
                              : index < 2
                                ? id.lowStock
                                : id.available}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!result.data.length && (
              <div className="empty-state">
                <Package size={28} />
                <h3>{id.empty}</h3>
                <p>{id.emptyHint}</p>
              </div>
            )}
          </div>
        )}
        <div className="list-pagination">
          <span>
            {id.showing(
              result.meta.total ? (result.meta.page - 1) * 10 + 1 : 0,
              Math.min(result.meta.page * 10, result.meta.total),
              result.meta.total,
            )}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={result.meta.page <= 1 || result.loading}
              onClick={() => setPage((value) => value - 1)}
            >
              {id.previous}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={
                result.meta.page >= result.meta.pageCount || result.loading
              }
              onClick={() => setPage((value) => value + 1)}
            >
              {id.next}
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
