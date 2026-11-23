"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ListPanelHeading } from "./list-panel-heading";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import {
  catalogQuerySchema,
  type MasterKind,
  type MasterRecord,
  type PageResult,
} from "@erp/shared";
import {
  Search,
  Plus,
  Download,
  SlidersHorizontal,
  MoreHorizontal,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Database,
  Loader2,
  Info,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { id, statusLabels } from "@/lib/i18n";
import { categories } from "@/lib/demo-data";
import { date, exportCsv, money } from "@/lib/utils";
import { api, isLive } from "@/lib/api";
import {
  catalogQueryString,
  filterCatalog,
  useCatalogList,
} from "@/lib/catalog-hooks";
import { useWorkspace } from "./workspace-provider";
import { PageHeader } from "./page-header";
import { MasterForm, masterLabels } from "./master-form";
import { Button } from "./ui/button";
import { StatusBadge } from "./ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function MasterDataPage({
  kind,
  parent,
}: {
  kind: MasterKind;
  parent: string;
}) {
  const {
    records,
    summary,
    company,
    error: workspaceError,
    refresh,
    deleteRecord,
    writable,
    loading,
  } = useWorkspace();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [category, setCategory] = useState("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [editing, setEditing] = useState<MasterRecord | "new" | null>(null);
  const [deleting, setDeleting] = useState<MasterRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const exportRequest = useRef<AbortController | null>(null);
  useEffect(() => () => exportRequest.current?.abort(), []);
  useEffect(() => {
    if (searchParams.get("new") === "1" && writable) setEditing("new");
  }, [searchParams, writable]);
  useEffect(() => {
    setQuery(searchParams.get("q") || "");
    setPagination((value) => ({ ...value, pageIndex: 0 }));
  }, [searchParams]);
  const options = catalogQuerySchema.parse({
    q: query,
    status,
    category,
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sort: sorting[0]?.id || "createdAt",
    direction: sorting[0] ? (sorting[0].desc ? "desc" : "asc") : "desc",
  });
  const result = useCatalogList(kind, options);
  const error = workspaceError || result.error;
  const label = masterLabels[kind];
  useEffect(() => {
    if (
      !result.loading &&
      !error &&
      result.meta.page - 1 !== pagination.pageIndex
    )
      setPagination((value) => ({ ...value, pageIndex: result.meta.page - 1 }));
  }, [result.loading, result.meta.page, error, pagination.pageIndex]);
  const columns = useMemo<ColumnDef<MasterRecord>[]>(() => {
    const domainColumns: ColumnDef<MasterRecord>[] =
      kind === "branches"
        ? [{ accessorKey: "city", header: id.city, enableSorting: false }]
        : ["departments", "warehouses"].includes(kind)
          ? [
              {
                accessorKey: "branchName",
                header: "Branch",
                enableSorting: false,
                cell: ({ getValue }) => getValue<string>() || "—",
              },
            ]
          : kind === "items"
            ? [
                { accessorKey: "unit", header: id.unit, enableSorting: false },
                {
                  accessorKey: "sellingPrice",
                  header: id.sellingPrice,
                  enableSorting: false,
                  cell: ({ getValue }) =>
                    money(getValue<number>() || 0, company.currency),
                },
              ]
            : kind === "suppliers"
              ? [
                  {
                    accessorKey: "paymentTermsDays",
                    header: id.paymentTermsDays,
                    enableSorting: false,
                  },
                ]
              : [
                  {
                    accessorKey: "creditLimit",
                    header: id.creditLimit,
                    enableSorting: false,
                    cell: ({ getValue }) =>
                      money(getValue<number>() || 0, company.currency),
                  },
                ];
    return [
      {
        accessorKey: "code",
        header: () => `${id.code} ${label}`,
        cell: ({ row }) => (
          <button
            onClick={() => setEditing(row.original)}
            className="document-link"
          >
            {row.original.code}
          </button>
        ),
      },
      {
        accessorKey: "name",
        header: () => `${id.name} ${label}`,
        cell: ({ row }) => (
          <div>
            <span className="font-medium text-slate-700">
              {row.original.name}
            </span>
            {row.original.email && (
              <span className="mt-1 block text-[10px] text-slate-400">
                {row.original.email}
              </span>
            )}
          </div>
        ),
      },
      { accessorKey: "category", header: id.category },
      ...domainColumns,
      {
        accessorKey: "status",
        header: id.status,
        cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
      },
      {
        accessorKey: "createdAt",
        header: id.createdAt,
        cell: ({ getValue }) => date(getValue<string>()),
      },
      {
        id: "actions",
        header: id.actions,
        enableSorting: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={`${id.actions} ${row.original.name}`}
                variant="ghost"
                size="icon"
                className="size-7"
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing(row.original)}>
                <Pencil />
                {writable ? id.edit : id.open}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!writable}
                className="text-red-600"
                onSelect={() => {
                  setDeleting(row.original);
                  setDeleteError("");
                }}
              >
                <Trash2 />
                {id.delete}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ];
  }, [kind, label, company.currency, writable]);
  const table = useReactTable({
    data: result.data,
    columns,
    state: { sorting, pagination },
    onSortingChange: (update) => {
      setSorting(update);
      setPagination((value) => ({ ...value, pageIndex: 0 }));
    },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualFiltering: true,
    manualPagination: true,
    rowCount: result.meta.total,
    pageCount: result.meta.pageCount,
  });
  function reset() {
    setStatus("ALL");
    setCategory("ALL");
    setQuery("");
    setPagination((value) => ({ ...value, pageIndex: 0 }));
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setDeleteError("");
    try {
      await deleteRecord(kind, deleting.id);
      setDeleting(null);
    } catch (error) {
      setDeleteError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    const controller = new AbortController();
    exportRequest.current = controller;
    setExporting(true);
    try {
      let rows: MasterRecord[];
      if (!isLive) {
        rows = filterCatalog(records[kind], {
          ...options,
          page: 1,
          pageSize: Math.max(1, records[kind].length),
        }).data;
      } else {
        rows = [];
        let page = 1;
        let total: number | undefined;
        do {
          const response = await api<PageResult<MasterRecord>>(
            `/companies/${company.id}/master/${kind}?${catalogQueryString({ ...options, page, pageSize: 100 })}`,
            { signal: controller.signal },
          );
          if (total !== undefined && total !== response.meta.total)
            throw new Error(id.staleRecord);
          total = response.meta.total;
          rows.push(...response.data);
          if (page >= response.meta.pageCount) break;
          page++;
        } while (!controller.signal.aborted);
        if (new Set(rows.map((row) => row.id)).size !== total)
          throw new Error(id.staleRecord);
      }
      if (!controller.signal.aborted) {
        exportCsv(`${kind}-${company.code}.csv`, [
          [
            id.code,
            id.name,
            id.category,
            id.status,
            id.email,
            id.phone,
            id.address,
            id.city,
            id.taxId,
            "Branch",
            id.unit,
            id.purchasePrice,
            id.sellingPrice,
            id.currency,
            id.creditLimit,
            id.paymentTermsDays,
          ],
          ...rows.map((row) => [
            row.code,
            row.name,
            row.category,
            statusLabels[row.status],
            row.email,
            row.phone,
            row.address || "",
            row.city || "",
            row.taxId || "",
            row.branchName || "",
            row.unit || "",
            row.purchasePrice ?? "",
            row.sellingPrice ?? "",
            company.currency,
            row.creditLimit ?? "",
            row.paymentTermsDays ?? "",
          ]),
        ]);
        toast.success(id.exportReady);
      }
    } catch (error) {
      if (!controller.signal.aborted) toast.error((error as Error).message);
    } finally {
      if (!controller.signal.aborted) setExporting(false);
    }
  }
  return (
    <>
      <PageHeader
        title={id.list(label)}
        parent={parent}
        description={`${company.name} · ${id.companyScope}`}
        actions={
          <>
            <Button
              variant="outline"
              onClick={download}
              disabled={exporting || result.loading || !!error}
            >
              {exporting ? <Loader2 className="animate-spin" /> : <Download />}
              {exporting ? id.exporting : id.exportAll}
            </Button>
            <Button disabled={!writable} onClick={() => setEditing("new")}>
              <Plus />
              {id.addRecord(label)}
            </Button>
          </>
        }
      />
      {!writable && (
        <div className="notice mb-5">
          <Info size={16} className="shrink-0" />
          {company.status === "INACTIVE" ? id.inactiveCompany : id.readOnly}
        </div>
      )}
      <section className="panel overflow-hidden">
        <ListPanelHeading title={id.sectionData} count={loading || workspaceError ? undefined : summary[kind].total} context={isLive ? id.serverData : company.code} />
        <div className="table-toolbar">
          <div className="toolbar-search">
            <Search size={15} />
            <input
              maxLength={120}
              aria-label={id.searchRecords}
              placeholder={id.searchRecords}
              className="field"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPagination((value) => ({ ...value, pageIndex: 0 }));
              }}
            />
            {query && (
              <button
                aria-label={id.clearSearch}
                className="absolute right-2 top-2"
                onClick={() => {
                  setQuery("");
                  setPagination((value) => ({ ...value, pageIndex: 0 }));
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="list-filter-controls">
            <select
              aria-label={id.status}
              className="field !w-auto"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as typeof status);
                setPagination((value) => ({ ...value, pageIndex: 0 }));
              }}
            >
              <option value="ALL">{id.allStatus}</option>
              <option value="ACTIVE">{id.active}</option>
              <option value="INACTIVE">{id.inactive}</option>
            </select>
            <Button
              variant="outline"
              onClick={() => setShowFilters((value) => !value)}
              aria-expanded={showFilters}
            >
              <SlidersHorizontal />
              {id.filter}
              {category !== "ALL" && (
                <span className="size-1.5 rounded-full bg-primary" />
              )}
            </Button>
          </div>
        </div>
        {showFilters && (
          <div className="list-filter-panel">
            <div className="min-w-44">
              <label className="field-label" htmlFor="category-filter">
                {id.category}
              </label>
              <select
                className="field"
                id="category-filter"
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setPagination((value) => ({ ...value, pageIndex: 0 }));
                }}
              >
                <option value="ALL">{id.allCategories}</option>
                {categories[kind].map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </div>
            <Button variant="ghost" onClick={reset}>
              {id.reset}
            </Button>
          </div>
        )}
        {error ? (
          <div className="empty-state">
            <h3>{id.error}</h3>
            <p>{error}</p>
            <Button variant="outline" onClick={refresh} className="mt-4">
              {id.retry}
            </Button>
          </div>
        ) : result.loading ? (
          <div className="empty-state" role="status">
            <Loader2 size={25} className="animate-spin" />
            <p>{id.loading}</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="erp-table">
              <thead>
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => (
                      <th
                        key={header.id}
                        aria-sort={
                          header.column.getIsSorted() === "asc"
                            ? "ascending"
                            : header.column.getIsSorted() === "desc"
                              ? "descending"
                              : undefined
                        }
                      >
                        {header.column.getCanSort() ? (
                          <button
                            className="inline-flex items-center gap-2"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                            <ArrowUpDown size={10} className="text-slate-300" />
                          </button>
                        ) : (
                          flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {result.meta.total === 0 && (
              <div className="empty-state">
                <Database size={28} />
                <h3>{id.empty}</h3>
                <p>{id.emptyHint}</p>
                <Button variant="ghost" className="mt-3" onClick={reset}>
                  {id.reset}
                </Button>
              </div>
            )}
          </div>
        )}
        <div className="list-pagination">
          <span>
            {id.showing(
              result.meta.total
                ? (result.meta.page - 1) * result.meta.pageSize + 1
                : 0,
              Math.min(
                result.meta.page * result.meta.pageSize,
                result.meta.total,
              ),
              result.meta.total,
            )}
          </span>
          <div className="flex items-center gap-2">
            <label className="mr-2 hidden items-center gap-2 sm:flex">
              {id.rows}
              <select
                className="rounded border px-1.5 py-1"
                aria-label={id.rows}
                value={pagination.pageSize}
                onChange={(event) =>
                  setPagination({
                    pageIndex: 0,
                    pageSize: Number(event.target.value),
                  })
                }
              >
                {[5, 10, 20, 50].map((size) => (
                  <option key={size}>{size}</option>
                ))}
              </select>
            </label>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              aria-label={id.previous}
              disabled={!table.getCanPreviousPage() || result.loading}
              onClick={() => table.previousPage()}
            >
              <ChevronLeft />
            </Button>
            <span className="px-1 text-slate-600">
              {result.meta.page} / {result.meta.pageCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              aria-label={id.next}
              disabled={!table.getCanNextPage() || result.loading}
              onClick={() => table.nextPage()}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </section>
      <MasterForm
        key={typeof editing === "object" ? editing?.id : "new"}
        kind={kind}
        record={typeof editing === "object" ? editing : null}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
      <Dialog
        open={!!deleting}
        onOpenChange={(value) => !value && !busy && setDeleting(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogTitle className="text-lg font-semibold">
            {id.deleteTitle}
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-muted-foreground">
            {deleting?.name}
            <br />
            {id.deleteHint}
          </DialogDescription>
          {deleteError && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-xs text-red-700"
            >
              {deleteError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={busy}
            >
              {id.cancel}
            </Button>
            <Button variant="destructive" onClick={remove} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {id.delete}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
