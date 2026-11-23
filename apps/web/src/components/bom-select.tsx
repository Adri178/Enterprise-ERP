"use client";
import { useId, useState } from "react";
import type { Bom, PageResult } from "@erp/shared";
import { ChevronsUpDown, Search } from "lucide-react";
import { useCompanyResource } from "@/lib/company-resource";
import { useDebouncedValue } from "@/lib/catalog-hooks";
import { id } from "@/lib/i18n";
import { ResourceState, ListPagination } from "./list-state";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
export function BomSelect({ value, selectedLabel, onChange, error }: { value: string; selectedLabel: string; onChange: (bom: Bom) => void; error?: string }) {
  const controlId = useId(), [open, setOpen] = useState(false), [q, setQ] = useState(""), [page, setPage] = useState(1), [revision, setRevision] = useState(0), query = useDebouncedValue(q);
  const result = useCompanyResource<PageResult<Bom>>(`manufacturing/boms?status=ACTIVE&pageSize=6&page=${page}&q=${encodeURIComponent(query)}`, revision, open);
  return <div><span className="field-label" id={`${controlId}-label`}>{id.bom} *</span><button type="button" className="field flex items-center justify-between gap-2 text-left" role="combobox" aria-labelledby={`${controlId}-label`} aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? controlId : undefined} aria-invalid={!!error} onClick={() => setOpen(true)}><span className="truncate">{selectedLabel || value || id.selectRecord(id.bom)}</span><ChevronsUpDown size={13} /></button>{error && <p className="field-error" role="alert">{error}</p>}<Dialog open={open} onOpenChange={setOpen}><DialogContent id={controlId}><DialogTitle>{id.selectRecord(id.bom)}</DialogTitle><DialogDescription>{id.companyScope}</DialogDescription><div className="toolbar-search !w-full"><Search size={15} /><input className="field" aria-label={id.search} value={q} placeholder={id.bomSearch} maxLength={120} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>{result.loading || result.error ? <ResourceState error={result.error} retry={() => setRevision((v) => v + 1)} /> : <div className="space-y-2">{result.data?.data.map((b) => <button type="button" key={b.id} className="w-full rounded-lg border p-3 text-left hover:bg-muted" onClick={() => { onChange(b); setOpen(false); }}><strong className="block text-xs">{b.code} · {b.name}</strong><span className="mt-1 block text-[11px] text-muted-foreground">{b.outputQuantity} {b.outputUnit} · {b.outputName}</span></button>)}{!result.data?.data.length && <p className="empty-state">{id.empty}</p>}</div>}<ListPagination meta={result.data?.meta} loading={result.loading} onPage={setPage} /></DialogContent></Dialog></div>;
}
