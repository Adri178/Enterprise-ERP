"use client";
import { useId, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";
import type { MasterKind, MasterRecord } from "@erp/shared";
import { id } from "@/lib/i18n";
import { useCatalogList } from "@/lib/catalog-hooks";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
export function RecordSelect({
  kind,
  label,
  value,
  selectedLabel,
  onChange,
  error,
  stockOnly = false,
  required = true,
  branchId,
  disabled = false,
}: {
  kind: MasterKind;
  label: string;
  value: string;
  selectedLabel?: string;
  onChange: (record: MasterRecord) => void;
  error?: string;
  stockOnly?: boolean;
  required?: boolean;
  branchId?: string;
  disabled?: boolean;
}) {
  const controlId = useId(),
    [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1);
  return (
    <div>
      <span className="field-label" id={`${controlId}-label`}>
        {label}
        {required ? " *" : ""}
      </span>
      <button
        type="button"
        className="field flex items-center justify-between gap-2 text-left disabled:bg-muted disabled:text-muted-foreground"
        aria-labelledby={`${controlId}-label`}
        aria-invalid={!!error}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? controlId : undefined}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <span className={value ? "truncate" : "truncate text-muted-foreground"}>
          {selectedLabel || value || id.selectRecord(label)}
        </span>
        <ChevronsUpDown size={13} className="shrink-0" />
      </button>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent id={controlId}>
          <DialogTitle className="font-semibold">
            {id.selectRecord(label)}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {id.companyScope}
          </DialogDescription>
          <div className="toolbar-search !w-full">
            <Search size={15} />
            <input
              className="field"
              aria-label={id.search}
              value={query}
              placeholder={id.searchRecords}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
          {open && (
            <RecordOptions
              kind={kind}
              query={query}
              page={page}
              setPage={setPage}
              value={value}
              stockOnly={stockOnly}
              branchId={branchId}
              onChange={(r) => {
                onChange(r);
                setOpen(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function RecordOptions({
  kind,
  query,
  page,
  setPage,
  value,
  stockOnly,
  onChange,
  branchId,
}: {
  kind: MasterKind;
  query: string;
  page: number;
  setPage: (v: number) => void;
  value: string;
  stockOnly: boolean;
  onChange: (r: MasterRecord) => void;
  branchId?: string;
}) {
  const result = useCatalogList(kind, {
    q: query,
    page,
    pageSize: 6,
    status: "ACTIVE",
    sort: "name",
    direction: "asc",
    ...(branchId ? { branchId } : {}),
  });
  return (
    <>
      {result.loading ? (
        <div className="empty-state !py-8">
          <Loader2 className="animate-spin" />
          <p>{id.loading}</p>
        </div>
      ) : result.error ? (
        <p role="alert" className="field-error">
          {result.error}
        </p>
      ) : (
        <div className="space-y-1">
          {result.data.map((row) => (
            <button
              type="button"
              key={row.id}
              disabled={stockOnly && row.trackStock === false}
              className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted disabled:opacity-40"
              onClick={() => onChange(row)}
            >
              <span>
                <strong className="block text-xs font-medium">
                  {row.name}
                </strong>
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  {row.code}
                  {stockOnly && row.trackStock === false
                    ? ` · ${id.notTracked}`
                    : ""}
                </span>
              </span>
              {row.id === value && <Check size={15} className="text-primary" />}
            </button>
          ))}
          {!result.data.length && (
            <p className="py-5 text-xs text-muted-foreground">
              {id.noActiveRecords}
            </p>
          )}
        </div>
      )}
      <div className="flex items-center justify-between border-t pt-3 text-[10px] text-muted-foreground">
        <span>
          {id.showing(
            result.meta.total ? (result.meta.page - 1) * 6 + 1 : 0,
            Math.min(result.meta.page * 6, result.meta.total),
            result.meta.total,
          )}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1 || result.loading}
            onClick={() => setPage(page - 1)}
          >
            {id.previous}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= result.meta.pageCount || result.loading}
            onClick={() => setPage(page + 1)}
          >
            {id.next}
          </Button>
        </div>
      </div>
    </>
  );
}
