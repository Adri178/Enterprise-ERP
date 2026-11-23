"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDownUp, Plus, Search } from "lucide-react";
import type { Journal, PageResult } from "@erp/shared";
import { id, statusLabels } from "@/lib/i18n";
import { isLive } from "@/lib/api";
import { useCompanyResource } from "@/lib/company-resource";
import { useDebouncedValue } from "@/lib/catalog-hooks";
import { date, money } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { PageHeader } from "./page-header";
import { AccountingNotice } from "./accounting-notice";
import { JournalForm } from "./journal-form";
import { JournalDetail } from "./journal-detail";
import { ResourceState, ListPagination } from "./list-state";
import { StatusBadge } from "./ui/badge";
import { Button } from "./ui/button";
export function JournalsPage() { const { company } = useWorkspace(); return <JournalRegister key={company.id} />; }
function JournalRegister() {
  const search = useSearchParams(), initialQuery = search.get("q") || "";
  const { company, writable, refresh } = useWorkspace(), [q, setQ] = useState(initialQuery), [status, setStatus] = useState("ALL"), [page, setPage] = useState(1), [direction, setDirection] = useState("desc"), [revision, setRevision] = useState(0), [create, setCreate] = useState(false), [selected, setSelected] = useState<string | null>(null);
  useEffect(() => { setQ(initialQuery); setPage(1); }, [initialQuery]);
  const query = useDebouncedValue(q), params = new URLSearchParams({ q: query, status, page: String(page), pageSize: "10", direction }), result = useCompanyResource<PageResult<Journal>>(`accounting/journals?${params}`, revision);
  const changed = () => { setRevision((v) => v + 1); refresh(); };
  return <><PageHeader title={id.journalEntries} parent={id.accountingTitle} description={`${company.name} · ${id.journalDescription}`} actions={<Button disabled={!isLive || !writable} onClick={() => setCreate(true)}><Plus />{id.createDocument(id.journalEntry)}</Button>} /><AccountingNotice />
    <section className="panel overflow-hidden"><div className="table-toolbar"><div className="toolbar-search"><Search size={15} /><input className="field" aria-label={id.search} placeholder={id.journalSearch} value={q} maxLength={120} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div><select className="field !w-auto" aria-label={id.status} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="ALL">{id.allStatus}</option>{["DRAFT", "POSTED", "CANCELLED"].map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}</select></div>
      {!isLive ? <div className="empty-state"><p>{id.accountingLiveOnly}</p></div> : result.loading || result.error ? <ResourceState error={result.error} retry={changed} /> : !result.data?.data.length ? <div className="empty-state"><h2>{id.empty}</h2><p>{id.emptyHint}</p></div> : <div className="table-scroll"><table className="erp-table" aria-label={id.journalEntries}><thead><tr><th>{id.documentNumber}</th><th aria-sort={direction === "asc" ? "ascending" : "descending"}><button className="flex items-center gap-1" onClick={() => { setDirection((v) => v === "asc" ? "desc" : "asc"); setPage(1); }}>{id.date}<ArrowDownUp size={12} /></button></th><th>{id.description}</th><th>{id.amount}</th><th>{id.status}</th><th>{id.journalReference}</th><th>{id.actions}</th></tr></thead><tbody>{result.data.data.map((row) => <tr key={row.id}><td><button className="text-link font-medium" onClick={() => setSelected(row.id)}>{row.number}</button>{(row.reversalOf || row.reversedBy) && <p className="mt-1 text-[10px] text-muted-foreground">{row.reversalOf ? id.journalReversal : id.journalReversed}</p>}</td><td className="whitespace-nowrap">{date(row.date)}</td><td className="max-w-64 truncate" title={row.description}>{row.description}</td><td className="whitespace-nowrap font-medium">{money(row.amount, row.currency)}</td><td><StatusBadge status={row.status} /></td><td>{row.reference || "—"}</td><td><Button variant="ghost" size="sm" onClick={() => setSelected(row.id)}>{id.review}</Button></td></tr>)}</tbody></table></div>}
      <ListPagination meta={result.data?.meta} loading={result.loading} onPage={setPage} />
    </section>
    {create && <JournalForm onClose={() => setCreate(false)} onSaved={(row) => { setCreate(false); setSelected(row.id); changed(); }} />}{selected && <JournalDetail documentId={selected} key={selected} onClose={() => setSelected(null)} onChanged={changed} />}
  </>;
}
