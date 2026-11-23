"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { accountingPeriodSchema, ledgerQuerySchema, type GeneralLedger, type TrialBalance } from "@erp/shared";
import { Download, Info } from "lucide-react";
import { toast } from "sonner";
import { api, isLive } from "@/lib/api";
import { useCompanyResource } from "@/lib/company-resource";
import { id } from "@/lib/i18n";
import { date, exactMoney, exportCsv } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { PageHeader } from "./page-header";
import { AccountSelect } from "./account-select";
import { AccountingNotice } from "./accounting-notice";
import { JournalDetail } from "./journal-detail";
import { ResourceState, ListPagination } from "./list-state";
import { Button } from "./ui/button";
export function AccountingReportsPage({ kind }: { kind: "ledger" | "trial" }) {
  const { company } = useWorkspace(), search = useSearchParams(), request = search.toString();
  const [source, setSource] = useState({ request, companyId: company.id });
  // A URL-selected Account belongs to the Company in which the link was opened.
  if (source.request !== request || (!source.companyId && company.id)) setSource({ request, companyId: company.id });
  return <AccountingReport key={`${company.id}:${kind}:${request}`} kind={kind} initialAccountId={source.companyId === company.id ? search.get("accountId") || "" : ""} />;
}
function AccountingReport({ kind, initialAccountId }: { kind: "ledger" | "trial"; initialAccountId: string }) {
  const { company, refresh } = useWorkspace(), search = useSearchParams(), today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const initial = { from: search.get("from") || `${today.slice(0, 7)}-01`, to: search.get("to") || today, accountId: initialAccountId };
  const validInitial = accountingPeriodSchema.safeParse(initial);
  const defaults = validInitial.success ? initial : { from: `${today.slice(0, 7)}-01`, to: today, accountId: initial.accountId };
  const [filters, setFilters] = useState(defaults), [draft, setDraft] = useState(defaults), [label, setLabel] = useState(""), [validation, setValidation] = useState(""), [page, setPage] = useState(1), [selected, setSelected] = useState<string | null>(null), [exporting, setExporting] = useState(false);
  const controller = useRef<AbortController | null>(null), endpoint = kind === "ledger" ? "ledger" : "trial-balance", enabled = kind === "trial" || !!filters.accountId;
  const params = new URLSearchParams({ from: filters.from, to: filters.to, page: String(page), pageSize: "10", ...(kind === "ledger" ? { accountId: filters.accountId } : {}) }), path = `accounting/${endpoint}?${params}`;
  const result = useCompanyResource<GeneralLedger | TrialBalance>(path, 0, enabled), data = result.data, ledger = data && "account" in data ? data : undefined, trial = data && "totals" in data ? data : undefined;
  useEffect(() => { controller.current?.abort(); setExporting(false); return () => controller.current?.abort(); }, [path]);
  const summary = ledger ? [[id.ledgerOpening, ledger.opening], [id.totalDebit, ledger.debit], [id.totalCredit, ledger.credit], [id.ledgerClosing, ledger.closing]] : trial ? [[id.totalDebit, trial.totals.debit], [id.totalCredit, trial.totals.credit], [id.closingDebit, trial.totals.closingDebit], [id.closingCredit, trial.totals.closingCredit]] : [];
  async function download() {
    const request = new AbortController(); controller.current?.abort(); controller.current = request; setExporting(true);
    try {
      const report = await api<GeneralLedger | TrialBalance>(`/companies/${company.id}/accounting/${endpoint}/export?${params}`, { signal: request.signal });
      if (request.signal.aborted) return;
      const rows: (string | number)[][] = [[id.company, company.name], [id.currency, company.currency], [id.reportFrom, report.period.from], [id.reportTo, report.period.to], [id.reportGenerated, report.generatedAt]];
      if ("account" in report) rows.push([id.account, `${report.account.code} · ${report.account.name}`], [id.ledgerOpening, report.opening], [id.totalDebit, report.debit], [id.totalCredit, report.credit], [id.ledgerClosing, report.closing], [], [id.documentNumber, id.date, id.description, id.debit, id.credit, id.ledgerRunning], ...report.data.map((r) => [r.number, r.date, r.description, r.debit, r.credit, r.balance]));
      else rows.push([id.totalDebit, report.totals.debit], [id.totalCredit, report.totals.credit], [id.closingDebit, report.totals.closingDebit], [id.closingCredit, report.totals.closingCredit], [], [id.accountCode, id.accountName, id.ledgerOpening, id.debit, id.credit, id.closingDebit, id.closingCredit], ...report.data.map((r) => [r.code, r.name, r.opening, r.debit, r.credit, r.closingDebit, r.closingCredit]));
      exportCsv(`${endpoint}-${company.code}-${filters.from}-${filters.to}.csv`, rows); toast.success(id.exportReady);
    } catch (e) { if (!request.signal.aborted) toast.error(e instanceof Error ? e.message : id.error); }
    finally { if (controller.current === request) setExporting(false); }
  }
  return <><PageHeader title={kind === "ledger" ? id.generalLedger : id.trialBalance} parent={id.accountingTitle} description={`${company.name} · ${kind === "ledger" ? id.ledgerDescription : id.trialDescription}`} actions={<Button variant="outline" disabled={!isLive || !data || result.loading || exporting} onClick={download}><Download />{exporting ? id.exporting : id.exportReport}</Button>} /><AccountingNotice />
    <form className="panel mb-5 space-y-3 p-5" onSubmit={(e) => { e.preventDefault(); const parsed = (kind === "ledger" ? ledgerQuerySchema : accountingPeriodSchema).safeParse(draft); if (!parsed.success) { setValidation(parsed.error.issues[0].message); return; } setValidation(""); setFilters(draft); setPage(1); }}><div className={`grid items-end gap-3 sm:grid-cols-2 ${kind === "ledger" ? "xl:grid-cols-[1.5fr_1fr_1fr_auto]" : "xl:grid-cols-[1fr_1fr_auto]"}`}>
      {kind === "ledger" && <AccountSelect value={draft.accountId} selectedLabel={label || (ledger?.account.id === draft.accountId ? `${ledger.account.code} · ${ledger.account.name}` : undefined)} includeInactive onChange={(r) => { setDraft((v) => ({ ...v, accountId: r.id })); setLabel(`${r.code} · ${r.name}`); }} />}
      <label><span className="field-label">{id.reportFrom} *</span><input className="field" type="date" value={draft.from} required onChange={(e) => setDraft((v) => ({ ...v, from: e.target.value }))} /></label><label><span className="field-label">{id.reportTo} *</span><input className="field" type="date" value={draft.to} required onChange={(e) => setDraft((v) => ({ ...v, to: e.target.value }))} /></label><Button type="submit">{id.apply}</Button>
    </div><p className="text-[11px] text-muted-foreground">{id.ledgerPeriodHint}</p>{validation && <p role="alert" className="field-error">{validation}</p>}</form>
    <p className="mb-4 text-[11px] text-muted-foreground">{date(filters.from)} – {date(filters.to)} · {company.currency}</p>
    {!isLive ? <div className="panel empty-state"><p>{id.accountingLiveOnly}</p></div> : !enabled ? <div className="panel empty-state"><p>{id.ledgerPickHint}</p></div> : result.loading || result.error ? <div className="panel"><ResourceState error={result.error} retry={refresh} /></div> : data && <>
      <div className="metric-grid mb-5">{summary.map(([name, value]) => <div className="panel metric" key={name}><span className="metric-label">{name}</span><strong className="metric-value !text-lg block" title={exactMoney(value, company.currency)}>{exactMoney(value, company.currency)}</strong></div>)}</div>
      <section className="panel overflow-hidden"><div className="flex items-center justify-between gap-3 border-b px-5 py-4"><h2 className="section-heading">{ledger ? `${ledger.account.code} · ${ledger.account.name}` : id.trialBalance}</h2><span className="text-[10px] text-muted-foreground">{id.ledgerExportHint}</span></div>
        <div className="table-scroll">{ledger ? <table className="erp-table" aria-label={id.generalLedger}><thead><tr><th>{id.date}</th><th>{id.documentNumber}</th><th>{id.description}</th><th>{id.debit}</th><th>{id.credit}</th><th>{id.ledgerRunning}</th></tr></thead><tbody>{ledger.data.map((r) => <tr key={r.id}><td className="whitespace-nowrap">{date(r.date)}</td><td><button className="text-link font-medium" onClick={() => setSelected(r.journalId)}>{r.number}</button></td><td className="max-w-64 truncate" title={r.description}>{r.description}</td><td className="whitespace-nowrap">{exactMoney(r.debit, company.currency)}</td><td className="whitespace-nowrap">{exactMoney(r.credit, company.currency)}</td><td className="whitespace-nowrap font-medium">{exactMoney(r.balance, company.currency)}</td></tr>)}</tbody></table> : trial && <table className="erp-table" aria-label={id.trialBalance}><thead><tr><th>{id.accountCode}</th><th>{id.accountName}</th><th>{id.ledgerOpening}</th><th>{id.debit}</th><th>{id.credit}</th><th>{id.closingDebit}</th><th>{id.closingCredit}</th></tr></thead><tbody>{trial.data.map((r) => <tr key={r.accountId}><td>{r.code}</td><td>{r.name}</td>{[r.opening, r.debit, r.credit, r.closingDebit, r.closingCredit].map((v, i) => <td key={i} className="whitespace-nowrap">{exactMoney(v, company.currency)}</td>)}</tr>)}</tbody><tfoot><tr className="border-t font-semibold"><td colSpan={2}>{id.trialTotals}</td>{[trial.totals.opening, trial.totals.debit, trial.totals.credit, trial.totals.closingDebit, trial.totals.closingCredit].map((v, i) => <td key={i} className="whitespace-nowrap">{exactMoney(v, company.currency)}</td>)}</tr></tfoot></table>}</div>
        {!data.data.length && <div className="empty-state"><h3>{id.empty}</h3><p>{id.emptyHint}</p></div>}<ListPagination meta={data.meta} loading={result.loading} onPage={setPage} />
      </section><p className="mt-3 text-[10px] text-muted-foreground">{id.reportGenerated}: {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(data.generatedAt))}</p>
    </>}
    <div className="notice mt-5 items-start"><Info size={16} className="shrink-0" /><p>{id.ledgerHistoryHint}</p></div>
    {selected && <JournalDetail documentId={selected} onClose={() => setSelected(null)} onChanged={refresh} />}
  </>;
}
