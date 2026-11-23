"use client";
import { useState } from "react";
import { leaveActions, type LeaveAction, type LeaveRequest } from "@erp/shared";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useCompanyResource } from "@/lib/company-resource";
import { id, leaveTypeLabels } from "@/lib/i18n";
import { date, number } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { HrLoading } from "./hr-common";
import { Button } from "./ui/button";
import { StatusBadge } from "./ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
export const leaveActionLabels: Record<LeaveAction, string> = {
  submit: id.leaveSubmit,
  approve: id.leaveApprove,
  reject: id.leaveReject,
  cancel: id.leaveCancel,
};
export function LeaveDetail({
  documentId,
  onClose,
  onChanged,
}: {
  documentId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { company, user, writable } = useWorkspace(),
    [revision, setRevision] = useState(0),
    [action, setAction] = useState<LeaveAction | null>(null),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const result = useCompanyResource<LeaveRequest>(
      `hr/leave-requests/${documentId}`,
      revision,
    ),
    row = result.data;
  async function execute() {
    if (!row || !action) return;
    setBusy(true);
    setError("");
    try {
      await api(
        `/companies/${company.id}/hr/leave-requests/${row.id}/actions`,
        {
          method: "POST",
          body: JSON.stringify({
            action,
            expectedUpdatedAt: row.updatedAt,
            note,
          }),
        },
      );
      setRevision((v) => v + 1);
      onChanged();
      setAction(null);
      toast.success(id.leaveUpdated);
    } catch (e) {
      setError(e instanceof Error ? e.message : id.error);
    } finally {
      setBusy(false);
    }
  }
  const facts = row
    ? [
        [id.employee, `${row.employeeName} · ${row.employeeCode}`],
        [id.branch, row.branchName],
        [id.department, row.departmentName],
        [id.leaveType, leaveTypeLabels[row.type]],
        [id.leavePeriod, `${date(row.fromDate)} – ${date(row.toDate)}`],
        [id.leaveDays, number(row.days)],
      ]
    : [];
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogTitle className="text-lg font-semibold">
          {row?.number || id.leaveRequest}
        </DialogTitle>
        <DialogDescription className="-mt-3 text-xs text-muted-foreground">
          {company.name} · {id.leavePendingHint}
        </DialogDescription>
        {result.loading || result.error ? (
          <HrLoading
            error={result.error}
            retry={() => setRevision((v) => v + 1)}
          />
        ) : (
          row && (
            <>
              <div className="flex items-center justify-between">
                <StatusBadge status={row.status} />
                <span className="text-[10px] text-muted-foreground">
                  {id.createdAt}: {date(row.createdAt)}
                </span>
              </div>
              <dl className="grid gap-4 border-y py-4 sm:grid-cols-2">
                {facts.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[11px] text-muted-foreground">
                      {label}
                    </dt>
                    <dd className="mt-1 text-xs font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
              <div>
                <h2 className="text-xs font-semibold">{id.leaveReason}</h2>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                  {row.reason}
                </p>
              </div>
              <section className="rounded-lg bg-muted p-4">
                <h2 className="mb-3 text-xs font-semibold">
                  {id.leaveHistory}
                </h2>
                <div className="space-y-2 text-[11px]">
                  <p>
                    {id.leaveCreator}: <strong>{row.creatorName}</strong>
                  </p>
                  {row.submittedAt && (
                    <p>
                      {id.leaveSubmittedAt}: {date(row.submittedAt, true)}
                    </p>
                  )}
                  {row.reviewedAt && (
                    <p>
                      {id.leaveReviewedBy}: <strong>{row.reviewerName}</strong>{" "}
                      · {date(row.reviewedAt, true)}
                    </p>
                  )}
                  {row.note && (
                    <p className="whitespace-pre-wrap">
                      {id.leaveNote}: {row.note}
                    </p>
                  )}
                </div>
              </section>
              <p className="text-[11px] text-muted-foreground">
                {id.leaveDaysHint}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {row.status === "DRAFT"
                  ? id.leaveDraftHint
                  : row.status === "PENDING"
                    ? row.createdBy === user.id
                      ? id.leaveSelfReview
                      : id.hrReviewerHint
                    : id.leaveFinalHint}
              </p>
              <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                <Button variant="outline" disabled={busy} onClick={onClose}>
                  {id.close}
                </Button>
                {writable &&
                  leaveActions(
                    row.status,
                    row.createdBy === user.id,
                    company.role === "ADMIN",
                  ).map((value) => (
                    <Button
                      variant={
                        value === "approve" || value === "submit"
                          ? "default"
                          : "outline"
                      }
                      key={value}
                      onClick={() => {
                        setAction(value);
                        setNote("");
                        setError("");
                      }}
                    >
                      {leaveActionLabels[value]}
                    </Button>
                  ))}
              </div>
            </>
          )
        )}
        <Dialog
          open={!!action}
          onOpenChange={(v) => {
            if (!v && !busy) setAction(null);
          }}
        >
          <DialogContent>
            <DialogTitle>
              {action ? leaveActionLabels[action] : id.confirm}
            </DialogTitle>
            <DialogDescription>{id.leaveConfirm}</DialogDescription>
            {row && (
              <p className="text-xs font-medium">
                {row.employeeName} · {date(row.fromDate)} – {date(row.toDate)}
              </p>
            )}
            {(action === "approve" || action === "reject") && (
              <label>
                <span className="field-label">
                  {id.leaveNote}
                  {action === "reject" ? " *" : ""}
                </span>
                <textarea
                  className="field min-h-20"
                  value={note}
                  maxLength={500}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={busy}
                />
              </label>
            )}
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setAction(null)}
              >
                {id.cancel}
              </Button>
              <Button
                disabled={
                  busy || (action === "reject" && note.trim().length < 5)
                }
                onClick={execute}
              >
                {busy && <Loader2 className="animate-spin" />}
                {id.confirm}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
