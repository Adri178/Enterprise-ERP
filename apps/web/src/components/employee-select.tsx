"use client";
import { useId, useState } from "react";
import type { Employee, PageResult } from "@erp/shared";
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";
import { id } from "@/lib/i18n";
import { useCompanyResource } from "@/lib/company-resource";
import { useDebouncedValue } from "@/lib/catalog-hooks";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
export function EmployeeSelect({
  value,
  label,
  onChange,
  error,
  activeOnly = true,
  required = true,
}: {
  value: string;
  label?: string;
  onChange: (employee: Employee) => void;
  error?: string;
  activeOnly?: boolean;
  required?: boolean;
}) {
  const controlId = useId(),
    [open, setOpen] = useState(false),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1);
  const query = useDebouncedValue(q);
  const rows = useCompanyResource<PageResult<Employee>>(
    `hr/employees?status=${activeOnly ? "ACTIVE" : "ALL"}&pageSize=6&page=${page}&q=${encodeURIComponent(query)}`,
    0,
    open,
  );
  return (
    <div>
      <span className="field-label" id={`${controlId}-label`}>
        {id.employee}
        {required ? " *" : ""}
      </span>
      <button
        className="field flex items-center justify-between gap-2 text-left"
        type="button"
        aria-labelledby={`${controlId}-label`}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? controlId : undefined}
        aria-haspopup="dialog"
        aria-invalid={!!error}
        onClick={() => setOpen(true)}
      >
        <span className="truncate">
          {label || value || id.selectRecord(id.employee)}
        </span>
        <ChevronsUpDown size={13} />
      </button>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent id={controlId}>
          <DialogTitle>{id.selectRecord(id.employee)}</DialogTitle>
          <DialogDescription>{id.companyScope}</DialogDescription>
          <div className="toolbar-search !w-full">
            <Search size={15} />
            <input
              className="field"
              aria-label={id.search}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder={id.employeeSearch}
            />
          </div>
          {rows.loading ? (
            <div className="empty-state !py-8" role="status">
              <Loader2 className="animate-spin" />
              <p>{id.loading}</p>
            </div>
          ) : rows.error ? (
            <p role="alert" className="field-error">
              {rows.error}
            </p>
          ) : (
            <div className="space-y-1">
              {rows.data?.data.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted"
                  onClick={() => {
                    onChange(r);
                    setOpen(false);
                  }}
                >
                  <span>
                    <strong className="block text-xs font-medium">
                      {r.name}
                    </strong>
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      {r.code} · {r.jobTitle} · {r.branchName}
                    </span>
                  </span>
                  {r.id === value && (
                    <Check size={15} className="text-primary" />
                  )}
                </button>
              ))}
              {rows.data?.data.length === 0 && (
                <p className="py-6 text-xs text-muted-foreground">{id.empty}</p>
              )}
            </div>
          )}
          <div className="flex items-center justify-between border-t pt-3 text-[10px] text-muted-foreground">
            <span>
              {id.showing(
                rows.data?.meta.total ? (rows.data.meta.page - 1) * 6 + 1 : 0,
                Math.min(
                  (rows.data?.meta.page || 1) * 6,
                  rows.data?.meta.total || 0,
                ),
                rows.data?.meta.total || 0,
              )}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={rows.loading || (rows.data?.meta.page || 1) <= 1}
                onClick={() => setPage((rows.data?.meta.page || 1) - 1)}
              >
                {id.previous}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  rows.loading ||
                  (rows.data?.meta.page || 1) >=
                    (rows.data?.meta.pageCount || 1)
                }
                onClick={() => setPage((rows.data?.meta.page || 1) + 1)}
              >
                {id.next}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
