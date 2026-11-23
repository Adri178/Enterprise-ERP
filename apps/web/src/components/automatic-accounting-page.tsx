"use client";
import { useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import type { AccountingPolicyView } from "@erp/shared";
import { accountingPurposes } from "@erp/shared";
import { id, accountingPurposeLabels } from "@/lib/i18n";
import { isLive } from "@/lib/api";
import { date, exactMoney } from "@/lib/utils";
import { useCompanyResource } from "@/lib/company-resource";
import { useWorkspace } from "./workspace-provider";
import { PageHeader } from "./page-header";
import { ResourceState } from "./list-state";
import { Button } from "./ui/button";
import { AccountingActivationForm } from "./accounting-activation-form";
import { JournalDetail } from "./journal-detail";
import { OperationalPostings } from "./operational-postings";
export function AutomaticAccountingPage() { const { company } = useWorkspace(); return <AutomaticAccounting key={company.id} />; }
function AutomaticAccounting() {
  const { company, refresh } = useWorkspace(), [revision, setRevision] = useState(0), [journal, setJournal] = useState<string | null>(null), result = useCompanyResource<AccountingPolicyView>("accounting/policy", revision), row = result.data;
  const changed = () => { setRevision((v) => v + 1); refresh(); };
  return <><PageHeader title={id.automaticAccounting} parent={id.accountingTitle} description={`${company.name} · ${id.automaticDescription}`} actions={<Button variant="outline" onClick={changed}><RefreshCw />{id.accessRefresh}</Button>} />{!isLive ? <div className="panel empty-state"><p>{id.autoPolicyLiveOnly}</p></div> : result.loading || result.error ? <section className="panel"><ResourceState error={result.error} retry={changed} /></section> : row && <><div className="notice mb-5 items-start"><ShieldCheck size={16} className="mt-0.5 shrink-0" /><div><p className="font-medium">{row.enabled ? id.autoEnabled : id.autoDisabled}{row.effectiveFrom && ` · ${date(row.effectiveFrom)}`}</p><p className="mt-1">{row.enabled ? id.autoReadOnly : id.autoBoundaryHint}</p></div></div><section className="panel mb-5 p-5"><h2 className="text-sm font-semibold">{id.autoOpening}</h2><p className="mb-5 mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">{id.autoOpeningHint}</p><dl className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">{([["inventory", accountingPurposeLabels.INVENTORY], ["receivable", accountingPurposeLabels.RECEIVABLE], ["payable", accountingPurposeLabels.PAYABLE], ["grni", accountingPurposeLabels.GRNI], ["equity", id.autoOpeningEquity]] as const).map(([key, label]) => <div key={key}><dt className="text-[10px] text-muted-foreground">{label}</dt><dd className="mt-2 text-sm font-semibold tabular-nums">{exactMoney(row.opening[key], company.currency)}</dd></div>)}</dl><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-[11px] text-muted-foreground"><p>{id.autoLatestDate}: {row.opening.latestDate ? date(row.opening.latestDate) : "—"}</p>{row.openingJournal && <Button variant="ghost" size="sm" onClick={() => setJournal(row.openingJournal!.id)}>{row.openingJournal.number}</Button>}</div></section>{row.enabled ? <><section className="panel mb-5 overflow-hidden"><h2 className="border-b p-5 text-sm font-semibold">{id.autoMapping}</h2><div className="table-scroll"><table className="erp-table"><thead><tr><th>{id.description}</th><th>{id.account}</th></tr></thead><tbody>{accountingPurposes.map((p) => <tr key={p}><td>{accountingPurposeLabels[p]}</td><td>{row.mappings[p]?.code} · {row.mappings[p]?.name}</td></tr>)}</tbody></table></div></section><OperationalPostings revision={revision} /></> : company.role === "ADMIN" && company.status === "ACTIVE" ? <AccountingActivationForm key={row.opening.snapshotKey} opening={row.opening} onSaved={changed} /> : <p className="notice">{id.autoAdminOnly}</p>}</>}{journal && <JournalDetail documentId={journal} onClose={() => setJournal(null)} onChanged={changed} />}</>;
}
