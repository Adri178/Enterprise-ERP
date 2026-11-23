"use client";
import { useId, useState } from "react";
import type { PageResult, PurchaseDocument } from "@erp/shared";
import { ChevronsUpDown } from "lucide-react";
import { useCompanyResource } from "@/lib/company-resource";
import { useDebouncedValue } from "@/lib/catalog-hooks";
import { id } from "@/lib/i18n";
import { date, money } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { ResourceState, ListPagination } from "./list-state";
export function PurchaseRequestSelect({ value, label, error, onChange }: { value: string; label?: string; error?: string; onChange: (row: PurchaseDocument) => void }) {
  const controlId = useId(), [open, setOpen] = useState(false), [query, setQuery] = useState(""), [page, setPage] = useState(1), [revision, setRevision] = useState(0), q = useDebouncedValue(query);
  const result = useCompanyResource<PageResult<PurchaseDocument>>(`rfqs/eligible-requests?q=${encodeURIComponent(q)}&page=${page}&pageSize=6`, revision, open);
  return <div><span id={`${controlId}-label`} className="field-label">{id.rfq.source} *</span><button type="button" role="combobox" aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? controlId : undefined} aria-labelledby={`${controlId}-label`} aria-describedby={error ? `${controlId}-error` : undefined} aria-invalid={!!error} className="field flex items-center justify-between gap-2 text-left" onClick={() => setOpen(true)}><span className="truncate">{label || value || id.rfq.chooseSource}</span><ChevronsUpDown size={13} /></button>{error && <p id={`${controlId}-error`} role="alert" className="field-error">{error}</p>}<Dialog open={open} onOpenChange={setOpen}><DialogContent id={controlId}><DialogTitle>{id.rfq.chooseSource}</DialogTitle><DialogDescription>{id.rfq.sourceHint}</DialogDescription><input className="field" aria-label={id.search} value={query} maxLength={120} onChange={event => { setQuery(event.target.value); setPage(1); }} />{result.loading || result.error ? <ResourceState error={result.error} retry={() => setRevision(value => value + 1)} /> : <div className="space-y-2">{result.data?.data.map(row => <button key={row.id} type="button" className="w-full rounded-lg border p-3 text-left hover:bg-muted" onClick={() => { onChange(row); setOpen(false); }}><strong className="block text-sm">{row.number}</strong><span className="mt-1 block text-xs text-muted-foreground">{date(row.date)} · {row.warehouseName} · {money(row.amount, row.currency)}</span></button>)}{!result.data?.data.length && <p className="empty-state">{id.empty}</p>}</div>}<ListPagination meta={result.data?.meta} loading={result.loading} onPage={setPage} /></DialogContent></Dialog></div>;
}
