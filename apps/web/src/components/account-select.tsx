"use client";
import { useId, useState } from "react";
import type { Account, AccountType, PageResult } from "@erp/shared";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { id, accountTypeLabels } from "@/lib/i18n";
import { useCompanyResource } from "@/lib/company-resource";
import { useDebouncedValue } from "@/lib/catalog-hooks";
import { ResourceState, ListPagination } from "./list-state";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
export function AccountSelect({ value, selectedLabel, onChange, groupOnly = false, type, error, label = id.account, required = true, includeInactive = false, disabled = false }: { value: string; selectedLabel?: string; onChange: (account: Account) => void; groupOnly?: boolean; type?: AccountType; error?: string; label?: string; required?: boolean; includeInactive?: boolean; disabled?: boolean }) {
  const controlId = useId(), [open, setOpen] = useState(false), [q, setQ] = useState(""), [page, setPage] = useState(1), [revision, setRevision] = useState(0);
  const query = useDebouncedValue(q), params = new URLSearchParams({ q: query, page: String(page), pageSize: "6", node: groupOnly ? "GROUP" : "LEDGER", status: includeInactive ? "ALL" : "ACTIVE", ...(type ? { type } : {}) });
  const result = useCompanyResource<PageResult<Account>>(`accounting/accounts?${params}`, revision, open);
  return <div><span className="field-label" id={`${controlId}-label`}>{label}{required ? " *" : ""}</span><button type="button" className="field flex items-center justify-between gap-2 text-left disabled:bg-muted" disabled={disabled} role="combobox" aria-labelledby={`${controlId}-label`} aria-invalid={!!error} aria-expanded={open} aria-controls={open ? controlId : undefined} aria-haspopup="dialog" onClick={() => setOpen(true)}><span className="truncate">{selectedLabel || value || id.selectRecord(label)}</span><ChevronsUpDown size={13} className="shrink-0" /></button>{error && <p className="field-error" role="alert">{error}</p>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent id={controlId}><DialogTitle>{id.selectRecord(label)}</DialogTitle><DialogDescription>{id.companyScope}</DialogDescription><div className="toolbar-search !w-full"><Search size={15} /><input className="field" aria-label={id.search} placeholder={id.accountSearch} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
      {result.loading || result.error ? <ResourceState error={result.error} retry={() => setRevision((v) => v + 1)} /> : <div className="space-y-1">{result.data?.data.map((row) => <button type="button" className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted" key={row.id} onClick={() => { onChange(row); setOpen(false); }}><span><strong className="block text-xs font-medium">{row.code} · {row.name}</strong><span className="mt-1 block text-[10px] text-muted-foreground">{accountTypeLabels[row.type]} · {row.parentName || id.accountRoot}</span></span>{row.id === value && <Check size={15} className="text-primary" />}</button>)}{!result.data?.data.length && <p className="py-6 text-xs text-muted-foreground">{id.empty}</p>}</div>}
      <ListPagination meta={result.data?.meta} loading={result.loading} onPage={setPage} />
    </DialogContent></Dialog>
  </div>;
}
