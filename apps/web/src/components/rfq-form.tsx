"use client";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { rfqCreateSchema, rfqToday, type RfqCreate, type RfqEntry, type PurchaseDocument } from "@erp/shared";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useCompanyResource } from "@/lib/company-resource";
import { id } from "@/lib/i18n";
import { money, number } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { PurchaseRequestSelect } from "./purchase-request-select";
import { RecordSelect } from "./record-select";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { DesignField, DesignFacts } from "./design/common";
const t = id.rfq;
export function RfqForm({ sourceId = "", onClose, onSaved }: { sourceId?: string; onClose: () => void; onSaved: (row: RfqEntry) => void }) {
  const { company, writable } = useWorkspace(), [error, setError] = useState(""), [chosen, setChosen] = useState<PurchaseDocument | null>(null), [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const initial = useCompanyResource<PurchaseDocument>(`procurement/${sourceId}`, 0, !!sourceId), source = chosen || initial.data;
  const form = useForm<RfqCreate>({ defaultValues: { requestKey: crypto.randomUUID(), sourceId, date: rfqToday(), deadline: rfqToday(), supplierIds: [], description: "" } });
  const currentSource = useWatch({ control: form.control, name: "sourceId" }), busy = form.formState.isSubmitting;
  async function submit(values: RfqCreate) {
    setError(""); const result = rfqCreateSchema.safeParse(values);
    if (!result.success) { for (const issue of result.error.issues) form.setError(issue.path[0] as keyof RfqCreate, { message: issue.message }); return; }
    try { const row = await api<RfqEntry>(`/companies/${company.id}/rfqs`, { method: "POST", body: JSON.stringify(result.data) }); toast.success(t.saved); onSaved(row); } catch (error) { setError(error instanceof Error ? error.message : id.error); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="max-w-3xl"><DialogTitle>{t.add}</DialogTitle><DialogDescription>{company.name} · {t.sourceHint}</DialogDescription><form noValidate className="space-y-4" onSubmit={form.handleSubmit(submit)}><fieldset disabled={busy || !writable} className="space-y-4"><PurchaseRequestSelect value={currentSource} label={source?.number} error={form.formState.errors.sourceId?.message} onChange={row => { setChosen(row); form.setValue("sourceId", row.id); form.clearErrors("sourceId"); }} />{initial.error && !chosen && <p role="alert" className="field-error">{initial.error}</p>}{source && <div className="space-y-4 rounded-lg border bg-muted/20 p-4"><DesignFacts items={[{ label: t.referenceSupplier, value: source.supplierName }, { label: t.warehouse, value: source.warehouseName }, { label: t.budget, value: money(source.amount, source.currency) }]} /><ul className="space-y-1 text-xs text-muted-foreground">{source.lines.map(line => <li key={line.id}>{line.itemName} · {number(line.quantity)} {line.unit}</li>)}</ul></div>}<div className="grid gap-4 sm:grid-cols-2"><DesignField name="rfq-date" label={id.date} required error={form.formState.errors.date?.message}><input id="rfq-date" className="field" type="date" min={source?.date} {...form.register("date")} /></DesignField><DesignField name="rfq-deadline" label={t.deadline} required error={form.formState.errors.deadline?.message}><input id="rfq-deadline" className="field" type="date" {...form.register("deadline")} /></DesignField></div><div><RecordSelect kind="suppliers" label={t.addSupplier} value="" required={false} onChange={supplier => { if (!suppliers.some(value => value.id === supplier.id) && suppliers.length < 10) { const next = [...suppliers, { id: supplier.id, name: supplier.name }]; setSuppliers(next); form.setValue("supplierIds", next.map(value => value.id)); form.clearErrors("supplierIds"); } }} /><p className="mt-2 text-xs text-muted-foreground">{t.supplierHint}</p><div className="mt-3 flex flex-wrap gap-2">{suppliers.map(supplier => <Button key={supplier.id} type="button" variant="outline" size="sm" aria-label={`${t.removeSupplier}: ${supplier.name}`} onClick={() => { const next = suppliers.filter(value => value.id !== supplier.id); setSuppliers(next); form.setValue("supplierIds", next.map(value => value.id)); }}>{supplier.name} ×</Button>)}</div>{form.formState.errors.supplierIds && <p role="alert" className="field-error">{form.formState.errors.supplierIds.message}</p>}</div><DesignField name="rfq-description" label={id.description}><textarea id="rfq-description" className="field min-h-20" maxLength={1000} {...form.register("description")} /></DesignField></fieldset>{error && <p role="alert" className="field-error">{error}</p>}<div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{id.cancel}</Button><Button type="submit" disabled={busy || !writable}>{id.save}</Button></div></form></DialogContent></Dialog>;
}
