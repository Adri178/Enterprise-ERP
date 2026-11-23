"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ArrowDownUp, Plus, Search } from "lucide-react";
import type {
  Employee,
  EmployeeQuery,
  MasterRecord,
  PageResult,
} from "@erp/shared";
import { isLive } from "@/lib/api";
import { useCompanyResource } from "@/lib/company-resource";
import { useDebouncedValue } from "@/lib/catalog-hooks";
import { id, employmentLabels } from "@/lib/i18n";
import { date } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { PageHeader } from "./page-header";
import { EmployeeForm } from "./employee-form";
import { RecordSelect } from "./record-select";
import { HrLoading, HrNotice, HrPagination } from "./hr-common";
import { Button } from "./ui/button";
import { StatusBadge } from "./ui/badge";

export function EmployeesPage() {
  const { company } = useWorkspace();
  return <EmployeeDirectory key={company.id} />;
}
function EmployeeDirectory() {
  const { company, writable, refresh } = useWorkspace();
  const search = useSearchParams();
  const [q, setQ] = useState(search.get("q") || ""),
    [status, setStatus] = useState("ALL"),
    [branch, setBranch] = useState<MasterRecord | null>(null),
    [page, setPage] = useState(1),
    [sort, setSort] = useState<EmployeeQuery["sort"]>("name"),
    [direction, setDirection] = useState<EmployeeQuery["direction"]>("asc"),
    [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<Employee | "new" | null>(null);
  useEffect(() => {
    setQ(search.get("q") || "");
    setPage(1);
  }, [search]);
  const query = useDebouncedValue(q);
  const params = new URLSearchParams({
    q: query,
    status,
    page: String(page),
    pageSize: "10",
    sort,
    direction,
    ...(branch ? { branchId: branch.id } : {}),
  });
  const result = useCompanyResource<PageResult<Employee>>(
    `hr/employees?${params}`,
    revision,
  );
  const columns = useMemo<ColumnDef<Employee>[]>(
    () => [
      {
        accessorKey: "code",
        header: id.employeeCode,
        cell: ({ row }) => (
          <button
            className="text-link font-medium"
            onClick={() => setEditing(row.original)}
          >
            {row.original.code}
          </button>
        ),
      },
      {
        accessorKey: "name",
        header: id.employeeName,
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {row.original.email || "—"}
            </p>
          </div>
        ),
      },
      { accessorKey: "jobTitle", header: id.employeeJob, enableSorting: false },
      { accessorKey: "branchName", header: id.branch, enableSorting: false },
      {
        accessorKey: "departmentName",
        header: id.department,
        enableSorting: false,
      },
      {
        accessorKey: "employmentType",
        header: id.employmentType,
        enableSorting: false,
        cell: ({ row }) => employmentLabels[row.original.employmentType],
      },
      {
        accessorKey: "startDate",
        header: id.employmentStart,
        cell: ({ row }) => date(row.original.startDate),
      },
      {
        accessorKey: "status",
        header: id.status,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: id.actions,
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditing(row.original)}
          >
            {writable ? id.edit : id.review}
          </Button>
        ),
      },
    ],
    [writable],
  );
  const table = useReactTable({
    data: result.data?.data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    enableSortingRemoval: false,
    sortDescFirst: false,
    state: { sorting: [{ id: sort, desc: direction === "desc" }] },
    onSortingChange: (updater) => {
      const current = [{ id: sort, desc: direction === "desc" }],
        next = (typeof updater === "function" ? updater(current) : updater)[0];
      if (next) {
        setSort(next.id as EmployeeQuery["sort"]);
        setDirection(next.desc ? "desc" : "asc");
        setPage(1);
      }
    },
  });
  const changed = () => {
    setRevision((r) => r + 1);
    refresh();
  };
  return (
    <>
      <PageHeader
        title={id.list(id.employees)}
        parent={id.hrTitle}
        description={`${company.name} · ${id.employeeDescription}`}
        actions={
          <Button
            disabled={!isLive || !writable}
            onClick={() => setEditing("new")}
          >
            <Plus />
            {id.addRecord(id.employee)}
          </Button>
        }
      />
      <HrNotice />
      <section className="panel overflow-hidden">
        <div className="table-toolbar">
          <div className="toolbar-search">
            <Search size={15} />
            <input
              className="field"
              aria-label={id.search}
              placeholder={id.employeeSearch}
              value={q}
              maxLength={120}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <select
              className="field !w-auto"
              aria-label={id.status}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">{id.allStatus}</option>
              <option value="ACTIVE">{id.active}</option>
              <option value="INACTIVE">{id.inactive}</option>
            </select>
            <div className="w-44">
              <RecordSelect
                kind="branches"
                label={id.branch}
                value={branch?.id || ""}
                selectedLabel={branch?.name}
                required={false}
                onChange={(r) => {
                  setBranch(r);
                  setPage(1);
                }}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                setStatus("ALL");
                setBranch(null);
                setPage(1);
              }}
            >
              {id.reset}
            </Button>
          </div>
        </div>
        {!isLive ? (
          <div className="empty-state">
            <p>{id.hrLiveOnly}</p>
          </div>
        ) : result.loading || result.error ? (
          <HrLoading error={result.error} retry={changed} />
        ) : !result.data?.data.length ? (
          <div className="empty-state">
            <h2>{id.empty}</h2>
            <p>{id.emptyHint}</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="erp-table" aria-label={id.list(id.employees)}>
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
                            className="flex items-center gap-1 whitespace-nowrap"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                            <ArrowDownUp size={12} />
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
                  <tr key={row.original.id}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="whitespace-nowrap">
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
          </div>
        )}
        <HrPagination
          meta={result.data?.meta}
          loading={result.loading}
          onPage={setPage}
        />
      </section>
      <p className="mt-3 text-[11px] text-muted-foreground">
        {id.employeeScope}
      </p>
      {editing && (
        <EmployeeForm
          record={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            changed();
          }}
        />
      )}
    </>
  );
}
