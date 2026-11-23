"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDownUp, Plus, Search } from "lucide-react";
import {
  leaveStatuses,
  type Employee,
  type LeaveRequest,
  type PageResult,
} from "@erp/shared";
import { isLive } from "@/lib/api";
import { useCompanyResource } from "@/lib/company-resource";
import { useDebouncedValue } from "@/lib/catalog-hooks";
import { id, leaveTypeLabels, statusLabels } from "@/lib/i18n";
import { date, number } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { PageHeader } from "./page-header";
import { EmployeeSelect } from "./employee-select";
import { LeaveForm } from "./leave-form";
import { LeaveDetail } from "./leave-detail";
import { HrLoading, HrNotice, HrPagination } from "./hr-common";
import { Button } from "./ui/button";
import { StatusBadge } from "./ui/badge";
export function LeavesPage() {
  const { company } = useWorkspace();
  return <LeaveRegister key={company.id} />;
}
function LeaveRegister() {
  const { company, writable, refresh } = useWorkspace(),
    search = useSearchParams();
  const [q, setQ] = useState(""),
    [status, setStatus] = useState("ALL"),
    [employeeId, setEmployeeId] = useState(search.get("employeeId") || ""),
    [page, setPage] = useState(1),
    [direction, setDirection] = useState("desc"),
    [revision, setRevision] = useState(0),
    [create, setCreate] = useState(false),
    [selected, setSelected] = useState<string | null>(null);
  const query = useDebouncedValue(q),
    params = new URLSearchParams({
      q: query,
      status,
      page: String(page),
      pageSize: "10",
      direction,
      ...(employeeId ? { employeeId } : {}),
    });
  useEffect(() => {
    setQ(search.get("q") || "");
    setEmployeeId(search.get("employeeId") || "");
    setPage(1);
  }, [search]);
  const result = useCompanyResource<PageResult<LeaveRequest>>(
    `hr/leave-requests?${params}`,
    revision,
  );
  const employee = useCompanyResource<Employee>(
    `hr/employees/${employeeId}`,
    revision,
    !!employeeId,
  );
  const changed = () => {
    setRevision((v) => v + 1);
    refresh();
  };
  return (
    <>
      <PageHeader
        title={id.list(id.leaveRequests)}
        parent={id.hrTitle}
        description={`${company.name} · ${id.leaveDescription}`}
        actions={
          <Button
            disabled={!isLive || !writable}
            onClick={() => setCreate(true)}
          >
            <Plus />
            {id.addRecord(id.leaveRequest)}
          </Button>
        }
      />
      <HrNotice />
      <p className="mb-4 text-xs text-muted-foreground">
        {id.leavePendingHint}
      </p>
      <section className="panel overflow-hidden">
        <div className="table-toolbar">
          <div className="toolbar-search">
            <Search size={15} />
            <input
              className="field"
              aria-label={id.search}
              maxLength={120}
              placeholder={id.leaveSearch}
              value={q}
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
              {leaveStatuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </select>
            <div className="w-48">
              <EmployeeSelect
                value={employeeId}
                label={employee.data?.name}
                required={false}
                activeOnly={false}
                onChange={(r) => {
                  setEmployeeId(r.id);
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
                setEmployeeId("");
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
            <table className="erp-table" aria-label={id.list(id.leaveRequests)}>
              <thead>
                <tr>
                  <th>{id.documentNumber}</th>
                  <th>{id.employee}</th>
                  <th>{id.leaveType}</th>
                  <th
                    aria-sort={direction === "asc" ? "ascending" : "descending"}
                  >
                    <button
                      className="flex items-center gap-1"
                      onClick={() => {
                        setDirection((v) => (v === "asc" ? "desc" : "asc"));
                        setPage(1);
                      }}
                    >
                      {id.leavePeriod}
                      <ArrowDownUp size={12} />
                    </button>
                  </th>
                  <th>{id.leaveDays}</th>
                  <th>{id.status}</th>
                  <th>{id.leaveCreator}</th>
                  <th>{id.actions}</th>
                </tr>
              </thead>
              <tbody>
                {result.data.data.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <button
                        className="text-link font-medium"
                        onClick={() => setSelected(row.id)}
                      >
                        {row.number}
                      </button>
                    </td>
                    <td>
                      <p className="font-medium">{row.employeeName}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {row.employeeCode}
                      </p>
                    </td>
                    <td>{leaveTypeLabels[row.type]}</td>
                    <td className="whitespace-nowrap">
                      {date(row.fromDate)} – {date(row.toDate)}
                    </td>
                    <td>{number(row.days)}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>{row.creatorName}</td>
                    <td>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelected(row.id)}
                      >
                        {id.review}
                      </Button>
                    </td>
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
      {create && (
        <LeaveForm
          onClose={() => setCreate(false)}
          onSaved={(row) => {
            setCreate(false);
            setSelected(row.id);
            changed();
          }}
        />
      )}
      {selected && (
        <LeaveDetail
          key={selected}
          documentId={selected}
          onClose={() => setSelected(null)}
          onChanged={changed}
        />
      )}
    </>
  );
}
