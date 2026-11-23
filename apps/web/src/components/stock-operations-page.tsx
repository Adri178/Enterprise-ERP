"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowDownUp,
  ArrowRight,
  FileText,
  Info,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import {
  stockOperationStatuses,
  type PageResult,
  type StockOperation,
  type StockOperationKind,
} from "@erp/shared";
import { isLive } from "@/lib/api";
import { id, statusLabels, stockOperationLabels } from "@/lib/i18n";
import { useCompanyResource } from "@/lib/company-resource";
import { useDebouncedValue } from "@/lib/catalog-hooks";
import { date } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { PageHeader } from "./page-header";
import { StockOperationForm } from "./stock-operation-form";
import { StockOperationDetail } from "./stock-operation-detail";
import { StatusBadge } from "./ui/badge";
import { Button } from "./ui/button";
export function StockOperationsPage({ kind }: { kind: StockOperationKind }) {
  const { company, writable, refresh } = useWorkspace();
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("ALL"),
    [page, setPage] = useState(1),
    [direction, setDirection] = useState("desc"),
    [create, setCreate] = useState(false),
    [selected, setSelected] = useState<string | null>(null);
  const q = useDebouncedValue(query),
    label = stockOperationLabels[kind];
  const params = new URLSearchParams({
    kind,
    q,
    status,
    page: String(page),
    pageSize: "10",
    direction,
  });
  const result = useCompanyResource<PageResult<StockOperation>>(
    `stock/operations?${params}`,
  );
  return (
    <>
      <PageHeader
        title={id.list(label)}
        parent="Inventory"
        description={`${company.name} · ${id.stockOperationSubtitle}`}
        actions={
          <Button
            disabled={!isLive || !writable}
            onClick={() => setCreate(true)}
          >
            <Plus />
            {id.createDocument(label)}
          </Button>
        }
      />
      <div className="notice mb-5">
        <Info size={16} className="shrink-0" />
        <p>
          {!isLive
            ? id.workflowLiveOnly
            : kind === "TRANSFER"
              ? id.stockTransferHint
              : id.stockAdjustmentHint}
        </p>
      </div>
      <section className="panel overflow-hidden">
        <div className="table-toolbar">
          <div className="toolbar-search">
            <Search size={15} />
            <input
              className="field"
              aria-label={id.search}
              placeholder={id.stockOperationSearch}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex gap-3">
            <select
              className="field !w-auto"
              aria-label={id.status}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">{id.allStatus}</option>
              {stockOperationStatuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </select>
            <Button asChild variant="outline" size="sm">
              <Link href="/stock-overview">
                {id.stockOverview}
                <ArrowRight />
              </Link>
            </Button>
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
            <FileText size={30} />
            <h3>
              {query || status !== "ALL" ? id.empty : id.stockOperationEmpty}
            </h3>
            <p>
              {!isLive
                ? id.workflowLiveOnly
                : query || status !== "ALL"
                  ? id.emptyHint
                  : id.stockOperationEmptyHint}
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>{id.documentNumber}</th>
                  <th>
                    {kind === "TRANSFER" ? id.sourceWarehouse : "Warehouse"}
                  </th>
                  {kind === "TRANSFER" && <th>{id.targetWarehouse}</th>}
                  <th
                    aria-sort={
                      direction === "desc" ? "descending" : "ascending"
                    }
                  >
                    <button
                      className="flex items-center gap-1"
                      onClick={() =>
                        setDirection((v) => (v === "asc" ? "desc" : "asc"))
                      }
                    >
                      {id.date}
                      <ArrowDownUp size={12} />
                    </button>
                  </th>
                  <th>{id.status}</th>
                  <th>{id.actions}</th>
                </tr>
              </thead>
              <tbody>
                {result.data.data.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <button
                        className="text-link font-medium"
                        onClick={() => setSelected(doc.id)}
                      >
                        {doc.number}
                      </button>
                      <span className="mt-1 block max-w-56 truncate text-[10px] text-muted-foreground">
                        {doc.description}
                      </span>
                    </td>
                    <td>{doc.warehouseName}</td>
                    {kind === "TRANSFER" && <td>{doc.targetWarehouseName}</td>}
                    <td className="whitespace-nowrap">{date(doc.date)}</td>
                    <td>
                      <StatusBadge status={doc.status} />
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelected(doc.id)}
                      >
                        {id.review}
                        <ArrowRight />
                      </Button>
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
              size="sm"
              variant="outline"
              disabled={page <= 1 || result.loading}
              onClick={() => setPage(page - 1)}
            >
              {id.previous}
            </Button>
            <Button
              size="sm"
              variant="outline"
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
      {create && (
        <StockOperationForm
          kind={kind}
          onClose={() => setCreate(false)}
          onSaved={(doc) => {
            setCreate(false);
            setSelected(doc.id);
            refresh();
          }}
        />
      )}
      {selected && (
        <StockOperationDetail
          key={selected}
          documentId={selected}
          onClose={() => setSelected(null)}
          onChanged={refresh}
        />
      )}
    </>
  );
}
