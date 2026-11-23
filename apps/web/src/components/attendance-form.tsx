"use client";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { attendanceCreateSchema, attendanceCorrectionSchema, attendanceToday, type AttendanceCreate, type AttendanceEntry } from "@erp/shared";
import { toast } from "sonner";
import { id } from "@/lib/i18n";
import { api } from "@/lib/api";
import { date } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { EmployeeSelect } from "./employee-select";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { DesignField } from "./design/common";

const t = id.attendance;
// Identity and version fields are sent through distinct server schemas.
type Values = AttendanceCreate & { expectedUpdatedAt: string; reason: string };
export function AttendanceForm({ record, onClose, onSaved }: { record?: AttendanceEntry; onClose: () => void; onSaved: (row: AttendanceEntry) => void }) {
  const { company, writable } = useWorkspace(), [error, setError] = useState(""), [employeeLabel, setEmployeeLabel] = useState(record ? `${record.employeeName} · ${record.employeeCode}` : "");
  const form = useForm<Values>({ defaultValues: { requestKey: crypto.randomUUID(), employeeId: record?.employeeId || "", date: record?.date || attendanceToday(), status: record?.status || "PRESENT", checkIn: record ? record.checkIn : "08:00", checkOut: record ? record.checkOut : "17:00", description: record?.description || "", expectedUpdatedAt: record?.updatedAt || "", reason: "" } });
  const status = useWatch({ control: form.control, name: "status" }), employeeId = useWatch({ control: form.control, name: "employeeId" }), busy = form.formState.isSubmitting;
  const statusField = form.register("status");
  async function submit(values: Values) {
    setError("");
    const { status, checkIn, checkOut, description } = values;
    const fields = { status, checkIn, checkOut, description };
    // Resolve only the permitted fields; the server also rejects extra identity fields on corrections.
    const input = record ? { ...fields, expectedUpdatedAt: record.updatedAt, reason: values.reason } : { ...fields, employeeId: values.employeeId, date: values.date, requestKey: values.requestKey };
    const result = record ? attendanceCorrectionSchema.safeParse(input) : attendanceCreateSchema.safeParse(input);
    if (!result.success) {
      for (const issue of result.error.issues) form.setError(issue.path[0] as keyof Values, { message: issue.message });
      return;
    }
    try {
      const row = await api<AttendanceEntry>(`/companies/${company.id}/hr/attendance${record ? `/${record.id}` : ""}`, { method: record ? "PATCH" : "POST", body: JSON.stringify(result.data) });
      toast.success(record ? t.corrected : t.saved); onSaved(row);
    } catch (error) { setError(error instanceof Error ? error.message : id.error); }
  }
  const errors = form.formState.errors;
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="max-w-2xl"><DialogTitle className="text-lg font-semibold">{record ? t.correct : t.add}</DialogTitle><DialogDescription>{company.name} · {record ? t.identity : t.leaveHint}</DialogDescription><form noValidate className="space-y-4" onSubmit={form.handleSubmit(submit)}><fieldset disabled={busy || !writable} className="space-y-4">{record ? <div className="rounded-lg bg-muted p-4 text-sm"><strong className="block">{employeeLabel}</strong><span className="mt-1 block text-muted-foreground">{date(record.date)} · {record.number}</span></div> : <><EmployeeSelect value={employeeId} label={employeeLabel} error={errors.employeeId?.message} onChange={employee => { form.setValue("employeeId", employee.id); form.clearErrors("employeeId"); setEmployeeLabel(`${employee.name} · ${employee.code}`); }} /><DesignField name="live-attendance-date" label={id.date} required error={errors.date?.message}><input id="live-attendance-date" className="field" type="date" max={attendanceToday()} {...form.register("date")} /></DesignField></>}
    <div className="grid gap-4 sm:grid-cols-2"><DesignField name="live-attendance-status" label={id.status}><select id="live-attendance-status" className="field" {...statusField} onChange={event => { statusField.onChange(event); form.clearErrors(); if (event.target.value !== "PRESENT") { form.setValue("checkIn", ""); form.setValue("checkOut", ""); } else { form.setValue("checkIn", "08:00"); form.setValue("checkOut", "17:00"); } }}>{Object.entries(t.statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></DesignField>{status === "PRESENT" && <><DesignField name="live-attendance-in" label={t.checkIn} required error={errors.checkIn?.message}><input id="live-attendance-in" className="field" type="time" {...form.register("checkIn")} /></DesignField><DesignField name="live-attendance-out" label={t.checkOut} required error={errors.checkOut?.message}><input id="live-attendance-out" className="field" type="time" {...form.register("checkOut")} /></DesignField></>}</div><DesignField name="live-attendance-description" label={id.description} error={errors.description?.message}><textarea id="live-attendance-description" className="field min-h-20" maxLength={1000} {...form.register("description")} /></DesignField>{record && <DesignField name="live-attendance-reason" label={t.reason} required error={errors.reason?.message}><textarea id="live-attendance-reason" className="field min-h-20" maxLength={500} {...form.register("reason")} /></DesignField>}</fieldset>{error && <p role="alert" className="field-error">{error}</p>}<div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{id.cancel}</Button><Button type="submit" disabled={busy || !writable}>{id.save}</Button></div></form></DialogContent></Dialog>;
}
