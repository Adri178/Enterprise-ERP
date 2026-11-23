"use client";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { journalSchema, journalTotals, type Journal, type JournalInput, type JournalFormInput } from "@erp/shared";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { id } from "@/lib/i18n";
import { money } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { AccountSelect } from "./account-select";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
const emptyLine = () => ({ accountId: "", debit: 0, credit: 0, description: "" });
export function JournalForm({ record, onClose, onSaved }: { record?: Journal; onClose: () => void; onSaved: (journal: Journal) => void }) {
  const { company } = useWorkspace(), [error, setError] = useState(""), [labels, setLabels] = useState<Record<string, string>>(() => Object.fromEntries((record?.lines || []).map((l) => [l.accountId, `${l.accountCode} · ${l.accountName}`])));
  const form = useForm<JournalFormInput, unknown, JournalInput>({ resolver: zodResolver(journalSchema), defaultValues: { requestKey: crypto.randomUUID(), date: record?.date || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }), description: record?.description || "", reference: record?.reference || "", lines: record?.lines.map((l) => ({ accountId: l.accountId, debit: l.debit, credit: l.credit, description: l.description })) || [emptyLine(), emptyLine()] } });
  const fields = useFieldArray({ control: form.control, name: "lines" }), values = useWatch({ control: form.control });
  const totals = journalTotals((values.lines || []).map((l) => ({ debit: l.debit || 0, credit: l.credit || 0 }))), balanced = totals.debit > 0 && totals.debit === totals.credit, busy = form.formState.isSubmitting;
  return <Dialog open onOpenChange={(v) => { if (!v && !busy) onClose(); }}><DialogContent className="max-w-5xl"><DialogTitle className="text-lg font-semibold">{record ? id.editRecord(id.journalEntry) : id.createDocument(id.journalEntry)}</DialogTitle><DialogDescription className="-mt-3 text-xs text-muted-foreground">{company.name} · {id.journalDraftHint}</DialogDescription>
    <form className="space-y-5" onSubmit={form.handleSubmit(async (input) => { setError(""); try { const row = await api<Journal>(`/companies/${company.id}/accounting/journals${record ? `/${record.id}` : ""}`, { method: record ? "PATCH" : "POST", body: JSON.stringify({ ...input, ...(record ? { expectedUpdatedAt: record.updatedAt } : {}) }) }); toast.success(id.journalSaved); onSaved(row); } catch (e) { setError(e instanceof Error ? e.message : id.error); } })}>
      <fieldset className="space-y-5" disabled={busy}><div className="grid gap-4 sm:grid-cols-2"><label><span className="field-label">{id.date} *</span><input className="field" type="date" {...form.register("date")} /><span className="field-error">{form.formState.errors.date?.message}</span></label><label><span className="field-label">{id.journalReference}</span><input className="field" maxLength={100} {...form.register("reference")} /></label></div>
        <label className="block"><span className="field-label">{id.description} *</span><textarea className="field min-h-16" maxLength={1000} {...form.register("description")} /><span className="field-error">{form.formState.errors.description?.message}</span></label>
        <section className="border-t pt-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-xs font-semibold">{id.journalLines}</h2><Button type="button" size="sm" variant="outline" disabled={fields.fields.length >= 50} onClick={() => fields.append(emptyLine())}><Plus />{id.add}</Button></div>
          <div className="space-y-3">{fields.fields.map((field, index) => <div key={field.id} className="rounded-lg border p-3"><div className="grid items-end gap-3 md:grid-cols-[minmax(0,2fr)_1fr_1fr_auto]"><AccountSelect value={values.lines?.[index]?.accountId || ""} selectedLabel={labels[values.lines?.[index]?.accountId || ""]} error={form.formState.errors.lines?.[index]?.accountId?.message} onChange={(r) => { form.setValue(`lines.${index}.accountId`, r.id, { shouldValidate: true }); setLabels((v) => ({ ...v, [r.id]: `${r.code} · ${r.name}` })); }} />
            {(["debit", "credit"] as const).map((side) => <label key={side}><span className="field-label">{side === "debit" ? id.debit : id.credit}</span><input className="field text-right" aria-label={`${side === "debit" ? id.debit : id.credit} ${index + 1}`} type="number" min={0} max={1e12} step="0.01" {...form.register(`lines.${index}.${side}`, { valueAsNumber: true, onChange: (e) => { if (Number(e.target.value) > 0) form.setValue(`lines.${index}.${side === "debit" ? "credit" : "debit"}`, 0); } })} /></label>)}
            <Button variant="ghost" size="icon" type="button" disabled={fields.fields.length <= 2} aria-label={`${id.delete} ${index + 1}`} onClick={() => fields.remove(index)}><Trash2 /></Button>
          </div><input className="field mt-3 !text-[11px]" aria-label={`${id.journalRowDescription} ${index + 1}`} placeholder={id.journalRowDescription} maxLength={200} {...form.register(`lines.${index}.description`)} /><p className="field-error">{form.formState.errors.lines?.[index]?.debit?.message || form.formState.errors.lines?.[index]?.credit?.message}</p></div>)}</div>
          <p className="field-error mt-2" role={form.formState.errors.lines ? "alert" : undefined}>{form.formState.errors.lines?.root?.message || form.formState.errors.lines?.message}</p><p className="mt-2 text-[11px] text-muted-foreground">{id.journalLineHint}</p>
        </section>
      </fieldset>
      <div className="grid gap-3 rounded-lg bg-muted p-4 sm:grid-cols-3" aria-live="polite">{[[id.totalDebit, totals.debit], [id.totalCredit, totals.credit], [id.journalDifference, totals.debit - totals.credit]].map(([label, cents]) => <div key={String(label)}><span className="text-[10px] text-muted-foreground">{label}</span><strong className="mt-1 block text-sm">{money(Number(cents) / 100, company.currency)}</strong></div>)}<span className={`text-[11px] font-medium sm:col-span-3 ${balanced ? "text-primary" : "text-amber-700"}`}>{balanced ? id.journalBalanced : id.journalUnbalanced}</span></div>
      <p className="text-[11px] text-muted-foreground">{id.journalReferenceHint}</p>{error && <p className="field-error" role="alert">{error}</p>}<div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{id.cancel}</Button><Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}{record ? id.saveChanges : id.save}</Button></div>
    </form>
  </DialogContent></Dialog>;
}
