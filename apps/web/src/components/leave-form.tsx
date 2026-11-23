"use client";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  leaveRequestSchema,
  leaveTypes,
  leaveWorkingDays,
  type LeaveInput,
  type LeaveFormInput,
  type LeaveRequest,
} from "@erp/shared";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { id, leaveTypeLabels } from "@/lib/i18n";
import { number } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { EmployeeSelect } from "./employee-select";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
export function LeaveForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (record: LeaveRequest) => void;
}) {
  const { company } = useWorkspace(),
    [error, setError] = useState(""),
    [employeeName, setEmployeeName] = useState("");
  const form = useForm<LeaveFormInput, unknown, LeaveInput>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: {
      requestKey: crypto.randomUUID(),
      employeeId: "",
      type: "ANNUAL",
      fromDate: new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Jakarta",
      }),
      toDate: new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Jakarta",
      }),
      reason: "",
    },
  });
  const employeeId = useWatch({ control: form.control, name: "employeeId" }),
    from = useWatch({ control: form.control, name: "fromDate" }),
    to = useWatch({ control: form.control, name: "toDate" });
  const busy = form.formState.isSubmitting;
  async function submit(input: LeaveInput) {
    setError("");
    try {
      const row = await api<LeaveRequest>(
        `/companies/${company.id}/hr/leave-requests`,
        { method: "POST", body: JSON.stringify(input) },
      );
      toast.success(id.leaveSaved);
      onSaved(row);
    } catch (e) {
      setError(e instanceof Error ? e.message : id.error);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogTitle className="text-lg font-semibold">
          {id.addRecord(id.leaveRequest)}
        </DialogTitle>
        <DialogDescription className="-mt-3 text-xs text-muted-foreground">
          {company.name} · {id.leaveDraftHint}
        </DialogDescription>
        <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
          <fieldset disabled={busy} className="space-y-4">
            <EmployeeSelect
              value={employeeId}
              label={employeeName}
              error={form.formState.errors.employeeId?.message}
              onChange={(r) => {
                form.setValue("employeeId", r.id, { shouldValidate: true });
                setEmployeeName(`${r.name} · ${r.code}`);
              }}
            />
            <label className="block">
              <span className="field-label">{id.leaveType} *</span>
              <select className="field" {...form.register("type")}>
                {leaveTypes.map((type) => (
                  <option key={type} value={type}>
                    {leaveTypeLabels[type]}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="field-label">{id.leaveFrom} *</span>
                <input
                  className="field"
                  type="date"
                  {...form.register("fromDate")}
                  aria-invalid={!!form.formState.errors.fromDate}
                />
                <span className="field-error">
                  {form.formState.errors.fromDate?.message}
                </span>
              </label>
              <label>
                <span className="field-label">{id.leaveTo} *</span>
                <input
                  className="field"
                  type="date"
                  {...form.register("toDate")}
                  aria-invalid={!!form.formState.errors.toDate}
                />
                <span className="field-error">
                  {form.formState.errors.toDate?.message}
                </span>
              </label>
            </div>
            <div className="rounded-lg bg-muted px-4 py-3">
              <strong className="text-sm">
                {number(leaveWorkingDays(from, to))} {id.leaveDays}
              </strong>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {id.leaveDaysHint}
              </p>
            </div>
            <label className="block">
              <span className="field-label">{id.leaveReason} *</span>
              <textarea
                className="field min-h-20"
                maxLength={1000}
                aria-invalid={!!form.formState.errors.reason}
                {...form.register("reason")}
              />
              <span className="field-error">
                {form.formState.errors.reason?.message}
              </span>
            </label>
          </fieldset>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              {id.cancel}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {id.save}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
