"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { rfqActionSchema, rfqOrderSchema, rfqToday, type PurchaseDocument, type RfqDetail } from "@erp/shared";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { id } from "@/lib/i18n";
import { exactMoney } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { DesignField, DesignFacts } from "./design/common";
const t = id.rfq;
export type RfqAction = "open" | "propose" | "approve" | "reject" | "cancel" | "order";
export function RfqActionForm({ record, action, offerId, onClose, onSaved, onOrder }: { record: RfqDetail; action: RfqAction; offerId?: string; onClose: () => void; onSaved: () => void; onOrder: (row: PurchaseDocument) => void }) {
  const { company, writable } = useWorkspace(), [error, setError] = useState(""), [requestKey] = useState(() => crypto.randomUUID());
  const offer = record.offers.find(value => value.id === (offerId || record.selectedOfferId));
  const form = useForm<{ reason: string; date: string; description: string }>({ defaultValues: { reason: "", date: rfqToday(), description: "" } }), busy = form.formState.isSubmitting;
  async function submit(values: { reason: string; date: string; description: string }) {
    setError("");
    const payload = action === "order" ? { requestKey, expectedUpdatedAt: record.updatedAt, date: values.date, description: values.description } : action === "open" ? { action, expectedUpdatedAt: record.updatedAt } : { action, expectedUpdatedAt: record.updatedAt, reason: values.reason, ...(action === "propose" ? { offerId } : {}) };
    const result = action === "order" ? rfqOrderSchema.safeParse(payload) : rfqActionSchema.safeParse(payload);
    if (!result.success) { for (const issue of result.error.issues) form.setError(issue.path[0] as "reason" | "date" | "description", { message: issue.message }); return; }
    try {
      const row = await api<PurchaseDocument>(`/companies/${company.id}/rfqs/${record.id}/${action === "order" ? "purchase-order" : "actions"}`, { method: "POST", body: JSON.stringify(result.data) });
      toast.success(action === "order" ? t.orderCreated : t.changed); if (action === "order") onOrder(row); else onSaved();
    } catch (error) { setError(error instanceof Error ? error.message : id.error); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent><DialogTitle>{t[action]}</DialogTitle><DialogDescription>{action === "order" ? t.orderHint : action === "cancel" ? t.cancelHint : t.confirmHint}</DialogDescription><form noValidate className="space-y-4" onSubmit={form.handleSubmit(submit)}><fieldset disabled={busy || !writable} className="space-y-4">{offer && <div className="rounded-lg border bg-muted/20 p-4"><DesignFacts items={[{ label: t.selected, value: offer.supplierName }, { label: id.total, value: exactMoney(offer.amount, record.currency) }, { label: t.budget, value: exactMoney(record.budget, record.currency) }, { label: t.validUntil, value: offer.validUntil }]} />{Number(offer.amount) > Number(record.budget) && <p className="mt-3 text-xs font-medium text-amber-800">{t.aboveBudget}</p>}</div>}{action !== "open" && action !== "order" && <DesignField name="rfq-reason" label={action === "propose" ? t.proposalReason : action === "approve" || action === "reject" ? t.reviewNote : t.reason} required error={form.formState.errors.reason?.message}><textarea id="rfq-reason" className="field min-h-24" minLength={5} maxLength={500} {...form.register("reason")} /></DesignField>}{action === "order" && <><DesignField name="rfq-order-date" label={id.date} required error={form.formState.errors.date?.message}><input id="rfq-order-date" className="field" type="date" min={record.date} max={offer?.validUntil} {...form.register("date")} /></DesignField><DesignField name="rfq-order-description" label={id.description}><textarea id="rfq-order-description" className="field min-h-20" maxLength={1000} {...form.register("description")} /></DesignField></>}</fieldset>{error && <p role="alert" className="field-error">{error}</p>}<div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{id.cancel}</Button><Button type="submit" disabled={busy || !writable}>{id.confirm}</Button></div></form></DialogContent></Dialog>;
}
