"use client";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { accountSchema, accountTypes, type Account, type AccountInput, type AccountFormInput } from "@erp/shared";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { id, accountTypeLabels } from "@/lib/i18n";
import { useWorkspace } from "./workspace-provider";
import { AccountSelect } from "./account-select";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
export function AccountForm({ record, onClose, onSaved }: { record?: Account; onClose: () => void; onSaved: () => void }) {
  const { company, writable } = useWorkspace(), [error, setError] = useState(""), [parentName, setParentName] = useState(record?.parentName ? `${record.parentCode} · ${record.parentName}` : "");
  const form = useForm<AccountFormInput, unknown, AccountInput>({ resolver: zodResolver(accountSchema), defaultValues: { code: "", name: "", type: "ASSET", isGroup: false, parentId: "", status: "ACTIVE", ...record } });
  const type = useWatch({ control: form.control, name: "type" }), parentId = useWatch({ control: form.control, name: "parentId" }), group = useWatch({ control: form.control, name: "isGroup" }), busy = form.formState.isSubmitting;
  return <Dialog open onOpenChange={(v) => { if (!v && !busy) onClose(); }}><DialogContent><DialogTitle className="text-lg font-semibold">{record ? writable ? id.editRecord(id.account) : `${id.recordInfo} ${id.account}` : id.addRecord(id.account)}</DialogTitle><DialogDescription className="-mt-3 text-xs text-muted-foreground">{company.name} · {id.accountStructureHint}</DialogDescription>
    <form className="space-y-4" onSubmit={form.handleSubmit(async (values) => { setError(""); try { await api(`/companies/${company.id}/accounting/accounts${record ? `/${record.id}` : ""}`, { method: record ? "PATCH" : "POST", body: JSON.stringify({ ...values, ...(record ? { expectedUpdatedAt: record.updatedAt } : {}) }) }); toast.success(id.accountSaved); onSaved(); } catch (e) { setError(e instanceof Error ? e.message : id.error); } })}>
      <fieldset disabled={!writable || busy} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><label><span className="field-label">{id.accountCode} *</span><input className="field" readOnly={!!record} {...form.register("code")} /><span className="field-error">{form.formState.errors.code?.message}</span></label><label><span className="field-label">{id.status}</span><select className="field" {...form.register("status")}><option value="ACTIVE">{id.active}</option><option value="INACTIVE">{id.inactive}</option></select></label></div>
        <label className="block"><span className="field-label">{id.accountName} *</span><input className="field" {...form.register("name")} /><span className="field-error">{form.formState.errors.name?.message}</span></label>
        <label className="block"><span className="field-label">{id.accountType}</span><select className="field" value={type} disabled={!!record} onChange={(e) => { form.setValue("type", e.target.value as AccountInput["type"]); form.setValue("parentId", ""); setParentName(""); }}>{accountTypes.map((t) => <option key={t} value={t}>{accountTypeLabels[t]}</option>)}</select></label>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={group} disabled={!!record} onChange={(e) => form.setValue("isGroup", e.target.checked)} />{id.accountGroup}</label>
        <AccountSelect key={type} label={id.accountParent} value={parentId} selectedLabel={parentName || (group && !parentId ? id.accountRoot : "")} groupOnly type={type} disabled={!!record} required={!group} error={form.formState.errors.parentId?.message} onChange={(r) => { form.setValue("parentId", r.id, { shouldValidate: true }); setParentName(`${r.code} · ${r.name}`); }} />
        {group && !record && parentId && <Button type="button" size="sm" variant="ghost" onClick={() => { form.setValue("parentId", ""); setParentName(""); }}>{id.accountRoot}</Button>}<p className="text-[11px] text-muted-foreground">{id.accountParentHint}</p>
      </fieldset>{error && <p role="alert" className="field-error">{error}</p>}<div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{writable ? id.cancel : id.close}</Button>{writable && <Button disabled={busy} type="submit">{busy && <Loader2 className="animate-spin" />}{record ? id.saveChanges : id.save}</Button>}</div>
    </form>
  </DialogContent></Dialog>;
}
