"use client";
import { useState } from "react";
import { ArrowDownUp, Search } from "lucide-react";
import type { OperationalPostingView, PageResult } from "@erp/shared";
import { id } from "@/lib/i18n";
import { useCompanyResource } from "@/lib/company-resource";
import { useDebouncedValue } from "@/lib/catalog-hooks";
import { date, exactMoney } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { ResourceState, ListPagination } from "./list-state";
import { JournalDetail } from "./journal-detail";
import { TradeDetail } from "./trade-detail";
import { StockOperationDetail } from "./stock-operation-detail";
import { WorkOrderDetail } from "./work-order-detail";
export function OperationalPostings({ revision }: { revision: number }) {
  const { company, refresh } = useWorkspace(), [q, setQ] = useState(""), [page, setPage] = useState(1), [direction, setDirection] = useState("desc"), [journal, setJournal] = useState<string | null>(null), [source, setSource] = useState<OperationalPostingView["source"] | null>(null), query = useDebouncedValue(q);
  const result = useCompanyResource<PageResult<OperationalPostingView>>(`accounting/postings?${new URLSearchParams({ q: query, page: String(page), pageSize: "10", direction })}`, revision);
  return <><section className="panel overflow-hidden"><div className="table-toolbar"><h2 className="text-sm font-semibold">{id.autoPostings}</h2><div className="toolbar-search"><Search size={15} /><input className="field" aria-label={id.autoSearch} placeholder={id.autoSearch} maxLength={120} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div></div>{result.loading || result.error ? <ResourceState error={result.error} retry={refresh} /> : !result.data?.data.length ? <div className="empty-state"><h3>{id.empty}</h3><p>{id.emptyHint}</p></div> : <div className="table-scroll"><table className="erp-table" aria-label={id.autoPostings}><thead><tr><th>{id.autoSource}</th><th aria-sort={direction === "asc" ? "ascending" : "descending"}><button className="flex items-center gap-1" onClick={() => { setDirection((d) => d === "asc" ? "desc" : "asc"); setPage(1); }}>{id.date}<ArrowDownUp size={12} /></button></th><th>{id.autoJournal}</th><th>{id.totalDebit}</th></tr></thead><tbody>{result.data.data.map((r) => <tr key={r.id}><td><button className="text-link" onClick={() => setSource(r.source)}>{r.number}</button></td><td className="whitespace-nowrap">{date(r.date)}</td><td>{r.journal ? <button className="text-link" onClick={() => setJournal(r.journal!.id)}>{r.journal.number}</button> : <span className="text-muted-foreground" title={r.note}>{id.autoNoJournal}</span>}</td><td className="whitespace-nowrap">{exactMoney(r.amount, company.currency)}</td></tr>)}</tbody></table></div>}<ListPagination meta={result.data?.meta} loading={result.loading} onPage={setPage} /></section>{journal && <JournalDetail documentId={journal} onClose={() => setJournal(null)} onChanged={refresh} />}{source && (source.type === "purchase" || source.type === "sales" ? <TradeDetail domain={source.type === "sales" ? "sales" : "procurement"} documentId={source.id} onClose={() => setSource(null)} onChanged={refresh} /> : source.type === "operation" ? <StockOperationDetail documentId={source.id} onClose={() => setSource(null)} onChanged={refresh} /> : <WorkOrderDetail documentId={source.id} onClose={() => setSource(null)} onChanged={refresh} />)}</>;
}
