"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Bom, PageResult } from "@erp/shared";
import { ArrowDownUp, Plus, Search } from "lucide-react";
import { id, statusLabels } from "@/lib/i18n";
import { isLive } from "@/lib/api";
import { useCompanyResource } from "@/lib/company-resource";
import { useDebouncedValue } from "@/lib/catalog-hooks";
import { number } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { PageHeader } from "./page-header";
import { ManufacturingLinks, ManufacturingNotice } from "./manufacturing-common";
import { BomForm } from "./bom-form";
import { BomDetail } from "./bom-detail";
import { ResourceState, ListPagination } from "./list-state";
import { StatusBadge } from "./ui/badge";
import { Button } from "./ui/button";
export function BomsPage() { const { company } = useWorkspace(); return <BomDirectory key={company.id} />; }
function BomDirectory() {
  const search = useSearchParams(), initialQuery = search.get("q") || "", { company, writable, refresh } = useWorkspace();
  const [q, setQ] = useState(initialQuery), [page, setPage] = useState(1), [status, setStatus] = useState("ALL"), [direction, setDirection] = useState("asc"), [revision, setRevision] = useState(0), [creating, setCreating] = useState(false), [selected, setSelected] = useState<string | null>(null), query = useDebouncedValue(q);
  useEffect(() => { setQ(initialQuery); setPage(1); }, [initialQuery]);
  const params = new URLSearchParams({ q: query, page: String(page), pageSize: "10", status, direction }), result = useCompanyResource<PageResult<Bom>>(`manufacturing/boms?${params}`, revision), changed = () => { setRevision((v) => v + 1); refresh(); };
  return <><PageHeader title={id.bom} parent={id.manufacturing} description={`${company.name} · ${id.bomDescription}`} actions={<Button disabled={!isLive || !writable} onClick={() => setCreating(true)}><Plus />{id.createDocument(id.bom)}</Button>} /><ManufacturingLinks current="bill-of-materials" /><ManufacturingNotice /><section className="panel overflow-hidden"><div className="table-toolbar"><div className="toolbar-search"><Search size={15} /><input className="field" aria-label={id.search} value={q} placeholder={id.bomSearch} maxLength={120} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div><select className="field !w-auto" aria-label={id.status} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="ALL">{id.allStatus}</option>{["DRAFT", "ACTIVE", "INACTIVE"].map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}</select></div>{!isLive ? <div className="empty-state">{id.manufacturingLiveOnly}</div> : result.loading || result.error ? <ResourceState error={result.error} retry={changed} /> : !result.data?.data.length ? <div className="empty-state"><h2>{id.empty}</h2><p>{id.emptyHint}</p></div> : <div className="table-scroll"><table className="erp-table" aria-label={id.bom}><thead><tr><th aria-sort={direction === "asc" ? "ascending" : "descending"}><button className="flex items-center gap-1" onClick={() => { setDirection((v) => v === "asc" ? "desc" : "asc"); setPage(1); }}>{id.bomCode}<ArrowDownUp size={12} /></button></th><th>{id.bomName}</th><th>{id.productionOutput}</th><th>{id.outputQuantity}</th><th>{id.status}</th><th>{id.actions}</th></tr></thead><tbody>{result.data.data.map((b) => <tr key={b.id}><td><button className="text-link font-medium" onClick={() => setSelected(b.id)}>{b.code}</button></td><td>{b.name}</td><td>{b.outputCode} · {b.outputName}</td><td>{number(b.outputQuantity)} {b.outputUnit}</td><td><StatusBadge status={b.status} /></td><td><Button variant="ghost" size="sm" onClick={() => setSelected(b.id)}>{id.review}</Button></td></tr>)}</tbody></table></div>}<ListPagination meta={result.data?.meta} loading={result.loading} onPage={setPage} /></section>{creating && <BomForm onClose={() => setCreating(false)} onSaved={(b) => { setCreating(false); setSelected(b.id); changed(); }} />}{selected && <BomDetail key={selected} documentId={selected} onClose={() => setSelected(null)} onChanged={changed} />}</>;
}
