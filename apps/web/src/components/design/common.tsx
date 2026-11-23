"use client";
import { cloneElement, isValidElement, useMemo, useState, type ReactNode } from "react";
import { flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Download, Info, Search } from "lucide-react";
import { id } from "@/lib/i18n";
import { cn, exportCsv } from "@/lib/utils";
import { useWorkspace } from "../workspace-provider";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import { ListPagination, ResourceState } from "../list-state";

const d = id.design;
export function DesignNotice({ children }: { children?: ReactNode }) {
  const { writable } = useWorkspace();
  return <div className="notice mb-5 items-start"><Info size={17} className="mt-0.5 shrink-0" /><div><strong className="block font-semibold">{d.title}</strong><p className="mt-1">{d.notice}</p>{children && <p className="mt-1">{children}</p>}{!writable && <p className="mt-2 font-semibold">{d.readOnly}</p>}</div></div>;
}
export function DesignSummary({ items }: { items: { label: string; value: ReactNode }[] }) {
  return <dl className="mb-5 grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">{items.map(item => <div key={item.label} className="bg-white px-5 py-4"><dt className="text-xs text-muted-foreground">{item.label}</dt><dd className="mt-2 text-xl font-semibold tracking-tight tabular-nums">{item.value}</dd></div>)}</dl>;
}
export function DesignBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "amber" | "red" }) {
  return <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium", { neutral: "bg-slate-100 text-slate-600", green: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-800", red: "bg-red-50 text-red-700" }[tone])}><span className="size-1.5 rounded-full bg-current" />{children}</span>;
}
export function DesignDialog({ title, description, onClose, children, wide = false }: { title: string; description: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className={wide ? "max-w-4xl" : "max-w-2xl"}><div className="pr-8"><DialogTitle className="text-lg font-semibold">{title}</DialogTitle><DialogDescription className="mt-1.5 text-sm text-muted-foreground">{description}</DialogDescription></div>{children}</DialogContent></Dialog>;
}
export function DesignField({ label, name, error, required, children }: { label: string; name: string; error?: string; required?: boolean; children: ReactNode }) {
  const control = isValidElement<{ "aria-describedby"?: string; "aria-invalid"?: boolean; "aria-required"?: boolean }>(children) ? cloneElement(children, { "aria-describedby": error ? `${name}-error` : children.props["aria-describedby"], "aria-invalid": !!error, "aria-required": required }) : children;
  return <div><label className="field-label" htmlFor={name}>{label}{required && <span className="ml-1 text-red-600" aria-hidden="true">*</span>}</label>{control}{error && <p id={`${name}-error`} role="alert" className="mt-1 text-xs text-red-600">{error}</p>}</div>;
}
export function DesignFacts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{items.map(item => <div key={item.label} className="min-w-0"><dt className="text-xs text-muted-foreground">{item.label}</dt><dd className="mt-1.5 break-words text-sm font-medium">{item.value || "—"}</dd></div>)}</dl>;
}
export function DesignConfirm({ title = d.confirmRemove, description = d.confirmRemoveHint, onClose, onConfirm }: { title?: string; description?: string; onClose: () => void; onConfirm: () => void }) {
  return <DesignDialog title={title} description={description} onClose={onClose}><div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>{id.cancel}</Button><Button variant="destructive" onClick={onConfirm}>{id.confirm}</Button></div></DesignDialog>;
}

export function DesignTable<T>({ title, rows, columns, searchHint, statusLabels, statusOf, loading, error, retry, filename, extra }: {
  title: string; rows: T[]; columns: ColumnDef<T>[]; searchHint: string; statusLabels: Record<string, string>; statusOf: (row: T) => string;
  loading: boolean; error?: string; retry: () => void; filename: string; extra?: ReactNode;
}) {
  const [query, setQuery] = useState(""), [status, setStatus] = useState("ALL");
  const data = useMemo(() => rows.filter(row => status === "ALL" || statusOf(row) === status), [rows, status, statusOf]);
  // React Compiler is not enabled; TanStack's mutable table API is intentional.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data, columns, state: { globalFilter: query }, onGlobalFilterChange: setQuery, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(), initialState: { pagination: { pageSize: 10 } } });
  const pagination = table.getState().pagination, total = table.getFilteredRowModel().rows.length;
  function download() {
    const cols = table.getVisibleLeafColumns().filter(column => column.accessorFn);
    exportCsv(filename, [cols.map(column => String(column.columnDef.header)), ...table.getPrePaginationRowModel().rows.map(row => cols.map(column => String(row.getValue(column.id) ?? "")))]);
  }
  return <section className="panel overflow-hidden"><div className="table-toolbar flex-wrap"><div className="toolbar-search"><Search size={15} /><input className="field" aria-label={id.search} placeholder={searchHint} value={query} onChange={event => { setQuery(event.target.value); table.setPageIndex(0); }} /></div><select className="field !w-auto" aria-label={id.status} value={status} onChange={event => { setStatus(event.target.value); table.setPageIndex(0); }}><option value="ALL">{id.allStatus}</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{extra}<Button variant="outline" disabled={loading || !!error || !total} onClick={download}><Download />{d.export}</Button></div>
    {loading || error ? <ResourceState error={error} retry={retry} /> : <><div className="table-scroll"><table className="erp-table" aria-label={title}><thead>{table.getHeaderGroups().map(group => <tr key={group.id}>{group.headers.map(header => <th key={header.id} aria-sort={header.column.getCanSort() ? header.column.getIsSorted() === "asc" ? "ascending" : header.column.getIsSorted() === "desc" ? "descending" : "none" : undefined}>{header.column.getCanSort() ? <button className="inline-flex items-center gap-1.5" onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}<ArrowUpDown size={12} /></button> : flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map(row => <tr key={row.id}>{row.getVisibleCells().map(cell => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody></table></div>{!total && <div className="empty-state"><h2>{id.empty}</h2><p>{d.emptyHint}</p>{(query || status !== "ALL") && <Button variant="outline" className="mt-3" onClick={() => { setQuery(""); setStatus("ALL"); table.setPageIndex(0); }}>{id.reset}</Button>}</div>}<ListPagination meta={{ total, page: pagination.pageIndex + 1, pageCount: table.getPageCount(), pageSize: pagination.pageSize }} loading={false} onPage={page => table.setPageIndex(page - 1)} /></>}
  </section>;
}
