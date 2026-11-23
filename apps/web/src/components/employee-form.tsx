"use client";
import { useState } from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  employeeSchema,
  employmentTypes,
  type Employee,
  type EmployeeInput,
  type EmployeeFormInput,
} from "@erp/shared";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { id, employmentLabels } from "@/lib/i18n";
import { useWorkspace } from "./workspace-provider";
import { RecordSelect } from "./record-select";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";

export function EmployeeForm({
  record,
  onClose,
  onSaved,
}: {
  record?: Employee;
  onClose: () => void;
  onSaved: (record: Employee) => void;
}) {
  const { company, writable } = useWorkspace();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmation, setConfirmation] = useState<EmployeeInput | null>(null);
  const [branchName, setBranchName] = useState(record?.branchName || ""),
    [departmentName, setDepartmentName] = useState(
      record?.departmentName || "",
    );
  const form = useForm<EmployeeFormInput, unknown, EmployeeInput>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      code: "",
      name: "",
      email: "",
      phone: "",
      jobTitle: "",
      branchId: "",
      departmentId: "",
      employmentType: "PERMANENT",
      status: "ACTIVE",
      startDate: new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Jakarta",
      }),
      endDate: "",
      ...record,
    },
  });
  const status = useWatch({ control: form.control, name: "status" }),
    branchId = useWatch({ control: form.control, name: "branchId" }),
    departmentId = useWatch({ control: form.control, name: "departmentId" });
  async function save(values: EmployeeInput) {
    setBusy(true);
    setError("");
    try {
      const saved = await api<Employee>(
        `/companies/${company.id}/hr/employees${record ? `/${record.id}` : ""}`,
        {
          method: record ? "PATCH" : "POST",
          body: JSON.stringify({
            ...values,
            ...(record ? { expectedUpdatedAt: record.updatedAt } : {}),
          }),
        },
      );
      toast.success(id.employeeSaved);
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : id.error);
    } finally {
      setBusy(false);
    }
  }
  const field = (
    name:
      | "code"
      | "name"
      | "email"
      | "phone"
      | "jobTitle"
      | "startDate"
      | "endDate",
    label: string,
    type = "text",
    required = true,
  ) => (
    <label className="block">
      <span className="field-label">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        className="field"
        type={type}
        readOnly={name === "code" && !!record}
        aria-invalid={!!form.formState.errors[name]}
        {...form.register(name)}
      />
      <span
        className="field-error"
        role={form.formState.errors[name] ? "alert" : undefined}
      >
        {form.formState.errors[name]?.message}
      </span>
    </label>
  );
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogTitle className="text-lg font-semibold">
          {record
            ? writable
              ? id.editRecord(id.employee)
              : `${id.recordInfo} ${id.employee}`
            : id.addRecord(id.employee)}
        </DialogTitle>
        <DialogDescription className="-mt-3 text-xs text-muted-foreground">
          {company.name} · {id.employeeScope}
        </DialogDescription>
        <form
          onSubmit={form.handleSubmit(async (values) => {
            if (record?.status === "ACTIVE" && values.status === "INACTIVE") {
              setError("");
              setConfirmation(values);
            } else await save(values);
          })}
          className="space-y-5"
        >
          <fieldset disabled={!writable || busy} className="space-y-5">
            <section>
              <h2 className="mb-3 text-xs font-semibold">{id.recordInfo}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {field("code", id.employeeCode)}
                {field("name", id.employeeName)}
                {field("jobTitle", id.employeeJob)}
                <label>
                  <span className="field-label">{id.employmentType} *</span>
                  <select
                    className="field"
                    {...form.register("employmentType")}
                  >
                    {employmentTypes.map((type) => (
                      <option key={type} value={type}>
                        {employmentLabels[type]}
                      </option>
                    ))}
                  </select>
                </label>
                {field("email", id.employeeEmail, "email", false)}
                {field("phone", id.employeePhone, "tel", false)}
              </div>
            </section>
            <section className="border-t pt-4">
              <h2 className="mb-3 text-xs font-semibold">
                {id.employeeOrganization}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <RecordSelect
                  kind="branches"
                  label={id.branch}
                  value={branchId}
                  selectedLabel={branchName}
                  error={form.formState.errors.branchId?.message}
                  onChange={(r) => {
                    form.setValue("branchId", r.id, { shouldValidate: true });
                    setBranchName(r.name);
                    form.setValue("departmentId", "");
                    setDepartmentName("");
                  }}
                />
                <RecordSelect
                  key={branchId}
                  kind="departments"
                  label={id.department}
                  branchId={branchId || undefined}
                  disabled={!branchId}
                  value={departmentId}
                  selectedLabel={departmentName}
                  error={form.formState.errors.departmentId?.message}
                  onChange={(r) => {
                    form.setValue("departmentId", r.id, {
                      shouldValidate: true,
                    });
                    setDepartmentName(r.name);
                  }}
                />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {id.employeeDepartmentHint}
              </p>
            </section>
            <section className="border-t pt-4">
              <h2 className="mb-3 text-xs font-semibold">
                {id.employeeEmployment}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {field("startDate", id.employmentStart, "date")}
                <label>
                  <span className="field-label">{id.status} *</span>
                  <select
                    className="field"
                    {...form.register("status", {
                      onChange: (e) => {
                        if (e.target.value === "ACTIVE")
                          form.setValue("endDate", "");
                      },
                    })}
                  >
                    <option value="ACTIVE">{id.active}</option>
                    <option value="INACTIVE">{id.inactive}</option>
                  </select>
                </label>
                {status === "INACTIVE" &&
                  field("endDate", id.employmentEnd, "date")}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {id.employmentEndHint}
              </p>
            </section>
          </fieldset>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            {record && (
              <Button variant="ghost" asChild>
                <Link href={`/leave-requests?employeeId=${record.id}`}>
                  {id.leaveRequests}
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              type="button"
              disabled={busy}
              onClick={onClose}
            >
              {writable ? id.cancel : id.close}
            </Button>
            {writable && (
              <Button disabled={busy} type="submit">
                {busy && <Loader2 className="animate-spin" />}
                {record ? id.saveChanges : id.save}
              </Button>
            )}
          </div>
        </form>
        <Dialog
          open={!!confirmation}
          onOpenChange={(v) => {
            if (!v && !busy) setConfirmation(null);
          }}
        >
          <DialogContent>
            <DialogTitle>{id.confirm}</DialogTitle>
            <DialogDescription>{id.employmentEndHint}</DialogDescription>
            <p className="text-sm">
              {record?.name} · {id.inactive} · {confirmation?.endDate}
            </p>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setConfirmation(null)}
              >
                {id.cancel}
              </Button>
              <Button
                disabled={busy}
                onClick={() => confirmation && save(confirmation)}
              >
                {id.confirm}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
