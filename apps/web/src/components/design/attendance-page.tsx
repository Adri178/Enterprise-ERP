"use client";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { id } from "@/lib/i18n";
import { date, number } from "@/lib/utils";
import { attendanceFields, attendanceMinutes, attendanceSchema, checkAttendanceUnique, demoEmployees, nextDesignNumber, todayInJakarta, type Attendance, type AttendanceInput } from "@/lib/design/models";
import { attendanceFixtures } from "@/lib/design/fixtures";
import { useDesignRecords } from "@/lib/design/use-design-records";
import { useWorkspace } from "../workspace-provider";
import { PageHeader } from "../page-header";
import { Button } from "../ui/button";
import { DesignBadge, DesignDialog, DesignFacts, DesignNotice, DesignSummary, DesignTable } from "./common";
import { AttendanceForm } from "./attendance-form";

const d = id.design;
const employeeName = (employeeId: string) => demoEmployees.find(employee => employee.id === employeeId)?.name || "—";
const duration = (record: Pick<Attendance, "checkIn" | "checkOut">) => { const minutes = attendanceMinutes(record); return minutes ? `${Math.floor(minutes / 60)} ${d.hours} ${minutes % 60} ${d.minutes}` : "—"; };
const badge = (record: Attendance) => <DesignBadge tone={record.status === "PRESENT" ? "green" : record.status === "ABSENT" ? "red" : "amber"}>{d.attendanceStatus[record.status]}</DesignBadge>;
function snapshot(value: Attendance["corrections"][number]["before"]) { return `${employeeName(value.employeeId)} · ${date(value.date)} · ${d.attendanceStatus[value.status]} · ${value.checkIn || "—"}–${value.checkOut || "—"}${value.description ? ` · ${value.description}` : ""}`; }
export function AttendancePage() { const { company } = useWorkspace(); return <AttendanceWorkspace key={company.id} />; }
function AttendanceWorkspace() {
  const { company, writable, user } = useWorkspace(), store = useDesignRecords("attendance", attendanceSchema, attendanceFixtures);
  const [month, setMonth] = useState(todayInJakarta().slice(0, 7)), [editing, setEditing] = useState<Attendance | "new" | null>(null), [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = store.rows.find(record => record.id === selectedId), rows = store.rows.filter(record => record.date.startsWith(month));
  function save(input: AttendanceInput) {
    const values = attendanceFields.parse(input), timestamp = new Date().toISOString();
    store.update(rows => {
      const currentId = editing && editing !== "new" ? editing.id : undefined;
      checkAttendanceUnique(rows, input, currentId);
      if (!currentId) return [{ ...values, id: crypto.randomUUID(), companyId: company.id, number: nextDesignNumber("AT", company.code, rows), updatedAt: timestamp, corrections: [] }, ...rows];
      if (input.reason.length < 5) throw new Error(d.correctionReasonRequired);
      return rows.map(record => record.id !== currentId ? record : { ...record, ...values, updatedAt: timestamp, corrections: [...record.corrections, { at: timestamp, actor: user.name, reason: input.reason, before: attendanceFields.parse(record), after: values }] });
    });
    setMonth(input.date.slice(0, 7)); setEditing(null); toast.success(d.saved);
  }
  const columns: ColumnDef<Attendance>[] = [
    { accessorKey: "number", header: id.code, cell: ({ row }) => <button className="document-link" onClick={() => setSelectedId(row.original.id)}>{row.original.number}</button> },
    { id: "employee", header: d.employee, accessorFn: row => employeeName(row.employeeId) },
    { id: "department", header: d.department, accessorFn: row => demoEmployees.find(employee => employee.id === row.employeeId)?.department || "—" },
    { accessorKey: "date", header: id.date, cell: ({ row }) => date(row.original.date) },
    { accessorKey: "checkIn", header: d.checkIn, cell: ({ row }) => row.original.checkIn || "—" },
    { accessorKey: "checkOut", header: d.checkOut, cell: ({ row }) => row.original.checkOut || "—" },
    { id: "duration", header: d.duration, accessorFn: row => attendanceMinutes(row), cell: ({ row }) => duration(row.original) },
    { id: "status", header: id.status, accessorFn: row => d.attendanceStatus[row.status], cell: ({ row }) => badge(row.original) },
    { id: "actions", header: id.actions, cell: ({ row }) => <Button size="sm" variant="ghost" onClick={() => setSelectedId(row.original.id)}>{d.detail}</Button> },
  ];
  return <><PageHeader title={d.attendance} parent="Human Resources" description={`${company.name} · ${d.attendanceDescription}`} actions={<Button disabled={!writable || store.loading || !!store.error} onClick={() => setEditing("new")}><Plus />{d.add} {d.attendance}</Button>} /><DesignNotice>{d.attendanceHint}</DesignNotice><DesignSummary items={[{ label: d.attendanceStatus.PRESENT, value: rows.filter(row => row.status === "PRESENT").length }, { label: `${d.attendanceStatus.PERMIT} / ${d.attendanceStatus.LEAVE}`, value: rows.filter(row => ["PERMIT", "LEAVE"].includes(row.status)).length }, { label: d.duration, value: `${number(Math.round(rows.reduce((sum, row) => sum + attendanceMinutes(row), 0) / 60 * 100) / 100)} ${d.hours}` }]} /><DesignTable title={d.attendance} rows={rows} columns={columns} searchHint={d.attendanceSearch} statusLabels={d.attendanceStatus} statusOf={row => row.status} loading={store.loading} error={store.error} retry={store.retry} filename={`demo-attendance-${company.code}-${month}.csv`} extra={<div><label htmlFor="attendance-period" className="sr-only">{d.period}</label><input id="attendance-period" className="field !w-auto" type="month" value={month} onChange={event => setMonth(event.target.value)} /></div>} />
    {editing && <AttendanceForm record={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onSave={save} />}
    {selected && <DesignDialog title={employeeName(selected.employeeId)} description={`${selected.number} · ${company.name}`} onClose={() => setSelectedId(null)}><div>{badge(selected)}</div><DesignFacts items={[{ label: d.department, value: demoEmployees.find(employee => employee.id === selected.employeeId)?.department }, { label: id.date, value: date(selected.date) }, { label: d.checkIn, value: selected.checkIn }, { label: d.checkOut, value: selected.checkOut }, { label: d.duration, value: duration(selected) }, { label: id.description, value: selected.description }]} /><section className="border-t pt-4"><h3 className="mb-3 text-sm font-semibold">{d.correctionHistory}</h3>{!selected.corrections.length ? <p className="text-sm text-muted-foreground">{d.correctionEmpty}</p> : <ol className="space-y-4">{selected.corrections.slice().reverse().map((entry, index) => <li key={`${entry.at}-${index}`} className="border-l-2 border-emerald-200 pl-4 text-sm"><p className="font-medium">{entry.reason}</p><p className="mt-1 text-xs text-muted-foreground">{entry.actor} · {date(entry.at)} · {new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(entry.at))}</p><p className="mt-2 break-words text-xs">{d.before}: {snapshot(entry.before)}</p><p className="mt-1 break-words text-xs">{d.after}: {snapshot(entry.after)}</p></li>)}</ol>}</section>{writable && <div className="flex justify-end border-t pt-4"><Button variant="outline" onClick={() => { setEditing(selected); setSelectedId(null); }}><Pencil />{d.correction}</Button></div>}</DesignDialog>}
  </>;
}
