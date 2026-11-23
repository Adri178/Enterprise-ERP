"use client";
import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDownUp, ArrowRight } from "lucide-react";
import type { InvoiceReport, ReportInvoice, ReportQuery } from "@erp/shared";
import { id } from "@/lib/i18n";
import { date, money } from "@/lib/utils";
import { Button } from "./ui/button";
import { StatusBadge } from "./ui/badge";

export function ReportInvoices({
  report,
  domain,
  sort,
  direction,
  onSort,
  onPage,
  onOpen,
}: {
  report: InvoiceReport;
  domain: ReportQuery["domain"];
  sort: ReportQuery["sort"];
  direction: ReportQuery["direction"];
  onSort: (
    sort: ReportQuery["sort"],
    direction: ReportQuery["direction"],
  ) => void;
  onPage: (page: number) => void;
  onOpen: (id: string) => void;
}) {
  const columns = useMemo<ColumnDef<ReportInvoice>[]>(
    () => [
      {
        accessorKey: "number",
        header: id.documentNumber,
        cell: ({ row }) => (
          <button
            className="text-link font-medium"
            onClick={() => onOpen(row.original.id)}
          >
            {row.original.number}
          </button>
        ),
      },
      {
        accessorKey: "partyName",
        header: domain === "sales" ? id.customer : id.supplier,
      },
      {
        accessorKey: "date",
        header: id.date,
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{date(row.original.date)}</span>
        ),
      },
      {
        accessorKey: "amount",
        header: id.reportAmount,
        cell: ({ row }) => money(row.original.amount, row.original.currency),
      },
      {
        accessorKey: "settled",
        header: id.reportSettled,
        enableSorting: false,
        cell: ({ row }) => money(row.original.settled, row.original.currency),
      },
      {
        accessorKey: "outstanding",
        header: id.reportOutstanding,
        cell: ({ row }) => (
          <span
            className={
              row.original.outstanding > 0
                ? "font-medium text-amber-700"
                : "text-muted-foreground"
            }
          >
            {money(row.original.outstanding, row.original.currency)}
          </span>
        ),
      },
      {
        id: "settlement",
        header: id.paymentStatus,
        enableSorting: false,
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.outstanding === 0 ? "PAID" : "UNPAID"}
          />
        ),
      },
      {
        id: "actions",
        header: id.actions,
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpen(row.original.id)}
          >
            {id.review}
            <ArrowRight />
          </Button>
        ),
      },
    ],
    [domain, onOpen],
  );
  const table = useReactTable({
    data: report.data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    state: { sorting: [{ id: sort, desc: direction === "desc" }] },
    onSortingChange: (updater) => {
      const before: SortingState = [{ id: sort, desc: direction === "desc" }];
      const next = (
        typeof updater === "function" ? updater(before) : updater
      )[0];
      if (next)
        onSort(next.id as ReportQuery["sort"], next.desc ? "desc" : "asc");
    },
    enableSortingRemoval: false,
    sortDescFirst: false,
  });
  const { total, page, pageSize, pageCount } = report.meta;
  return (
    <>
      {!total ? (
        <div className="empty-state">
          <h3>{id.empty}</h3>
          <p>{id.reportEmptyHint}</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="erp-table" aria-label={id.reportRegister}>
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
                    <td className="whitespace-nowrap" key={cell.id}>
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
      <div className="list-pagination">
        <span>
          {id.showing(
            total ? (page - 1) * pageSize + 1 : 0,
            Math.min(page * pageSize, total),
            total,
          )}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            {id.previous}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pageCount}
            onClick={() => onPage(page + 1)}
          >
            {id.next}
          </Button>
        </div>
      </div>
    </>
  );
}
