"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import type { StockOperation } from "@erp/shared";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { id, stockOperationLabels } from "@/lib/i18n";
import { useCompanyResource } from "@/lib/company-resource";
import { date, money, number } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { Button } from "./ui/button";
import { StatusBadge } from "./ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
export function StockOperationDetail({
  documentId,
  onClose,
  onChanged,
}: {
  documentId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { company, writable } = useWorkspace();
  const [revision, setRevision] = useState(0),
    [action, setAction] = useState<"post" | "cancel" | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const result = useCompanyResource<StockOperation>(
      `stock/operations/${documentId}`,
      revision,
    ),
    doc = result.data;
  const canPost = doc?.kind === "TRANSFER" || company.role === "ADMIN";
  async function perform() {
    if (!doc || !action) return;
    setBusy(true);
    setError("");
    try {
      await api(`/companies/${company.id}/stock/operations/${doc.id}/actions`, {
        method: "POST",
        body: JSON.stringify({ action, expectedUpdatedAt: doc.updatedAt }),
      });
      setAction(null);
      setRevision((v) => v + 1);
      onChanged();
      toast.success(id.stockUpdated);
    } catch (e) {
      setError(e instanceof Error ? e.message : id.error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent className="max-w-3xl">
        <div>
          <DialogTitle className="text-lg font-semibold">
            {doc?.number || id.transactionDetail}
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs text-muted-foreground">
            {doc
              ? `${stockOperationLabels[doc.kind]} · ${company.name}`
              : id.loading}
          </DialogDescription>
        </div>
        {result.loading ? (
          <div className="empty-state !py-10">
            <Loader2 className="animate-spin" />
            <p>{id.loading}</p>
          </div>
        ) : result.error ? (
          <div role="alert">
            <p className="field-error">{result.error}</p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => setRevision((v) => v + 1)}
            >
              {id.retry}
            </Button>
          </div>
        ) : (
          doc && (
            <>
              <div className="flex items-center justify-between gap-3">
                <StatusBadge status={doc.status} />
                <span className="text-xs text-muted-foreground">
                  {date(doc.date)} · {doc.currency}
                </span>
              </div>
              <dl className="grid gap-4 rounded-lg border bg-muted/30 p-4 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">
                    {doc.kind === "TRANSFER" ? id.sourceWarehouse : "Warehouse"}
                  </dt>
                  <dd className="mt-1 font-medium">{doc.warehouseName}</dd>
                </div>
                {doc.targetWarehouseId && (
                  <div>
                    <dt className="text-muted-foreground">
                      {id.targetWarehouse}
                    </dt>
                    <dd className="mt-1 font-medium">
                      {doc.targetWarehouseName}
                    </dd>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">
                    {id.adjustmentReason}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap leading-relaxed">
                    {doc.description}
                  </dd>
                </div>
              </dl>
              <div className="table-scroll rounded-lg border">
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Items</th>
                      <th>
                        {doc.kind === "TRANSFER"
                          ? id.quantity
                          : id.adjustmentQuantity}
                      </th>
                      <th>{id.stockCost}</th>
                      <th>{id.stockValue}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doc.lines.map((line) => (
                      <tr key={line.id}>
                        <td>
                          <strong className="block text-xs font-medium">
                            {line.itemName}
                          </strong>
                          <span className="text-[10px] text-muted-foreground">
                            {line.itemCode}
                          </span>
                        </td>
                        <td
                          className={
                            line.quantity < 0
                              ? "text-red-700"
                              : "text-slate-700"
                          }
                        >
                          {doc.kind === "ADJUSTMENT" && line.quantity > 0
                            ? "+"
                            : ""}
                          {number(line.quantity)} {line.unit}
                        </td>
                        <td>
                          {doc.status === "DRAFT" &&
                          (doc.kind === "TRANSFER" || line.quantity < 0)
                            ? id.calculatedOnPost
                            : `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 6 }).format(line.unitPrice)} ${doc.currency}`}
                        </td>
                        <td className="whitespace-nowrap font-medium">
                          {line.value === null
                            ? "—"
                            : money(line.value, doc.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {id.stockCostHint}{" "}
                {doc.status === "DRAFT" ? id.stockDraftHint : id.stockDateHint}
              </p>
              {doc.kind === "ADJUSTMENT" &&
                !canPost &&
                doc.status === "DRAFT" && (
                  <div className="notice">{id.adjustmentAdminOnly}</div>
                )}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <Link
                  href="/stock-movement"
                  className="text-link"
                  onClick={onClose}
                >
                  {id.stockLedger}
                  <ArrowRight size={12} />
                </Link>
                {writable && doc.status === "DRAFT" && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAction("cancel");
                        setError("");
                      }}
                    >
                      {id.cancelDocument}
                    </Button>
                    {canPost && (
                      <Button
                        onClick={() => {
                          setAction("post");
                          setError("");
                        }}
                      >
                        {id.postDocument}
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {action && (
                <Dialog
                  open
                  onOpenChange={(v) => {
                    if (!v && !busy) setAction(null);
                  }}
                >
                  <DialogContent>
                    <DialogTitle className="font-semibold">
                      {action === "post" ? id.postDocument : id.cancelDocument}
                    </DialogTitle>
                    <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
                      {action === "post" ? id.stockPostHint : id.approvalHint}
                    </DialogDescription>
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
                      <Button disabled={busy} onClick={perform}>
                        {busy && <Loader2 className="animate-spin" />}
                        {id.confirm}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
