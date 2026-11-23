"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Info, Loader2, Package, Search } from "lucide-react";
import type { PageResult, StockBalanceRow, StockLedgerRow } from "@erp/shared";
import { id } from "@/lib/i18n";
import { isLive } from "@/lib/api";
import { useCompanyResource } from "@/lib/company-resource";
import { useDebouncedValue } from "@/lib/catalog-hooks";
import { date, money, number } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { PageHeader } from "./page-header";
import { RecordSelect } from "./record-select";
import { PurchaseDetail } from "./purchase-detail";
import { StockOperationDetail } from "./stock-operation-detail";
import { TradeDetail } from "./trade-detail";
import { WorkOrderDetail } from "./work-order-detail";
import { Button } from "./ui/button";
export function StockLedgerPage({ ledger = false }: { ledger?: boolean }) {
  const { company } = useWorkspace();
  return <StockLedgerView key={`${company.id}:${ledger}`} ledger={ledger} />;
}
function StockLedgerView({ ledger }: { ledger: boolean }) {
  const { company, refresh } = useWorkspace();
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [warehouse, setWarehouse] = useState({ id: "", name: "" }),
    [selected, setSelected] = useState<{
      id: string;
      kind: StockLedgerRow["documentKind"];
    } | null>(null);
  const q = useDebouncedValue(query);
  const params = new URLSearchParams({
    q,
    page: String(page),
    pageSize: "10",
    ...(warehouse.id ? { warehouseId: warehouse.id } : {}),
  });
  const result = useCompanyResource<
    PageResult<StockBalanceRow | StockLedgerRow>
  >(`stock/${ledger ? "ledger" : "balances"}?${params}`);
  return (
    <>
      <PageHeader
        title={ledger ? id.stockLedger : id.stockOverview}
        parent="Inventory"
        description={`${company.name} Â· ${ledger ? id.stockLedgerHint : id.inventorySubtitle}`}
        actions={
          <Button asChild>
            <Link href="/purchase-receipts">
              {id.purchaseReceipt}
              <ArrowRight />
            </Link>
          </Button>
        }
      />
      <div className="notice mb-5">
        <Info size={16} className="shrink-0" />
        <p>{isLive ? id.stockReceiptReady : id.workflowLiveOnly}</p>
      </div>
      <section className="panel overflow-hidden">
        <div className="table-toolbar !items-end">
          <div className="toolbar-search">
            <Search size={15} />
            <input
              className="field"
              value={query}
              aria-label={id.search}
              placeholder={id.searchRecords}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="w-60 max-w-[60vw]">
              <RecordSelect
                required={false}
                kind="warehouses"
                label="Warehouse"
                value={warehouse.id}
                selectedLabel={warehouse.name || id.allWarehouses}
                onChange={(r) => {
                  setWarehouse({ id: r.id, name: r.name });
                  setPage(1);
                }}
              />
            </div>
            {warehouse.id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setWarehouse({ id: "", name: "" });
                  setPage(1);
                }}
              >
                {id.reset}
              </Button>
            )}
          </div>
        </div>
        {result.loading ? (
          <div className="empty-state">
            <Loader2 className="animate-spin" />
            <p>{id.loading}</p>
          </div>
        ) : result.error ? (
          <div className="empty-state" role="alert">
            <h3>{id.error}</h3>
            <p>{result.error}</p>
            <Button variant="outline" className="mt-3" onClick={refresh}>
              {id.retry}
            </Button>
          </div>
        ) : !result.data?.data.length ? (
          <div className="empty-state">
            <Package size={30} />
            <h3>{query ? id.empty : id.noStock}</h3>
            <p>{isLive ? id.noStockHint : id.workflowLiveOnly}</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="erp-table">
              <thead>
                <tr>
                  {ledger && (
                    <>
                      <th>{id.document}</th>
                      <th>{id.type}</th>
                      <th>{id.date}</th>
                    </>
                  )}
                  <th>Items</th>
                  <th>Warehouse</th>
                  <th>{id.quantity}</th>
                  <th>{id.stockValue}</th>
                </tr>
              </thead>
              <tbody>
                {result.data.data.map((row) => (
                  <tr key={row.id}>
                    {"documentId" in row && (
                      <>
                        <td>
                          <button
                            className="text-link"
                            onClick={() =>
                              setSelected({
                                id: row.documentId,
                                kind: row.documentKind,
                              })
                            }
                          >
                            {row.documentNumber}
                          </button>
                        </td>
                        <td>
                          {row.documentKind === "TRANSFER"
                            ? id.stockTransfer
                            : row.documentKind === "ADJUSTMENT"
                              ? id.stockAdjustment
                              : row.documentKind === "DELIVERY_NOTE"
                                ? id.deliveryNote
                                : row.documentKind === "WORK_ORDER" ? id.workOrder
                                : id.purchaseReceipt}
                        </td>
                        <td className="whitespace-nowrap">{date(row.date)}</td>
                      </>
                    )}
                    <td>
                      <strong className="block text-xs font-medium">
                        {row.itemName}
                      </strong>
                      <span className="text-[10px] text-muted-foreground">
                        {row.itemCode}
                      </span>
                    </td>
                    <td>{row.warehouseName}</td>
                    <td
                      className={row.quantity < 0 ? "text-red-700" : undefined}
                    >
                      {number(row.quantity)} {row.unit}
                    </td>
                    <td className="whitespace-nowrap font-medium">
                      {money(row.value, company.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="list-pagination">
          <span>
            {id.showing(
              result.data?.meta.total
                ? (result.data.meta.page - 1) * 10 + 1
                : 0,
              Math.min(
                (result.data?.meta.page || 1) * 10,
                result.data?.meta.total || 0,
              ),
              result.data?.meta.total || 0,
            )}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || result.loading}
              onClick={() => setPage(page - 1)}
            >
              {id.previous}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={
                page >= (result.data?.meta.pageCount || 1) || result.loading
              }
              onClick={() => setPage(page + 1)}
            >
              {id.next}
            </Button>
          </div>
        </div>
      </section>
      {selected?.kind === "PURCHASE_RECEIPT" && (
        <PurchaseDetail
          key={selected.id}
          documentId={selected.id}
          onClose={() => setSelected(null)}
          onChanged={refresh}
        />
      )}
      {selected && ["TRANSFER", "ADJUSTMENT"].includes(selected.kind) && (
        <StockOperationDetail
          key={selected.id}
          documentId={selected.id}
          onClose={() => setSelected(null)}
          onChanged={refresh}
        />
      )}
      {selected?.kind === "WORK_ORDER" && <WorkOrderDetail key={selected.id} documentId={selected.id} onClose={() => setSelected(null)} onChanged={refresh} />}
      {selected?.kind === "DELIVERY_NOTE" && (
        <TradeDetail
          domain="sales"
          key={selected.id}
          documentId={selected.id}
          onClose={() => setSelected(null)}
          onChanged={refresh}
        />
      )}
    </>
  );
}
