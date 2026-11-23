"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  ClipboardCheck,
  FileClock,
  Info,
  Package,
  Plus,
  ShoppingBag,
  CircleDollarSign,
  Loader2,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  ShoppingCart,
} from "lucide-react";
import type {
  PageResult,
  PurchaseAnalytics,
  PurchaseDocument,
  PurchaseSummary,
  SalesSummary,
  SalesAnalytics,
  SalesDocument,
} from "@erp/shared";
import { useCompanyResource } from "@/lib/company-resource";
import { id, purchaseLabels, salesLabels } from "@/lib/i18n";
import { toTradeDocument, type TradeDomain } from "@/lib/trade-ui";
import { date, money, number } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { PageHeader } from "./page-header";
import { Button } from "./ui/button";
import { StatusBadge } from "./ui/badge";
import { TradeForm } from "./trade-form";
import { TradeDetail } from "./trade-detail";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
export function OperationalDashboard() {
  const { company, writable, refresh } = useWorkspace();
  const summary = useCompanyResource<PurchaseSummary>("procurement/summary");
  const salesSummary = useCompanyResource<SalesSummary>("sales/summary");
  const salesAnalytics =
    useCompanyResource<SalesAnalytics[]>("sales/analytics");
  const analytics = useCompanyResource<PurchaseAnalytics[]>(
    "procurement/analytics",
  );
  const recent = useCompanyResource<PageResult<PurchaseDocument>>(
    "procurement?pageSize=5&direction=desc",
  );
  const recentSales = useCompanyResource<PageResult<SalesDocument>>(
    "sales?pageSize=4&direction=desc",
  );
  const recentRows = [
    ...(recent.data?.data || []).map((row) => ({
      doc: toTradeDocument(row),
      domain: "procurement" as TradeDomain,
    })),
    ...(recentSales.data?.data || []).map((row) => ({
      doc: toTradeDocument(row),
      domain: "sales" as TradeDomain,
    })),
  ]
    .sort(
      (a, b) =>
        b.doc.date.localeCompare(a.doc.date) ||
        b.doc.createdAt.localeCompare(a.doc.createdAt),
    )
    .slice(0, 6);
  const chartData = (analytics.data || []).map((row) => ({
    month: row.month,
    purchases: row.purchases,
    sales: salesAnalytics.data?.find((s) => s.month === row.month)?.sales || 0,
  }));
  const approvals = useCompanyResource<PageResult<PurchaseDocument>>(
    "procurement?kind=PURCHASE_REQUEST&status=PENDING&pageSize=3",
  );
  const [create, setCreate] = useState<TradeDomain | null>(null),
    [selected, setSelected] = useState<{
      id: string;
      domain: TradeDomain;
    } | null>(null);
  const cards = [
    {
      label: id.totalSales,
      value: money(salesSummary.data?.sales || 0, company.currency),
      icon: CircleDollarSign,
      hint: id.workspaceUi.salesBasis,
      unavailable: salesSummary.loading || salesSummary.error,
    },
    {
      label: id.totalPurchases,
      value: money(summary.data?.purchases || 0, company.currency),
      icon: ShoppingBag,
      hint: id.workspaceUi.purchaseBasis,
      unavailable: summary.loading || summary.error,
    },
    {
      label: id.payableOutstanding,
      value: money(summary.data?.outstanding || 0, company.currency),
      icon: FileClock,
      hint: id.purchaseInvoice,
      unavailable: summary.loading || summary.error,
    },
    {
      label: id.receivableOutstanding,
      value: money(salesSummary.data?.outstanding || 0, company.currency),
      icon: FileClock,
      hint: id.salesInvoice,
      unavailable: salesSummary.loading || salesSummary.error,
    },
    {
      label: id.pending,
      value: number(summary.data?.requestsPending || 0),
      icon: ClipboardCheck,
      hint: id.workspaceUi.approvalBasis,
      unavailable: summary.loading || summary.error,
    },
    {
      label: id.inventoryValue,
      value: money(summary.data?.inventoryValue || 0, company.currency),
      icon: Package,
      hint: id.workspaceUi.warehouseBasis,
      unavailable: summary.loading || summary.error,
    },
  ];
  return (
    <div className="operational-dashboard">
      <PageHeader
        title={id.dashboard}
        description={id.operationalDashboard}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/procurement">
                <ShoppingCart />
                {id.workspaceUi.procurement}
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={!writable}>
                  <Plus />
                  {id.createTransaction}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setCreate("procurement")}>
                  {id.createRequest}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setCreate("sales")}>
                  {id.createQuotation}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      <div className="dashboard-context">
        <div className="dashboard-company"><span className="company-dot" /><strong>{company.name}</strong><span>{id.workspaceUi.operational}</span></div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="outline" className="period-control"><CalendarDays />{id.allPeriods}<ChevronDown /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <p className="px-3 py-2 text-xs leading-5 text-muted-foreground">{id.workspaceUi.periodHint}</p>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link href="/reports"><CalendarDays />{id.workspaceUi.periodReports}</Link></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {(summary.error || salesSummary.error) && (
        <div className="notice mb-4" role="alert">
          <p>
            {id.summaryUnavailable}: {summary.error || salesSummary.error}
          </p>
          <Button size="sm" variant="outline" onClick={refresh}>
            {id.retry}
          </Button>
        </div>
      )}
      <div className="metric-grid dashboard-summary" aria-busy={summary.loading || salesSummary.loading}>
        {cards.map(({ label, value, icon: Icon, hint, unavailable }) => (
          <div key={label} className="metric">
            <div className="metric-label">
              <span>{label}</span>
              <span className="metric-icon">
                <Icon size={15} />
              </span>
            </div>
            <strong className="metric-value block">
              {unavailable ? "—" : value}
            </strong>
            <span className="metric-hint">{hint}</span>
          </div>
        ))}
      </div>
      <div className="dashboard-middle">
        <section className="panel chart-panel">
          <div className="chart-topline">
            <div>
              <h2 className="section-heading">{id.financeOverview}</h2>
              <p className="section-description">{id.workspaceUi.chartHint}</p>
            </div>
            <span className="chart-period">{id.workspaceUi.chartPeriod}</span>
          </div>
            <div className="chart-legend dashboard-chart-legend">
              <span>
                <i style={{ background: "#278A5B" }} />
                {id.salesInvoice}
              </span>
              <span>
                <i style={{ background: "#93A7C8" }} />
                {id.purchaseInvoice}
              </span>
            </div>
          {analytics.error || salesAnalytics.error ? (
            <p role="alert" className="field-error mt-8">
              {analytics.error || salesAnalytics.error}
            </p>
          ) : analytics.loading || salesAnalytics.loading ? (
            <div role="status" className="empty-state">
              <Loader2 className="animate-spin" />
              <p>{id.loading}</p>
            </div>
          ) : !chartData.some(row => row.purchases || row.sales) ? (
            <div className="empty-state chart-empty"><ShoppingBag size={28} /><h3>{id.workspaceUi.chartEmpty}</h3><p>{id.workspaceUi.chartEmptyHint}</p></div>
          ) : (
            <div
              className="dashboard-chart"
              role="img"
              aria-label={id.financeOverview}
            >
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="#EDF0F5"
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#626D7E" }}
                    tickFormatter={(v) =>
                      new Intl.DateTimeFormat("id-ID", {
                        month: "short",
                      }).format(new Date(`${v}-01T12:00:00Z`))
                    }
                  />
                  <YAxis
                    width={60}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#626D7E" }}
                    tickFormatter={(v) =>
                      new Intl.NumberFormat("id-ID", {
                        notation: "compact",
                        maximumFractionDigits: 1,
                      }).format(v)
                    }
                  />
                  <Tooltip
                    formatter={(v) => money(Number(v), company.currency)}
                    labelFormatter={(v) =>
                      new Intl.DateTimeFormat("id-ID", {
                        month: "long",
                        year: "numeric",
                      }).format(new Date(`${v}-01T12:00:00Z`))
                    }
                    contentStyle={{
                      borderRadius: 16,
                      border: "1px solid #e7ebee",
                      fontSize: 11,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="purchases"
                    name={id.purchaseInvoice}
                    stroke="#93A7C8"
                    fill="transparent"
                    strokeDasharray="5 4"
                    strokeWidth={1.8}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    name={id.salesInvoice}
                    stroke="#278A5B"
                    fill="#278A5B0D"
                    strokeWidth={2.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
        <section className="panel approval-panel">
          <div className="flex items-center justify-between">
            <h2 className="section-heading">{id.approvals}</h2>
            <span className="approval-count">
              {approvals.data?.meta.total ?? "—"}
            </span>
          </div>
          <p className="section-description">{id.workspaceUi.approvalBasis}</p>
          <div className="approval-content">
            {approvals.loading && <div role="status" className="empty-state"><Loader2 className="animate-spin" /><p>{id.loading}</p></div>}
            {approvals.data?.data.map((doc) => (
              <button
                key={doc.id}
                className="approval-row"
                onClick={() =>
                  setSelected({ id: doc.id, domain: "procurement" })
                }
              >
                <span className="approval-icon">
                  <ClipboardCheck size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <strong>{doc.number}</strong>
                  <small className="truncate">{doc.supplierName}</small>
                </span>
                <ArrowRight size={13} />
              </button>
            ))}
            {!approvals.loading &&
              !approvals.error &&
              !approvals.data?.data.length && (
                <div className="approval-empty"><span className="approval-reviewed"><CircleCheck size={25} /></span><h3>{id.workspaceUi.approvalsClear}</h3><p>{id.workspaceUi.approvalsClearHint}</p></div>
              )}
            {approvals.error && (
              <p role="alert" className="field-error">
                {approvals.error}
              </p>
            )}
          </div>
          <Button asChild variant="outline" className="approval-view">
            <Link href="/purchase-requests">
              <ArrowRight />
              {id.workspaceUi.viewRequests}
            </Link>
          </Button>
        </section>
      </div>
      <section className="panel dashboard-transactions">
        <div className="table-panel-heading">
          <div>
            <h2 className="section-heading">{id.recentTradeDocuments}</h2>
            <p className="section-description">{id.workspaceUi.recentHint}</p>
          </div>
          <Button asChild variant="outline"><Link href="/procurement">
            {id.viewAll}
          </Link></Button>
        </div>
        <div className="table-scroll">
          <table className="erp-table">
            <thead>
              <tr>
                <th>{id.document}</th>
                <th>{id.type}</th>
                <th>{id.relation}</th>
                <th>{id.date}</th>
                <th>{id.amount}</th>
                <th>{id.status}</th>
              </tr>
            </thead>
            <tbody>
              {(recent.loading || recentSales.loading) && <tr><td colSpan={6}><div role="status" className="flex items-center justify-center gap-2 py-7"><Loader2 size={16} className="animate-spin" />{id.loading}</div></td></tr>}
              {recentRows.map(({ doc, domain }) => (
                <tr key={`${domain}:${doc.id}`}>
                  <td>
                    <button
                      className="text-link"
                      onClick={() => setSelected({ id: doc.id, domain })}
                    >
                      {doc.number}
                    </button>
                  </td>
                  <td>
                    {
                      (domain === "sales" ? salesLabels : purchaseLabels)[
                        doc.kind
                      ]
                    }
                  </td>
                  <td>{doc.partyName}</td>
                  <td>{date(doc.date)}</td>
                  <td className="whitespace-nowrap font-medium">
                    {money(doc.amount, doc.currency)}
                  </td>
                  <td>
                    <StatusBadge status={doc.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {recent.error || recentSales.error ? (
          <p role="alert" className="field-error p-5">
            {recent.error || recentSales.error}
          </p>
        ) : (
          !recent.loading &&
          !recentSales.loading &&
          !recentRows.length && (
            <div className="empty-state !py-8">
              <h3>{id.requestEmpty}</h3>
              <p>{id.requestEmptyHint}</p>
            </div>
          )
        )}
      </section>
      <div className="dashboard-scope">
        <Info size={16} className="shrink-0" />
        <p>{id.operationalScope}</p>
      </div>
      {create && (
        <TradeForm
          domain={create}
          onClose={() => setCreate(null)}
          onSaved={(doc) => {
            if (!create) return;
            setSelected({ id: doc.id, domain: create });
            setCreate(null);
            refresh();
          }}
        />
      )}
      {selected && (
        <TradeDetail
          domain={selected.domain}
          key={`${selected.domain}:${selected.id}`}
          documentId={selected.id}
          onClose={() => setSelected(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}
