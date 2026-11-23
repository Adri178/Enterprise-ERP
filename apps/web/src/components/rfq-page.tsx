"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDownUp, Download, Info, Loader2, Plus, RotateCw, Search } from "lucide-react";
import { rfqStatuses, type RfqEntry, type RfqResult } from "@erp/shared";
import { toast } from "sonner";
import { api, isLive } from "@/lib/api";
import { id } from "@/lib/i18n";
import { useCompanyResource } from "@/lib/company-resource";
import { useDebouncedValue } from "@/lib/catalog-hooks";
import { date, exactMoney, exportCsv } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { PageHeader } from "./page-header";
import { Button } from "./ui/button";
import { ResourceState, ListPagination } from "./list-state";
import { RfqForm } from "./rfq-form";
import { RfqDetail, RfqStatusBadge } from "./rfq-detail";
import { PurchaseDetail } from "./purchase-detail";
import { RfqPage as RfqDemo } from "./design/rfq-page";
const t = id.rfq;
export function RfqPage() {
  const { company } = useWorkspace(), search = useSearchParams(), request = search.toString();
  const [source, setSource] = useState({ request, companyId: company.id });
  if (source.request !== request || (!source.companyId && company.id)) setSource({ request, companyId: company.id });
  return isLive ? <RfqRegister key={`${company.id}:${request}`} initialId={source.companyId === company.id ? search.get("document") || "" : ""} initialSource={source.companyId === company.id ? search.get("sourceId") || "" : ""} /> : <RfqDemo />;
}
function RfqRegister({ initialId, initialSource }: { initialId: string; initialSource: string }) {
  const { company, writable, refresh } = useWorkspace(), [query, setQuery] = useState(""), [status, setStatus] = useState("ALL"), [page, setPage] = useState(1), [direction, setDirection] = useState("desc"), [revision, setRevision] = useState(0), [create, setCreate] = useState(false), [selected, setSelected] = useState<string | null>(initialId || null), [purchase, setPurchase] = useState<string | null>(null), [source, setSource] = useState(initialSource), [exporting, setExporting] = useState(false);
  const q = useDebouncedValue(query), exportRequest = useRef<AbortController | null>(null), params = new URLSearchParams({ q, status, page: String(page), pageSize: "10", direction, ...(source ? { sourceId: source } : {}) }).toString();
  const result = useCompanyResource<RfqResult>(`rfqs?${params}`, revision);
  useEffect(() => () => { exportRequest.current?.abort(); }, [company.id, params]);
  const reload = () => { setRevision(value => value + 1); refresh(); };
  async function download() {
    exportRequest.current?.abort(); const controller = new AbortController(); exportRequest.current = controller; setExporting(true);
    try {
      const result = await api<{ data: RfqEntry[] }>(`/companies/${company.id}/rfqs/export?${params}`, { signal: controller.signal });
      if (!controller.signal.aborted) exportCsv(`rfq-${company.code}.csv`, [[id.code, t.source, id.date, t.deadline, id.currency, t.budget, t.invited, t.offers, t.selected, id.status], ...result.data.map(row => [row.number, row.sourceNumber, row.date, row.deadline, row.currency, row.budget, row.supplierCount, row.offerCount, row.selectedSupplierName || "", t.statuses[row.status]])]);
    } catch (error) { if (!controller.signal.aborted) toast.error(error instanceof Error ? error.message : id.error); }
    finally { if (exportRequest.current === controller) setExporting(false); }
  }
  return <><PageHeader title={t.title} parent="Procurement" description={`${company.name} · ${t.description}`} actions={<Button disabled={!writable} onClick={() => setCreate(true)}><Plus />{t.add}</Button>} /><div className="notice mb-5 items-start"><Info size={16} className="mt-0.5 shrink-0" /><div><p>{t.scope}</p><p className="mt-1">{t.approvalHint}</p>{!writable && <p className="mt-2 font-medium">{t.readOnly}</p>}</div></div><section className="panel overflow-hidden"><div className="table-toolbar flex-wrap"><div className="toolbar-search"><Search size={15} /><input className="field" value={query} maxLength={120} aria-label={id.search} placeholder={t.search} onChange={event => { setQuery(event.target.value); setPage(1); }} /></div><select className="field !w-auto" value={status} aria-label={id.status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="ALL">{id.allStatus}</option>{rfqStatuses.map(value => <option key={value} value={value}>{t.statuses[value]}</option>)}</select><Button variant="outline" onClick={reload}><RotateCw />{t.reload}</Button><Button variant="outline" disabled={exporting || result.loading || !!result.error || !result.data?.meta.total} onClick={download}>{exporting ? <Loader2 className="animate-spin" /> : <Download />}{t.export}</Button>{source && <Button variant="ghost" onClick={() => { setSource(""); setPage(1); }}>{id.reset}</Button>}</div><p className="border-b px-5 py-3 text-xs text-muted-foreground">{t.exportHint}</p>{result.loading || result.error ? <ResourceState error={result.error} retry={reload} /> : !result.data?.data.length ? <div className="empty-state"><h2>{t.empty}</h2><p>{t.emptyHint}</p></div> : <div className="table-scroll"><table className="erp-table" aria-label={t.title}><thead><tr><th>{id.code}</th><th>Purchase Request</th><th aria-sort={direction === "asc" ? "ascending" : "descending"}><button className="inline-flex items-center gap-1" onClick={() => { setDirection(value => value === "asc" ? "desc" : "asc"); setPage(1); }}>{id.date}<ArrowDownUp size={12} /></button></th><th>{t.deadline}</th><th>{t.budget}</th><th>{t.offers}</th><th>{t.selected}</th><th>{id.status}</th><th>{id.actions}</th></tr></thead><tbody>{result.data.data.map(row => <tr key={row.id}><td><button className="document-link" onClick={() => setSelected(row.id)}>{row.number}</button></td><td><button className="text-link" onClick={() => setPurchase(row.sourceId)}>{row.sourceNumber}</button></td><td>{date(row.date)}</td><td>{date(row.deadline)}</td><td className="whitespace-nowrap">{exactMoney(row.budget, row.currency)}</td><td>{row.offerCount}/{row.supplierCount}</td><td>{row.selectedSupplierName || "—"}</td><td><RfqStatusBadge status={row.status} /></td><td><Button variant="ghost" size="sm" onClick={() => setSelected(row.id)}>{id.review}</Button></td></tr>)}</tbody></table></div>}<ListPagination meta={result.data?.meta} loading={result.loading} onPage={setPage} /></section>{create && <RfqForm sourceId={source} onClose={() => setCreate(false)} onSaved={row => { setCreate(false); setSelected(row.id); reload(); }} />}{selected && <RfqDetail recordId={selected} onClose={() => setSelected(null)} onChanged={reload} onPurchase={id => { setSelected(null); setPurchase(id); }} />}{purchase && <PurchaseDetail documentId={purchase} onClose={() => setPurchase(null)} onChanged={reload} />}</>;
}
