"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDownUp, Download, Info, Loader2, Plus, RotateCw, Search } from "lucide-react";
import { attendanceStatuses, attendanceToday, type AttendanceEntry, type AttendanceResult, type Employee } from "@erp/shared";
import { toast } from "sonner";
import { api, isLive } from "@/lib/api";
import { useCompanyResource } from "@/lib/company-resource";
import { useDebouncedValue } from "@/lib/catalog-hooks";
import { id } from "@/lib/i18n";
import { date, exportCsv, number } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { PageHeader } from "./page-header";
import { ListPagination, ResourceState } from "./list-state";
import { Button } from "./ui/button";
import { EmployeeSelect } from "./employee-select";
import { DesignBadge, DesignSummary } from "./design/common";
import { AttendanceForm } from "./attendance-form";
import { AttendanceDetail } from "./attendance-detail";
import { AttendancePage as AttendanceDemo } from "./design/attendance-page";
const t = id.attendance;
export function AttendancePage() {
  const { company } = useWorkspace(), search = useSearchParams(), request = search.toString();
  const [source, setSource] = useState({ request, companyId: company.id });
  if (source.request !== request || (!source.companyId && company.id)) setSource({ request, companyId: company.id });
  return isLive ? <AttendanceRegister key={`${company.id}:${request}`} initialEmployeeId={source.companyId === company.id ? search.get("employeeId") || "" : ""} /> : <AttendanceDemo />;
}
function AttendanceRegister({ initialEmployeeId }: { initialEmployeeId: string }) {
  const { company, writable, refresh } = useWorkspace();
  const [period, setPeriod] = useState(attendanceToday().slice(0, 7)), [query, setQuery] = useState(""), [status, setStatus] = useState("ALL"), [page, setPage] = useState(1), [direction, setDirection] = useState<"asc" | "desc">("desc"), [employee, setEmployee] = useState<Pick<Employee, "id" | "name" | "code"> | null>(initialEmployeeId ? { id: initialEmployeeId, name: "", code: "" } : null), [revision, setRevision] = useState(0), [editing, setEditing] = useState<AttendanceEntry | "new" | null>(null), [selected, setSelected] = useState<string | null>(null), [exporting, setExporting] = useState(false);
  const q = useDebouncedValue(query), exportRequest = useRef<AbortController | null>(null);
  const params = new URLSearchParams({ period, q, status, page: String(page), pageSize: "10", direction, ...(employee ? { employeeId: employee.id } : {}) }).toString();
  const result = useCompanyResource<AttendanceResult>(`hr/attendance?${params}`, revision), summary = result.data?.summary;
  useEffect(() => () => { exportRequest.current?.abort(); }, [company.id, params]);
  const reload = () => { setRevision(value => value + 1); refresh(); };
  async function download() {
    exportRequest.current?.abort(); const controller = new AbortController(); exportRequest.current = controller; setExporting(true);
    try {
      const result = await api<{ data: AttendanceEntry[] }>(`/companies/${company.id}/hr/attendance/export?${params}`, { signal: controller.signal });
      if (!controller.signal.aborted) exportCsv(`attendance-${company.code}-${period}.csv`, [[id.code, id.employee, "Branch", id.department, id.date, id.status, t.checkIn, t.checkOut, `${t.duration} (${t.minutes})`, id.description], ...result.data.map(row => [row.number, `${row.employeeCode} · ${row.employeeName}`, row.branchName, row.departmentName, row.date, t.statusLabels[row.status], row.checkIn, row.checkOut, row.durationMinutes, row.description])]);
    } catch (error) { if (!controller.signal.aborted) toast.error(error instanceof Error ? error.message : id.error); }
    finally { if (exportRequest.current === controller) setExporting(false); }
  }
  return <><PageHeader title={t.title} parent="Human Resources" description={`${company.name} · ${t.description}`} actions={<Button disabled={!writable} onClick={() => setEditing("new")}><Plus />{t.add}</Button>} /><div className="notice mb-5 items-start"><Info size={16} className="mt-0.5 shrink-0" /><div><p>{t.scope}</p><p className="mt-1">{t.leaveHint}</p>{!writable && <p className="mt-2 font-medium">{t.readOnly}</p>}</div></div><DesignSummary items={[{ label: `${t.statusLabels.PRESENT} · ${t.summary}`, value: summary?.present || 0 }, { label: `${t.statusLabels.PERMIT} / ${t.statusLabels.LEAVE}`, value: (summary?.permit || 0) + (summary?.leave || 0) }, { label: t.duration, value: `${number(Math.round((summary?.durationMinutes || 0) / 60 * 100) / 100)} ${t.hours}` }]} /><section className="panel overflow-hidden"><div className="table-toolbar flex-wrap"><div className="toolbar-search"><Search size={15} /><input className="field" aria-label={id.search} placeholder={t.search} value={query} maxLength={120} onChange={event => { setQuery(event.target.value); setPage(1); }} /></div><label><span className="sr-only">{t.period}</span><input className="field !w-auto" aria-label={t.period} type="month" value={period} onChange={event => { setPeriod(event.target.value || attendanceToday().slice(0, 7)); setPage(1); }} /></label><select className="field !w-auto" aria-label={id.status} value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="ALL">{id.allStatus}</option>{attendanceStatuses.map(value => <option key={value} value={value}>{t.statusLabels[value]}</option>)}</select><Button variant="outline" onClick={reload}><RotateCw />{t.reload}</Button><Button variant="outline" disabled={exporting || result.loading || !!result.error || !result.data?.meta.total} onClick={download}>{exporting ? <Loader2 className="animate-spin" /> : <Download />}{t.export}</Button></div><div className="flex flex-wrap items-end gap-3 border-b px-5 py-3"><div className="w-72 max-w-full"><EmployeeSelect value={employee?.id || ""} label={employee ? employee.name ? `${employee.name} · ${employee.code}` : employee.id : t.allEmployees} activeOnly={false} required={false} onChange={value => { setEmployee(value); setPage(1); }} /></div>{employee && <Button variant="ghost" onClick={() => { setEmployee(null); setPage(1); }}>{id.reset}</Button>}<p className="pb-2 text-xs text-muted-foreground">{t.exportHint}</p></div>{result.loading || result.error ? <ResourceState error={result.error} retry={reload} /> : !result.data?.data.length ? <div className="empty-state"><h2>{t.empty}</h2><p>{t.emptyHint}</p></div> : <div className="table-scroll"><table className="erp-table" aria-label={t.title}><thead><tr><th>{id.code}</th><th>{id.employee}</th><th>{id.department}</th><th aria-sort={direction === "asc" ? "ascending" : "descending"}><button className="inline-flex items-center gap-1" onClick={() => { setDirection(value => value === "asc" ? "desc" : "asc"); setPage(1); }}>{id.date}<ArrowDownUp size={12} /></button></th><th>{t.checkIn}</th><th>{t.checkOut}</th><th>{t.duration}</th><th>{id.status}</th><th>{id.actions}</th></tr></thead><tbody>{result.data.data.map(row => <tr key={row.id}><td><button className="document-link" onClick={() => setSelected(row.id)}>{row.number}</button></td><td><strong className="block font-medium">{row.employeeName}</strong><span className="mt-1 block text-xs text-muted-foreground">{row.employeeCode}</span></td><td>{row.departmentName}</td><td>{date(row.date)}</td><td>{row.checkIn || "—"}</td><td>{row.checkOut || "—"}</td><td className="tabular-nums">{row.durationMinutes ? `${Math.floor(row.durationMinutes / 60)} ${t.hours} ${row.durationMinutes % 60} ${t.minutes}` : "—"}</td><td><DesignBadge tone={row.status === "PRESENT" ? "green" : row.status === "ABSENT" ? "red" : "amber"}>{t.statusLabels[row.status]}</DesignBadge></td><td><Button variant="ghost" size="sm" onClick={() => setSelected(row.id)}>{id.review}</Button></td></tr>)}</tbody></table></div>}<ListPagination meta={result.data?.meta} loading={result.loading} onPage={setPage} /></section>{editing && <AttendanceForm record={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onSaved={row => { setEditing(null); setSelected(row.id); setPeriod(row.date.slice(0, 7)); reload(); }} />}{selected && <AttendanceDetail recordId={selected} revision={revision} onClose={() => setSelected(null)} onEdit={row => { setSelected(null); setEditing(row); }} />}</>;
}
