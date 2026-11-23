"use client";
import { useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { rfqOfferSchema, rfqToday, type RfqDetail, type RfqOffer, type RfqOfferInput } from "@erp/shared";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { id } from "@/lib/i18n";
import { number } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { DesignField } from "./design/common";
const t = id.rfq;
export function RfqOfferForm({ record, supplierId, offer, onClose, onSaved }: { record: RfqDetail; supplierId: string; offer?: RfqOffer; onClose: () => void; onSaved: () => void }) {
  const { company, writable } = useWorkspace(), [error, setError] = useState("");
  const form = useForm<RfqOfferInput>({ defaultValues: { expectedUpdatedAt: record.updatedAt, supplierId, reference: offer?.reference || "", date: offer?.date || rfqToday(), validUntil: offer?.validUntil || record.deadline, deliveryDays: offer?.deliveryDays || 0, description: offer?.description || "", lines: record.source.lines.map(line => ({ itemId: line.itemId, unitPrice: Number(offer?.lines.find(value => value.itemId === line.itemId)?.unitPrice || line.unitPrice) })) } });
  const busy = form.formState.isSubmitting;
  async function submit(values: RfqOfferInput) {
    setError(""); const result = rfqOfferSchema.safeParse(values);
    if (!result.success) { for (const issue of result.error.issues) form.setError(issue.path.join(".") as FieldPath<RfqOfferInput>, { message: issue.message }); return; }
    try { await api(`/companies/${company.id}/rfqs/${record.id}/offers`, { method: "POST", body: JSON.stringify(result.data) }); toast.success(t.offerSaved); onSaved(); } catch (error) { setError(error instanceof Error ? error.message : id.error); }
  }
  const errors = form.formState.errors;
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="max-w-3xl"><DialogTitle>{offer ? t.editOffer : t.recordOffer}</DialogTitle><DialogDescription>{record.suppliers.find(value => value.supplierId === supplierId)?.supplierName} · {record.currency} · {t.offerHint}</DialogDescription><form noValidate className="space-y-4" onSubmit={form.handleSubmit(submit)}><fieldset disabled={busy || !writable} className="space-y-4"><DesignField name="rfq-offer-ref" label={t.supplierQuote} required error={errors.reference?.message}><input id="rfq-offer-ref" className="field" maxLength={100} {...form.register("reference")} /></DesignField><div className="grid gap-4 sm:grid-cols-3"><DesignField name="rfq-offer-date" label={t.offerDate} required error={errors.date?.message}><input id="rfq-offer-date" className="field" type="date" min={record.date} max={record.deadline < rfqToday() ? record.deadline : rfqToday()} {...form.register("date")} /></DesignField><DesignField name="rfq-offer-until" label={t.validUntil} required error={errors.validUntil?.message}><input id="rfq-offer-until" className="field" type="date" {...form.register("validUntil")} /></DesignField><DesignField name="rfq-offer-delivery" label={t.deliveryDays} required error={errors.deliveryDays?.message}><input id="rfq-offer-delivery" className="field" type="number" min={0} max={3650} step={1} {...form.register("deliveryDays", { valueAsNumber: true })} /></DesignField></div><div className="space-y-3 rounded-lg border p-4">{record.source.lines.map((line, index) => <div className="grid items-end gap-3 sm:grid-cols-[1fr_180px]" key={line.itemId}><div className="text-sm"><strong className="block font-medium">{line.itemName}</strong><span className="text-xs text-muted-foreground">{line.itemCode} · {number(line.quantity)} {line.unit}</span></div><DesignField name={`rfq-price-${index}`} label={`${id.unitPrice} · ${line.itemCode}`} required error={errors.lines?.[index]?.unitPrice?.message}><input id={`rfq-price-${index}`} className="field" type="number" min={0.01} max={1e10} step="0.01" {...form.register(`lines.${index}.unitPrice`, { valueAsNumber: true })} /></DesignField></div>)}</div>{errors.lines?.message && <p role="alert" className="field-error">{errors.lines.message}</p>}<DesignField name="rfq-offer-description" label={id.description}><textarea id="rfq-offer-description" className="field min-h-20" maxLength={1000} {...form.register("description")} /></DesignField></fieldset>{error && <p role="alert" className="field-error">{error}</p>}<div className="flex justify-end gap-2 border-t pt-4"><Button variant="outline" type="button" disabled={busy} onClick={onClose}>{id.cancel}</Button><Button disabled={busy || !writable} type="submit">{t.saveOffer}</Button></div></form></DialogContent></Dialog>;
}
