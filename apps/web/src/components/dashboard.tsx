"use client";
import { useMemo, useState } from "react";
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
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  CircleDollarSign,
  ShoppingBag,
  FileClock,
  ClipboardCheck,
  Download,
  Plus,
  CalendarDays,
  FileText,
  Package,
  UserPlus,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Info,
} from "lucide-react";
import type { Transaction } from "@erp/shared";
import { toast } from "sonner";
import { id, statusLabels } from "@/lib/i18n";
import { date, exportCsv, money, number } from "@/lib/utils";
import { isLive } from "@/lib/api";
import { useWorkspace } from "./workspace-provider";
import { PageHeader } from "./page-header";
import { Button } from "./ui/button";
import { StatusBadge } from "./ui/badge";
import { OperationalDashboard } from "./operational-dashboard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  CreateTransactionDialog,
  TransactionDetail,
} from "./transaction-dialog";

export function Dashboard() {
  return isLive ? <OperationalDashboard /> : <DemoDashboard />;
}
function DemoDashboard() {
  const {
    company,
    transactions,
    records,
    summary,
    writable,
    loading,
    error,
    refresh,
  } = useWorkspace();
  const [period, setPeriod] = useState("2026-10");
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [create, setCreate] = useState<"Purchase Order" | "Sales Order" | null>(
    null,
  );
  const periodRows = transactions.filter(
    (t) => t.date.startsWith(period) && t.status !== "DRAFT",
  );
  const previousMonth = new Date(`${period}-01T12:00:00Z`);
  previousMonth.setUTCMonth(previousMonth.getUTCMonth() - 1);
  const previousRows = transactions.filter(
    (t) =>
      t.date.startsWith(previousMonth.toISOString().slice(0, 7)) &&
      t.status !== "DRAFT",
  );
  const periodDate = new Date(`${period}-01T12:00:00Z`);
  const monthShort = new Intl.DateTimeFormat("id-ID", {
    month: "short",
  }).format(periodDate);
  const daysInMonth = new Date(
    periodDate.getUTCFullYear(),
    periodDate.getUTCMonth() + 1,
    0,
  ).getDate();
  const total = (rows: Transaction[], type: string) =>
    rows.filter((t) => t.type === type).reduce((sum, t) => sum + t.amount, 0);
  const sales = total(periodRows, "Sales Invoice");
  const purchases = total(periodRows, "Purchase Invoice");
  const payableRows = periodRows.filter(t => t.type === "Purchase Invoice" && t.status === "PENDING");
  const receivableRows = periodRows.filter(t => t.type === "Sales Invoice" && t.status === "PENDING");
  const approvals = periodRows.filter((t) => t.status === "PENDING");
  const chartData = useMemo(
    () =>
      [1, 5, 10, 15, 20, 25, daysInMonth].map((day) => ({
        day: String(day).padStart(2, "0"),
        revenue: transactions
          .filter(
            (t) =>
              t.date.startsWith(period) &&
              Number(t.date.slice(-2)) <= day &&
              t.type === "Sales Invoice" &&
              t.status !== "DRAFT",
          )
          .reduce((sum, t) => sum + t.amount, 0),
        expenses: transactions
          .filter(
            (t) =>
              t.date.startsWith(period) &&
              Number(t.date.slice(-2)) <= day &&
              t.type === "Purchase Invoice" &&
              t.status !== "DRAFT",
          )
          .reduce((sum, t) => sum + t.amount, 0),
      })),
    [period, transactions, daysInMonth],
  );
  const trend = (value: number, previous: number) =>
    previous ? ((value - previous) / previous) * 100 : 0;
  const cards = [
    {
      label: id.totalSales,
      value: money(sales, company.currency),
      icon: CircleDollarSign,
      change: previousRows.length
        ? trend(sales, total(previousRows, "Sales Invoice"))
        : undefined,
      foot: previousRows.length ? id.compared : id.noComparison,
    },
    {
      label: id.totalPurchases,
      value: money(purchases, company.currency),
      icon: ShoppingBag,
      change: previousRows.length
        ? trend(purchases, total(previousRows, "Purchase Invoice"))
        : undefined,
      foot: previousRows.length ? id.compared : id.noComparison,
    },
    {
      label: id.payableOutstanding,
      value: money(
        payableRows.reduce((sum, t) => sum + t.amount, 0),
        company.currency,
      ),
      icon: FileClock,
      foot: `${payableRows.length} ${id.invoices} ${id.needsAttention}`,
    },
    {
      label: id.receivableOutstanding,
      value: money(receivableRows.reduce((sum, t) => sum + t.amount, 0), company.currency),
      icon: FileClock,
      foot: id.workspaceUi.demoReceivables,
    },
    {
      label: id.pending,
      value: String(approvals.length).padStart(2, "0"),
      icon: ClipboardCheck,
      foot: `${approvals.length} ${id.documents} ${id.needsAttention}`,
    },
    {
      label: id.inventoryValue,
      value: money(records.items.filter(i => i.status === "ACTIVE").length * 23250000, company.currency),
      icon: Package,
      foot: id.workspaceUi.demoInventory,
    },
  ];
  function download() {
    exportCsv(`ringkasan-${company.code}-${period}.csv`, [
      [
        id.document,
        id.type,
        id.relation,
        id.date,
        id.amount,
        id.currency,
        id.status,
      ],
      ...periodRows.map((t) => [
        t.id,
        t.type,
        t.party,
        t.date,
        t.amount,
        company.currency,
        statusLabels[t.status],
      ]),
    ]);
    toast.success(id.exportReady);
  }
  if (error)
    return (
      <div className="panel empty-state">
        <h3>{id.error}</h3>
        <p>{error}</p>
        <Button className="mt-4" onClick={refresh}>
          {id.retry}
        </Button>
      </div>
    );
  return (
    <div className="operational-dashboard demo-dashboard">
      <PageHeader
        title={id.dashboard}
        description={id.dashboardDescription}
        actions={
          <>
            <Button variant="outline" onClick={download}>
              <Download />
              {id.exportReport}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={!writable || isLive}>
                  <Plus />
                  {id.createTransaction}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setCreate("Purchase Order")}>
                  <ShoppingCart />
                  {id.createPO}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setCreate("Sales Order")}>
                  <FileText />
                  {id.createSO}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      <div className="dashboard-context">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          <span className="font-medium text-slate-600">{company.name}</span>
          <span className="hidden text-slate-300 sm:inline">/</span>
          <span className="hidden sm:inline">{id.overview}</span>
        </div>
        <label className="demo-period-control">
          <CalendarDays size={13} />
          <select
            aria-label={id.date}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="cursor-pointer bg-transparent outline-none"
          >
            {["2026-10", "2026-09"].map((value) => (
              <option key={value} value={value}>
                {new Intl.DateTimeFormat("id-ID", {
                  month: "long",
                  year: "numeric",
                }).format(new Date(`${value}-01T12:00:00Z`))}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="metric-grid dashboard-summary" aria-busy={loading}>
        {cards.map(({ label, value, icon: Icon, change, foot }) => (
          <div className="metric" key={label}>
            <div className="metric-label">
              <span>{label}</span>
              <span className="metric-icon">
                <Icon size={15} strokeWidth={1.6} />
              </span>
            </div>
            <div className="metric-value">{loading ? "—" : value}</div>
            <div className="metric-change">
              {change !== undefined && (
                <span
                  className={change >= 0 ? "trend-positive" : "trend-negative"}
                >
                  {change >= 0 ? (
                    <TrendingUp size={11} />
                  ) : (
                    <TrendingDown size={11} />
                  )}
                  {Math.abs(change).toFixed(1).replace(".", ",")}%
                </span>
              )}
              <span>{foot}</span>
              {change === undefined && (
                <ArrowUpRight size={11} className="ml-auto" />
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="dashboard-middle">
        <section className="panel chart-panel">
          <div className="chart-topline">
            <div>
              <h2 className="section-heading">{id.financeOverview}</h2>
              <p className="section-description">{id.financeSubtitle}</p>
            </div>
            <div className="chart-legend">
              <span>
                <i style={{ background: "#438e70" }} />
                {id.revenue}
              </span>
              <span>
                <i style={{ background: "#bdc7cc" }} />
                {id.expenses}
              </span>
            </div>
          </div>
          <div className="chart-total">
            <strong>{money(sales - purchases, company.currency)}</strong>
            <span>{id.netRevenue}</span>
          </div>
          <div
            className="h-[207px] w-full"
            role="img"
            aria-label={`${id.revenue}: ${money(sales, company.currency)}, ${id.expenses}: ${money(purchases, company.currency)}`}
          >
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart
                data={chartData}
                margin={{ top: 5, right: 3, left: -24, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5b9e7c" stopOpacity={0.16} />
                    <stop offset="100%" stopColor="#5b9e7c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="#edf0f2"
                  strokeDasharray="3 4"
                />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#9ba3aa", fontSize: 9 }}
                  dy={10}
                  tickFormatter={(value) => `${value} ${monthShort}`}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#a5adb3", fontSize: 9 }}
                  tickFormatter={(value) => `${Math.round(value / 1e6)} jt`}
                />
                <Tooltip
                  formatter={(value) => money(Number(value), company.currency)}
                  labelFormatter={(value) =>
                    `${value} ${period === "2026-10" ? "Oktober" : "September"} 2026`
                  }
                  contentStyle={{
                    borderRadius: 9,
                    border: "1px solid #e7ebee",
                    fontSize: 11,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  name={id.expenses}
                  stroke="#b7c1c8"
                  fill="transparent"
                  strokeWidth={1.8}
                  strokeDasharray="5 4"
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name={id.revenue}
                  stroke="#438e70"
                  fill="url(#revenue-fill)"
                  strokeWidth={2.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel approval-panel">
          <div className="flex items-center justify-between">
            <h2 className="section-heading">{id.approvals}</h2>
            <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] text-amber-700">
              {approvals.length}
            </span>
          </div>
          <p className="section-description">{id.approvalSubtitle}</p>
          <div className="mt-2">
            {approvals.slice(0, 3).map((t) => (
              <button
                className="approval-row"
                key={t.id}
                onClick={() => setSelected(t)}
              >
                <span className="approval-icon">
                  <FileText size={16} strokeWidth={1.5} />
                </span>
                <span className="min-w-0 flex-1">
                  <strong>{t.type}</strong>
                  <small className="truncate">{t.party}</small>
                </span>
                <span className="text-[10px] font-medium text-slate-600">
                  {money(t.amount, company.currency, true)}
                </span>
                <ChevronRight size={12} className="text-slate-300" />
              </button>
            ))}
          </div>
          {approvals.length === 0 && (
            <p className="py-12 text-center text-xs text-muted-foreground">
              {id.empty}
            </p>
          )}
          <Link
            href="/procurement"
            className="mt-4 flex items-center justify-center gap-2 border-t border-border pt-4 text-[10px] font-medium text-primary"
          >
            {id.viewAll}
            <ArrowRight size={12} />
          </Link>
        </section>
      </div>
      <section className="panel quick-actions">
        <h2>{id.quickActions}</h2>
        {[
          {
            label: id.createPO,
            icon: ShoppingCart,
            href: "/purchase-orders?new=1",
          },
          { label: id.createSO, icon: FileText, href: "/sales-orders?new=1" },
          { label: id.addSupplier, icon: UserPlus, href: "/suppliers?new=1" },
          { label: id.stockOverview, icon: Package, href: "/stock-overview" },
        ].map(({ label, icon: Icon, href }) => (
          <Link key={label} href={href} className="quick-action">
            <Icon size={15} strokeWidth={1.7} />
            {label}
            <ArrowUpRight className="action-arrow" size={12} />
          </Link>
        ))}
      </section>
      <div className="dashboard-bottom">
        <section className="panel min-w-0 overflow-hidden">
          <div className="table-panel-heading">
            <div>
              <h2 className="section-heading">{id.recentTransactions}</h2>
              <p className="section-description">{id.transactionSubtitle}</p>
            </div>
            <Link href="/reports" className="text-link">
              {id.viewAll}
              <ArrowRight size={12} />
            </Link>
          </div>
          <div className="table-scroll">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>{id.document}</th>
                  <th>{id.relation}</th>
                  <th>{id.status}</th>
                  <th className="text-right">{id.amount}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 5).map((t) => (
                  <tr key={t.id}>
                    <td>
                      <button
                        className="document-link"
                        onClick={() => setSelected(t)}
                      >
                        {t.id}
                      </button>
                      <span className="mt-1 block text-[9px] text-slate-400">
                        {date(t.date)}
                      </span>
                    </td>
                    <td className="max-w-40 truncate">{t.party}</td>
                    <td>
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="text-right font-medium tabular-nums">
                      {money(t.amount, company.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {transactions.length === 0 && (
              <div className="empty-state">
                <FileText size={25} />
                <h3>{id.empty}</h3>
              </div>
            )}
          </div>
        </section>
        <section className="panel stock-panel">
          <div className="flex items-center justify-between">
            <h2 className="section-heading">{id.inventoryValue}</h2>
            <Package size={16} className="text-slate-400" />
          </div>
          <p className="section-description">{id.inventorySubtitle}</p>
          <div className="stock-value">
            {isLive
              ? "—"
              : money(
                  records.items.filter((i) => i.status === "ACTIVE").length *
                    23250000,
                  company.currency,
                )}
          </div>
          <div className="stock-meter">
            <span className="w-[55%]" />
            <span className="w-[29%]" />
            <span className="flex-1" />
          </div>
          <div className="stock-row">
            <span>{id.availableItems}</span>
            <strong>{number(summary.items.active)} Items</strong>
          </div>
          <div className="stock-row">
            <span>{id.warehouseCount}</span>
            <strong>{summary.warehouses.active} Warehouse</strong>
          </div>
          <div className="stock-row">
            <span>{id.lowStock}</span>
            <strong className="!text-amber-600">
              {isLive ? "—" : "2 Items"}
            </strong>
          </div>
          <Button asChild variant="outline" size="sm" className="mt-4 w-full">
            <Link href="/stock-overview">
              {id.inventoryHint}
              <ArrowRight size={12} />
            </Link>
          </Button>
        </section>
      </div>
      <div className="mt-5 flex items-start gap-2 text-[9px] leading-4 text-slate-400">
        <Info size={12} className="mt-0.5 shrink-0" />
        <span>{isLive ? id.previewHint : id.demoHint}</span>
      </div>
      <TransactionDetail
        transaction={selected}
        onClose={() => setSelected(null)}
      />
      <CreateTransactionDialog
        key={`${company.id}-${create}`}
        type={create || "Purchase Order"}
        open={create !== null}
        onClose={() => setCreate(null)}
      />
    </div>
  );
}
