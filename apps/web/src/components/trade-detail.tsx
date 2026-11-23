"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import {
  type PurchaseAction,
  type PurchaseDocument,
  type SalesDocument,
} from "@erp/shared";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useCompanyResource } from "@/lib/company-resource";
import { id } from "@/lib/i18n";
import {
  tradeSpec,
  tradeNext,
  tradeActions,
  toTradeDocument,
  type TradeDomain,
} from "@/lib/trade-ui";
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
export const tradeActionLabels: Record<PurchaseAction, string> = {
  submit: id.submitApproval,
  approve: id.approveDocument,
  reject: id.rejectDocument,
  post: id.postDocument,
  cancel: id.cancelDocument,
};
export function TradeDetail({
  domain = "procurement",
  documentId,
  onClose,
  onChanged,
}: {
  domain?: TradeDomain;
  documentId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { company, writable } = useWorkspace();
  const spec = tradeSpec(domain);
  const [currentId, setCurrentId] = useState(documentId),
    [revision, setRevision] = useState(0);
  const result = useCompanyResource<PurchaseDocument | SalesDocument>(
    `${domain}/${currentId}`,
    revision,
  );
  const [action, setAction] = useState<PurchaseAction | "next" | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [nextDate, setNextDate] = useState(
      new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }),
    ),
    [requestKey, setRequestKey] = useState("");
  const doc = result.data ? toTradeDocument(result.data) : undefined;
  const nextKind = doc && tradeNext(domain, doc.kind);
  const nextAvailable =
    doc &&
    nextKind &&
    (doc.status === "APPROVED" || doc.status === "POSTED") &&
    !doc.successors.some(
      (s) => s.kind === nextKind && s.status !== "CANCELLED",
    ) && !(domain === "procurement" && doc.kind === "PURCHASE_REQUEST" && doc.rfqs?.some(rfq => !["REJECTED", "CANCELLED"].includes(rfq.status)));
  async function perform() {
    if (!doc || !action) return;
    setBusy(true);
    setError("");
    try {
      const next = await api<PurchaseDocument | SalesDocument>(
        `/companies/${company.id}/${domain}/${action === "next" ? "from-source" : `${doc.id}/actions`}`,
        {
          method: "POST",
          body: JSON.stringify(
            action === "next"
              ? {
                  sourceId: doc.id,
                  kind: nextKind,
                  date: nextDate,
                  requestKey,
                  description: "",
                }
              : { action, expectedUpdatedAt: doc.updatedAt },
          ),
        },
      );
      setCurrentId(next.id);
      setRevision((v) => v + 1);
      setAction(null);
      onChanged();
      toast.success(
        action === "next" ? id.documentCreated : id.documentUpdated,
      );
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
            {doc ? `${spec.labels[doc.kind]} · ${company.name}` : id.loading}
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
              className="mt-3"
              variant="outline"
              onClick={() => setRevision((v) => v + 1)}
            >
              {id.retry}
            </Button>
          </div>
        ) : (
          doc && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <StatusBadge status={doc.status} />
                <span className="text-xs text-muted-foreground">
                  {date(doc.date)} · {doc.currency}
                </span>
              </div>
              <dl className="grid gap-4 rounded-lg border bg-muted/30 p-4 text-xs sm:grid-cols-2">
                {domain === "procurement" && (doc.rfqId || !!doc.rfqs?.length) && <div className="sm:col-span-2"><dt className="text-muted-foreground">{id.rfq.sourceRfq}</dt><dd className="mt-2 flex flex-wrap gap-2">{doc.rfqId && <Link className="text-link" href={`/requests-for-quotation?document=${encodeURIComponent(doc.rfqId)}`}>{doc.rfqNumber}</Link>}{doc.rfqs?.map(rfq => <Link className="text-link" key={rfq.id} href={`/requests-for-quotation?document=${encodeURIComponent(rfq.id)}`}>{rfq.number}</Link>)}</dd></div>}
                <div>
                  <dt className="text-muted-foreground">{spec.party}</dt>
                  <dd className="mt-1 font-medium">{doc.partyName}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Warehouse</dt>
                  <dd className="mt-1 font-medium">{doc.warehouseName}</dd>
                </div>
                {doc.sourceId && (
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">
                      {id.sourceDocument}
                    </dt>
                    <dd className="mt-1">
                      <button
                        className="text-link"
                        onClick={() => {
                          setCurrentId(doc.sourceId!);
                          setAction(null);
                          setError("");
                        }}
                      >
                        {doc.sourceNumber}
                        <ArrowRight size={12} />
                      </button>
                    </dd>
                  </div>
                )}
              </dl>
              {!!doc.lines.length && (
                <div className="table-scroll rounded-lg border">
                  <table className="erp-table">
                    <thead>
                      <tr>
                        <th>Items</th>
                        <th>{id.quantity}</th>
                        <th>{id.unitPrice}</th>
                        <th>{id.subtotal}</th>
                        {doc.kind === "DELIVERY_NOTE" && (
                          <th>{id.deliveredStockValue}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {doc.lines.map((line) => (
                        <tr key={line.id}>
                          <td>
                            <span className="block font-medium">
                              {line.itemName}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {line.itemCode}
                            </span>
                          </td>
                          <td>
                            {number(line.quantity)} {line.unit}
                          </td>
                          <td>{money(line.unitPrice, doc.currency)}</td>
                          <td className="whitespace-nowrap font-medium">
                            {money(line.amount, doc.currency)}
                          </td>
                          {doc.kind === "DELIVERY_NOTE" && (
                            <td className="whitespace-nowrap">
                              {line.stockCost == null
                                ? id.calculatedOnPost
                                : money(line.stockCost, doc.currency)}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex justify-end gap-6 text-sm">
                <span className="text-muted-foreground">{id.total}</span>
                <strong>{money(doc.amount, doc.currency)}</strong>
              </div>
              {doc.description && (
                <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                  {doc.description}
                </p>
              )}
              <div className="border-t pt-4">
                <h3 className="mb-2 text-xs font-medium">{id.nextDocuments}</h3>
                <div className="flex flex-wrap gap-2">
                  {doc.successors.map((s) => (
                    <button
                      key={s.id}
                      className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs hover:bg-muted"
                      onClick={() => {
                        setCurrentId(s.id);
                        setAction(null);
                        setError("");
                      }}
                    >
                      <span>{s.number}</span>
                      <StatusBadge status={s.status} />
                    </button>
                  ))}
                  {!doc.successors.length && (
                    <p className="text-xs text-muted-foreground">
                      {id.noSuccessors}
                    </p>
                  )}
                </div>
              </div>
              {writable && (
                <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                  {domain === "procurement" && doc.kind === "PURCHASE_REQUEST" && nextAvailable && <Button asChild variant="outline"><Link href={`/requests-for-quotation?sourceId=${encodeURIComponent(doc.id)}`}>{id.rfq.add}</Link></Button>}
                  {tradeActions(domain, doc).map((key) => (
                    <Button
                      key={key}
                      variant={
                        key === "cancel" || key === "reject"
                          ? "outline"
                          : "default"
                      }
                      onClick={() => {
                        setAction(key);
                        setError("");
                      }}
                    >
                      {tradeActionLabels[key]}
                    </Button>
                  ))}
                  {nextAvailable && (
                    <Button
                      onClick={() => {
                        setAction("next");
                        setRequestKey(crypto.randomUUID());
                        setNextDate(
                          new Date(
                            Math.max(Date.now(), new Date(doc.date).getTime()),
                          ).toLocaleDateString("en-CA", {
                            timeZone: "Asia/Jakarta",
                          }),
                        );
                        setError("");
                      }}
                    >
                      <ArrowRight />
                      {id.createDocument(spec.labels[nextKind!])}
                    </Button>
                  )}
                </div>
              )}
              {action && (
                <Dialog
                  open
                  onOpenChange={(v) => {
                    if (!v && !busy) setAction(null);
                  }}
                >
                  <DialogContent>
                    <DialogTitle className="font-semibold">
                      {action === "next"
                        ? id.createDocument(spec.labels[nextKind!])
                        : tradeActionLabels[action]}
                    </DialogTitle>
                    <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
                      {action === "next"
                        ? id.nextDocumentHint
                        : action === "post"
                          ? spec.postHint
                          : id.approvalHint}
                    </DialogDescription>
                    {action === "next" && (
                      <label>
                        <span className="field-label">{id.date} *</span>
                        <input
                          className="field"
                          type="date"
                          min={doc.date}
                          value={nextDate}
                          onChange={(e) => setNextDate(e.target.value)}
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
                          busy ||
                          (action === "next" &&
                            (!nextDate || nextDate < doc.date))
                        }
                        onClick={perform}
                      >
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
