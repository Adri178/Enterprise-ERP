"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, Download, Info, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  reportQuerySchema,
  type InvoiceReport,
  type InvoiceReportExport,
  type ReportDomain,
  type ReportQuery,
} from "@erp/shared";
import { api, isLive } from "@/lib/api";
import { useCompanyResource } from "@/lib/company-resource";
import { id } from "@/lib/i18n";
import { date, exportCsv, money, number } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { PageHeader } from "./page-header";
import { SnapshotReportsPage } from "./module-page";
import { ReportInvoices } from "./report-invoices";
import { TradeDetail } from "./trade-detail";
import { Button } from "./ui/button";

function period(preset: "month" | "last" | "year" = "month") {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  if (preset === "last") {
    const last = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
    last.setUTCDate(0);
    return {
      from: `${last.toISOString().slice(0, 7)}-01`,
      to: last.toISOString().slice(0, 10),
    };
  }
  return {
    from:
      preset === "year"
        ? `${today.slice(0, 4)}-01-01`
        : `${today.slice(0, 7)}-01`,
    to: today,
  };
}
const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("id-ID", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));

export function ReportsPage() {
  const { company } = useWorkspace();
  return isLive ? (
    <OperationalReports key={company.id} />
  ) : (
    <SnapshotReportsPage />
  );
}
function OperationalReports() {
  const { company, refresh } = useWorkspace();
  const [filters, setFilters] = useState(() =>
    reportQuerySchema.parse(period()),
  );
  const [draft, setDraft] = useState(() => ({
    ...period(),
    q: "",
    settlement: "ALL" as ReportQuery["settlement"],
  }));
  const [validation, setValidation] = useState("");
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const exportRequest = useRef<AbortController | null>(null);
  const params = new URLSearchParams(
    Object.entries(filters).map(([k, v]) => [k, String(v)]),
  );
  const path = `reports/invoices?${params}`;
  const report = useCompanyResource<InvoiceReport>(path, revision);
  useEffect(() => {
    exportRequest.current?.abort();
    setExporting(false);
    return () => exportRequest.current?.abort();
  }, [path]);
  const open = useCallback((documentId: string) => setSelected(documentId), []);
  const domainLabel =
    filters.domain === "sales" ? id.salesInvoice : id.purchaseInvoice;
  const partyLabel = filters.domain === "sales" ? "Customers" : "Suppliers";
  const changed = () => {
    setRevision((v) => v + 1);
    refresh();
  };
  function apply(next = draft) {
    const result = reportQuerySchema.safeParse({
      ...filters,
      ...next,
      page: 1,
    });
    if (!result.success) {
      setValidation(result.error.issues[0].message);
      return;
    }
    setValidation("");
    setFilters(result.data);
  }
  function choosePreset(value: "month" | "last" | "year") {
    const next = { ...draft, ...period(value) };
    setDraft(next);
    apply(next);
  }
  async function download() {
    if (exporting) return;
    const controller = new AbortController();
    exportRequest.current?.abort();
    exportRequest.current = controller;
    setExporting(true);
    try {
      const data = await api<InvoiceReportExport>(
        `/companies/${company.id}/reports/invoices/export?${params}`,
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      exportCsv(
        `report-${filters.domain}-${company.code}-${filters.from}-${filters.to}.csv`,
        [
          [id.company, company.name],
          [id.reportDomain, domainLabel],
          [id.reportFrom, data.period.from],
          [id.reportTo, data.period.to],
          [id.search, filters.q],
          [
            id.reportSettlement,
            filters.settlement === "ALL"
              ? id.allStatus
              : filters.settlement === "PAID"
                ? id.paid
                : id.unpaid,
          ],
          [id.reportGenerated, data.generatedAt],
          [id.reportCount, data.summary.count],
          [id.reportAmount, data.summary.amount],
          [id.reportSettled, data.summary.settled],
          [id.reportOutstanding, data.summary.outstanding],
          [],
          [
            id.documentNumber,
            filters.domain === "sales" ? id.customer : id.supplier,
            id.date,
            id.currency,
            id.reportAmount,
            id.reportSettled,
            id.reportOutstanding,
            id.paymentStatus,
            id.payment,
            id.reportPaymentDate,
          ],
          ...data.data.map((row) => [
            row.number,
            row.partyName,
            row.date,
            row.currency,
            row.amount,
            row.settled,
            row.outstanding,
            row.outstanding === 0 ? id.paid : id.unpaid,
            row.paymentNumber || "",
            row.paymentDate || "",
          ]),
        ],
      );
      toast.success(id.exportReady);
    } catch (error) {
      if (!controller.signal.aborted)
        toast.error(error instanceof Error ? error.message : id.error);
    } finally {
      if (exportRequest.current === controller) setExporting(false);
    }
  }
  const summary = report.data?.summary;
  const cards = [
    {
      label: id.reportAmount,
      value: money(summary?.amount || 0, company.currency),
    },
    {
      label: id.reportSettled,
      value: money(summary?.settled || 0, company.currency),
    },
    {
      label: id.reportOutstanding,
      value: money(summary?.outstanding || 0, company.currency),
    },
    { label: id.reportCount, value: number(summary?.count || 0) },
  ];
  return (
    <>
      <PageHeader
        title={id.reportsTitle}
        description={`${company.name} · ${id.reportsDescription}`}
        actions={
          <Button
            variant="outline"
            disabled={report.loading || !report.data?.meta.total || exporting}
            onClick={download}
          >
            <Download />
            {exporting ? id.exporting : id.exportReport}
          </Button>
        }
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div
          className="flex gap-1 rounded-lg bg-muted p-1"
          role="group"
          aria-label={id.reportDomain}
        >
          {(["sales", "procurement"] as ReportDomain[]).map((domain) => (
            <Button
              key={domain}
              size="sm"
              variant={filters.domain === domain ? "outline" : "ghost"}
              aria-pressed={filters.domain === domain}
              onClick={() => {
                setSelected(null);
                setFilters((v) => ({ ...v, domain, page: 1 }));
              }}
            >
              {domain === "sales" ? id.salesInvoice : id.purchaseInvoice}
            </Button>
          ))}
        </div>
        <Link
          className="text-link flex items-center gap-1 text-xs"
          href="/stock-overview"
        >
          {id.stockOverview}
          <ArrowRight size={13} />
        </Link>
      </div>
      <form
        className="panel mb-5 p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.4fr_1fr_auto]">
          <label className="space-y-1.5 text-xs font-medium">
            {id.reportFrom}
            <input
              className="field"
              type="date"
              required
              aria-describedby="report-period-help"
              value={draft.from}
              onChange={(e) =>
                setDraft((v) => ({ ...v, from: e.target.value }))
              }
            />
          </label>
          <label className="space-y-1.5 text-xs font-medium">
            {id.reportTo}
            <input
              className="field"
              type="date"
              required
              aria-describedby="report-period-help"
              value={draft.to}
              onChange={(e) => setDraft((v) => ({ ...v, to: e.target.value }))}
            />
          </label>
          <label className="space-y-1.5 text-xs font-medium">
            {id.search}
            <span className="toolbar-search block">
              <Search size={14} />
              <input
                className="field"
                placeholder={id.reportSearch}
                maxLength={120}
                value={draft.q}
                onChange={(e) => setDraft((v) => ({ ...v, q: e.target.value }))}
              />
            </span>
          </label>
          <label className="space-y-1.5 text-xs font-medium">
            {id.paymentStatus}
            <select
              className="field"
              value={draft.settlement}
              onChange={(e) =>
                setDraft((v) => ({
                  ...v,
                  settlement: e.target.value as ReportQuery["settlement"],
                }))
              }
            >
              <option value="ALL">{id.allStatus}</option>
              <option value="PAID">{id.paid}</option>
              <option value="UNPAID">{id.unpaid}</option>
            </select>
          </label>
          <Button type="submit">{id.apply}</Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p
            id="report-period-help"
            className="text-[11px] text-muted-foreground"
          >
            {id.reportPeriodHint}
          </p>
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => choosePreset("month")}
            >
              {id.thisMonth}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => choosePreset("last")}
            >
              {id.lastMonth}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => choosePreset("year")}
            >
              {id.thisYear}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => {
                const next = { ...period(), q: "", settlement: "ALL" as const };
                setDraft(next);
                apply(next);
              }}
            >
              {id.reset}
            </Button>
          </div>
        </div>
        {validation && (
          <p className="field-error mt-2" role="alert">
            {validation}
          </p>
        )}
      </form>
      <div className="mb-4 flex flex-wrap justify-between gap-2 text-[11px] text-muted-foreground">
        <span>
          {domainLabel} · {date(filters.from)} – {date(filters.to)}
        </span>
        <span>
          {id.reportAsOf} {date(filters.to)}
        </span>
      </div>
      <div className="metric-grid mb-5" aria-live="polite">
        {cards.map((card) => (
          <div className="panel metric" key={card.label}>
            <span className="metric-label">{card.label}</span>
            <strong className="metric-value block">
              {report.data ? card.value : "—"}
            </strong>
          </div>
        ))}
      </div>
      {report.loading ? (
        <div className="panel empty-state" role="status">
          <Loader2 className="animate-spin" />
          <p>{id.loading}</p>
        </div>
      ) : report.error ? (
        <div className="panel empty-state" role="alert">
          <h2>{id.error}</h2>
          <p>{report.error}</p>
          <Button className="mt-4" variant="outline" onClick={changed}>
            {id.retry}
          </Button>
        </div>
      ) : (
        report.data && (
          <>
            <div className="mb-5 grid gap-5 xl:grid-cols-[1.7fr_1fr]">
              <section className="panel p-5">
                <h2 className="section-heading">{id.reportTrend}</h2>
                <p className="section-description">{id.reportTrendHint}</p>
                <div
                  className="mt-5 h-56 w-full"
                  role="img"
                  aria-label={`${id.reportTrend}: ${money(summary?.amount || 0, company.currency)}`}
                >
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart
                      data={report.data.monthly}
                      margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                    >
                      <CartesianGrid vertical={false} stroke="#edf0f2" />
                      <XAxis
                        dataKey="month"
                        tickFormatter={monthLabel}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: "#89949a" }}
                      />
                      <YAxis
                        width={65}
                        tickFormatter={(v) =>
                          new Intl.NumberFormat("id-ID", {
                            notation: "compact",
                          }).format(v)
                        }
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: "#89949a" }}
                      />
                      <Tooltip
                        labelFormatter={(value) => monthLabel(String(value))}
                        formatter={(value) => [
                          money(Number(value), company.currency),
                          id.reportAmount,
                        ]}
                        contentStyle={{
                          borderRadius: 8,
                          fontSize: 12,
                          border: "1px solid #e7ebed",
                        }}
                      />
                      <Bar
                        dataKey="amount"
                        fill="#438e70"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={50}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <section className="panel p-5">
                <h2 className="section-heading">
                  {id.reportParties(partyLabel)}
                </h2>
                <p className="section-description">{id.reportTopHint}</p>
                <ol className="mt-4 divide-y divide-border">
                  {report.data.parties.map((party, index) => (
                    <li
                      key={party.partyId}
                      className="flex items-center gap-3 py-3"
                    >
                      <span className="text-xs text-muted-foreground">
                        {index + 1}.
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-xs font-medium"
                          title={party.partyName}
                        >
                          {party.partyName}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {number(party.count)} {id.invoiceLabel}
                        </p>
                      </div>
                      <span className="text-xs font-medium">
                        {money(party.amount, company.currency)}
                      </span>
                    </li>
                  ))}
                </ol>
                {!report.data.parties.length && (
                  <p className="py-10 text-center text-xs text-muted-foreground">
                    {id.empty}
                  </p>
                )}
              </section>
            </div>
            <section className="panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
                <h2 className="section-heading">{id.reportRegister}</h2>
                <span className="text-[10px] text-muted-foreground">
                  {id.reportExportHint}
                </span>
              </div>
              <ReportInvoices
                report={report.data}
                domain={filters.domain}
                sort={filters.sort}
                direction={filters.direction}
                onSort={(sort, direction) =>
                  setFilters((v) => ({ ...v, sort, direction, page: 1 }))
                }
                onPage={(page) => setFilters((v) => ({ ...v, page }))}
                onOpen={open}
              />
            </section>
            <p className="mt-3 text-[10px] text-muted-foreground">
              {id.reportGenerated}:{" "}
              {new Intl.DateTimeFormat("id-ID", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Asia/Jakarta",
              }).format(new Date(report.data.generatedAt))}
            </p>
          </>
        )
      )}
      <div className="notice mt-5 items-start">
        <Info size={16} className="mt-0.5 shrink-0" />
        <div>
          <p>{id.reportScope}</p>
          <p className="mt-1">{id.reportHistoryHint}</p>
        </div>
      </div>
      {selected && (
        <TradeDetail
          domain={filters.domain}
          key={`${filters.domain}:${selected}`}
          documentId={selected}
          onClose={() => setSelected(null)}
          onChanged={changed}
        />
      )}
    </>
  );
}
