"use client";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { workOrderSchema, type WorkOrderInput, type WorkOrder, type Bom } from "@erp/shared";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { id } from "@/lib/i18n";
import { number } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { RecordSelect } from "./record-select";
import { BomSelect } from "./bom-select";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
export function WorkOrderForm({ onClose, onSaved }: { onClose: () => void; onSaved: (row: WorkOrder) => void }) {
  const { company } = useWorkspace(), [bom, setBom] = useState<Bom | null>(null), [warehouseLabel, setWarehouseLabel] = useState(""), [error, setError] = useState("");
  const form = useForm<WorkOrderInput>({ resolver: zodResolver(workOrderSchema), defaultValues: { requestKey: crypto.randomUUID(), date: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }), bomId: "", warehouseId: "", batches: 1, description: "" } });
  const values = useWatch({ control: form.control }), batches = values.batches || 0, busy = form.formState.isSubmitting;
  const overflow = !!bom && [bom.outputQuantity, ...bom.lines.map((l) => l.quantity)].some((q) => q * batches > 1000000);
  return <Dialog open onOpenChange={(v) => { if (!v && !busy) onClose(); }}><DialogContent className="max-w-3xl"><DialogTitle className="text-lg font-semibold">{id.createDocument(id.workOrder)}</DialogTitle><DialogDescription className="-mt-3 text-xs text-muted-foreground">{company.name} · {id.workOrderScope}</DialogDescription><form className="space-y-5" onSubmit={form.handleSubmit(async (input) => { setError(""); try { const row = await api<WorkOrder>(`/companies/${company.id}/manufacturing/work-orders`, { method: "POST", body: JSON.stringify(input) }); toast.success(id.workOrderSaved); onSaved(row); } catch (e) { setError(e instanceof Error ? e.message : id.error); } })}><fieldset disabled={busy} className="space-y-4"><BomSelect value={values.bomId || ""} selectedLabel={bom ? `${bom.code} · ${bom.name}` : ""} onChange={(b) => { setBom(b); form.setValue("bomId", b.id, { shouldValidate: true }); }} error={form.formState.errors.bomId?.message} /><div className="grid gap-4 sm:grid-cols-2"><label><span className="field-label">{id.batches} *</span><input className="field" type="number" min={1} max={1000000} step={1} {...form.register("batches", { valueAsNumber: true })} /><span className="field-error">{form.formState.errors.batches?.message}</span></label><label><span className="field-label">{id.productionDate} *</span><input className="field" type="date" {...form.register("date")} /><span className="field-error">{form.formState.errors.date?.message}</span></label></div><RecordSelect kind="warehouses" label={id.productionWarehouse} value={values.warehouseId || ""} selectedLabel={warehouseLabel} onChange={(r) => { form.setValue("warehouseId", r.id, { shouldValidate: true }); setWarehouseLabel(r.name); }} error={form.formState.errors.warehouseId?.message} /><label className="block"><span className="field-label">{id.description}</span><textarea className="field min-h-16" maxLength={1000} {...form.register("description")} /></label></fieldset>
    {bom && <section className="rounded-lg border bg-muted/30 p-4"><p className="mb-3 text-xs"><span className="text-muted-foreground">{id.productionOutput}: </span><strong>{number(bom.outputQuantity * batches)} {bom.outputUnit} · {bom.outputName}</strong></p><div className="table-scroll"><table className="erp-table"><thead><tr><th>{id.materials}</th><th>{id.productionRequired}</th><th>{id.unit}</th></tr></thead><tbody>{bom.lines.map((l) => <tr key={l.id}><td>{l.itemCode} · {l.itemName}</td><td>{number(l.quantity * batches)}</td><td>{l.unit}</td></tr>)}</tbody></table></div></section>}
    {overflow && <p className="field-error" role="alert">{id.productionQuantityLimit}</p>}{error && <p className="field-error" role="alert">{error}</p>}<div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{id.cancel}</Button><Button type="submit" disabled={busy || overflow}>{busy && <Loader2 className="animate-spin" />}{id.save}</Button></div></form></DialogContent></Dialog>;
}
