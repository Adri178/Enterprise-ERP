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
  type PageResult,
  type PurchaseDocument,
  type SalesDocument,
  type SalesSummary,
  type PurchaseSummary,
} from "@erp/shared";
import { isLive } from "@/lib/api";
import { useCompanyResource } from "@/lib/company-resource";
import { useDebouncedValue } from "@/lib/catalog-hooks";
import { id, statusLabels } from "@/lib/i18n";
import {
  tradeSpec,
  tradeMetrics,
  toTradeDocument,
  type TradeDomain,
  type TradeKind,
} from "@/lib/trade-ui";
import { date, money } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { PageHeader } from "./page-header";
import { Button } from "./ui/button";
import { StatusBadge } from "./ui/badge";
import { TradeForm } from "./trade-form";
import { TradeDetail } from "./trade-detail";
import { SummaryStrip } from "./summary-strip";
import { ListPanelHeading } from "./list-panel-heading";
export function WorkflowNotice({ domain }: { domain: TradeDomain }) {
  return (
    <div className="notice mb-5">
      <Info size={16} className="shrink-0" />
      <p>{isLive ? tradeSpec(domain).scope : id.workflowLiveOnly}</p>
    </div>
  );
}
export function TradePage({
  domain = "procurement",
  slug = domain === "sales" ? "sales-crm" : "procurement",
  embedded = false,
}: {
  domain?: TradeDomain;
  slug?: string;
  embedded?: boolean;
}) {
  const spec = tradeSpec(domain);
  const fixedKind = spec.routes[slug];
  const { company, writable, refresh } = useWorkspace();
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("ALL"),
    [kind, setKind] = useState<TradeKind | "ALL">(fixedKind || "ALL"),
    [page, setPage] = useState(1),
    [direction, setDirection] = useState("desc"),
    [create, setCreate] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [revision, setRevision] = useState(0);
  const q = useDebouncedValue(query);
  const params = new URLSearchParams({
    q,
    status,
    page: String(page),
    pageSize: "10",
    direction,
    ...(kind !== "ALL" ? { kind } : {}),
  });
  const result = useCompanyResource<
    PageResult<PurchaseDocument | SalesDocument>
  >(`${domain}?${params}`, revision);
  const summary = useCompanyResource<PurchaseSummary | SalesSummary>(
    `${domain}/summary`,
    revision,
    !fixedKind,
  );
  const rows = (result.data?.data || []).map(toTradeDocument);
  const title =
    slug === "accounts-payable"
      ? "Accounts Payable"
      : slug === "accounts-receivable"
        ? "Accounts Receivable"
        : fixedKind
          ? id.list(spec.labels[fixedKind])
          : spec.title;
  function changed() {
    setRevision((v) => v + 1);
    refresh();
  }
  return (
    <>
      {!embedded && (
        <PageHeader
          title={title}
          parent={
            ["payments", "accounts-payable", "accounts-receivable"].includes(
              slug,
            )
              ? "Accounting"
              : fixedKind
                ? spec.title
                : undefined
          }
          description={`${company.name} · ${spec.description}`}
          actions={
            fixedKind && fixedKind !== spec.initialKind ? (
              <Button asChild variant="outline">
                <Link href={spec.initialHref}>
                  <ArrowRight />
                  {spec.labels[spec.initialKind]}
                </Link>
              </Button>
            ) : (
              <Button
                disabled={!isLive || !writable}
                onClick={() => setCreate(true)}
              >
                <Plus />
                {spec.create}
              </Button>
            )
          }
        />
      )}
      <WorkflowNotice domain={domain} />
      {!fixedKind && (
        <>
          <SummaryStrip
            label={`${spec.title} · ${id.overview}`}
            columns={4}
            loading={summary.loading}
            unavailable={!isLive || !!summary.error}
            items={tradeMetrics(domain, summary.data, company.currency).map(card => ({ ...card, hint: id.allPeriods }))}
          />
          {summary.error && (
            <p role="alert" className="field-error mb-4">
              {id.summaryUnavailable}: {summary.error}
            </p>
          )}
          <nav className="workflow-strip" aria-label={`${id.workflow} ${spec.title}`}>
            <span className="workflow-label">{id.workflow}</span>
            {spec.kinds.map((value, index) => (
              <span key={value} className="flex items-center gap-2">
                {index > 0 && (
                  <ArrowRight size={12} className="text-slate-300" />
                )}
                <Link
                  href={`/${Object.entries(spec.routes).find(([route, k]) => k === value && !["accounts-payable", "accounts-receivable"].includes(route))?.[0]}`}
                  className="workflow-step"
                >
                  {spec.labels[value]}
                </Link>
              </span>
            ))}
          </nav>
        </>
      )}
      {fixedKind && fixedKind !== spec.initialKind && (
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
          {id.sourceRequiredHint}
        </p>
      )}
      <section className="panel overflow-hidden">
        <ListPanelHeading title={id.sectionData} count={result.loading || result.error ? undefined : result.data?.meta.total} context={company.name} />
        <div className="table-toolbar">
          <div className="toolbar-search">
            <Search size={15} />
            <input
              className="field"
              aria-label={id.search}
              placeholder={spec.search}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="list-filter-controls">
            {!fixedKind && (
              <select
                className="field !w-auto"
                aria-label={id.type}
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as TradeKind | "ALL");
                  setPage(1);
                }}
              >
                <option value="ALL">{id.allTypes}</option>
                {spec.kinds.map((k) => (
                  <option key={k} value={k}>
                    {spec.labels[k]}
                  </option>
                ))}
              </select>
            )}
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
              {spec.statuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {result.loading ? (
          <div className="empty-state" role="status">
            <Loader2 className="animate-spin" />
            <p>{id.loading}</p>
          </div>
        ) : result.error ? (
          <div className="empty-state" role="alert">
            <h3>{id.error}</h3>
            <p>{result.error}</p>
            <Button className="mt-4" variant="outline" onClick={changed}>
              {id.retry}
            </Button>
          </div>
        ) : !rows.length ? (
          <div className="empty-state">
            <FileText size={30} />
            <h3>{query || status !== "ALL" ? id.empty : spec.empty}</h3>
            <p>
              {query || status !== "ALL"
                ? id.emptyHint
                : isLive
                  ? spec.emptyHint
                  : id.workflowLiveOnly}
            </p>
            {isLive && writable && !query && (
              <Button asChild variant="outline" className="mt-4">
                <Link href={spec.initialHref}>
                  {spec.labels[spec.initialKind]}
                  <ArrowRight />
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>{id.documentNumber}</th>
                  {!fixedKind && <th>{id.type}</th>}
                  <th>{spec.party}</th>
                  <th>
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
                  <th>{id.amount}</th>
                  <th>{id.status}</th>
                  {fixedKind === spec.invoiceKind && (
                    <th>{id.paymentStatus}</th>
                  )}
                  <th>{id.actions}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <button
                        onClick={() => setSelected(doc.id)}
                        className="text-link font-medium"
                      >
                        {doc.number}
                      </button>
                    </td>
                    {!fixedKind && <td>{spec.labels[doc.kind]}</td>}
                    <td>{doc.partyName}</td>
                    <td className="whitespace-nowrap">{date(doc.date)}</td>
                    <td className="whitespace-nowrap font-medium">
                      {money(doc.amount, doc.currency)}
                    </td>
                    <td>
                      <StatusBadge status={doc.status} />
                    </td>
                    {fixedKind === spec.invoiceKind && (
                      <td>
                        {doc.status !== "POSTED" ? (
                          "—"
                        ) : doc.successors.some(
                            (s) =>
                              s.kind === "PAYMENT" && s.status === "POSTED",
                          ) ? (
                          <span className="text-emerald-700">{id.paid}</span>
                        ) : (
                          <span className="text-amber-700">{id.unpaid}</span>
                        )}
                      </td>
                    )}
                    <td>
                      <Button
                        variant="ghost"
                        size="sm"
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
        <TradeForm
          domain={domain}
          onClose={() => setCreate(false)}
          onSaved={(doc) => {
            setCreate(false);
            setSelected(doc.id);
            changed();
          }}
        />
      )}
      {selected && (
        <TradeDetail
          domain={domain}
          key={selected}
          documentId={selected}
          onClose={() => setSelected(null)}
          onChanged={changed}
        />
      )}
    </>
  );
}
