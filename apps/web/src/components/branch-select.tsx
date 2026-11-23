"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronsUpDown,
  Search,
  Loader2,
  Building2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { id } from "@/lib/i18n";
import { useCatalogList } from "@/lib/catalog-hooks";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";

export function BranchSelect({
  value,
  label,
  onChange,
  error,
  disabled,
}: {
  value?: string;
  label?: string;
  onChange: (id: string, name: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  return (
    <div>
      <span className="field-label" id="branch-label">
        Branch *
      </span>
      <button
        type="button"
        className="field flex items-center justify-between text-left disabled:bg-muted"
        aria-labelledby="branch-label"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? "branch-selection-dialog" : undefined}
        aria-haspopup="dialog"
        aria-invalid={!!error}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <span className={value ? "truncate" : "text-muted-foreground"}>
          {label || value || id.selectBranch}
        </span>
        <ChevronsUpDown size={13} className="shrink-0 text-muted-foreground" />
      </button>
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent id="branch-selection-dialog">
          <DialogTitle className="text-base font-semibold">
            {id.selectBranch}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {id.branchRequired}
          </DialogDescription>
          <div className="toolbar-search !w-full">
            <Search size={15} />
            <input
              className="field"
              value={query}
              aria-label={id.search}
              placeholder={id.searchRecords}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </div>
          {open && (
            <BranchOptions
              value={value}
              query={query}
              page={page}
              setPage={setPage}
              onChange={(next, name) => {
                onChange(next, name);
                setOpen(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function BranchOptions({
  value,
  query,
  page,
  setPage,
  onChange,
}: {
  value?: string;
  query: string;
  page: number;
  setPage: (page: number) => void;
  onChange: (id: string, name: string) => void;
}) {
  const result = useCatalogList("branches", {
    q: query,
    page,
    pageSize: 6,
    status: "ACTIVE",
    sort: "name",
    direction: "asc",
  });
  return (
    <>
      {result.loading ? (
        <div className="empty-state !py-8">
          <Loader2 size={22} className="animate-spin" />
          <p>{id.loading}</p>
        </div>
      ) : result.error ? (
        <p role="alert" className="text-xs text-red-600">
          {result.error}
        </p>
      ) : (
        <div className="space-y-1">
          {result.data.map((branch) => (
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted"
              key={branch.id}
              onClick={() => onChange(branch.id, branch.name)}
            >
              <Building2 size={17} className="text-primary" />
              <span className="flex-1">
                <strong className="block text-xs font-medium">
                  {branch.name}
                </strong>
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  {branch.code} · {branch.city}
                </span>
              </span>
              {branch.id === value && (
                <Check size={16} className="text-primary" />
              )}
            </button>
          ))}
          {!result.data.length && (
            <div className="empty-state !py-7">
              <p>{query ? id.emptyHint : id.noBranch}</p>
              {!query && (
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link href="/branches?new=1">{id.addRecord("Branch")}</Link>
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      <div className="flex items-center justify-between border-t pt-4 text-[10px] text-muted-foreground">
        <span>
          {id.showing(
            result.meta.total ? (result.meta.page - 1) * 6 + 1 : 0,
            Math.min(result.meta.page * 6, result.meta.total),
            result.meta.total,
          )}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            aria-label={id.previous}
            disabled={page <= 1 || result.loading}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            aria-label={id.next}
            disabled={page >= result.meta.pageCount || result.loading}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </>
  );
}
