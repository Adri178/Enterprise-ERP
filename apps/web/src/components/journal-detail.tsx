"use client";
import { useState } from "react";
import Link from "next/link";
import type { Journal } from "@erp/shared";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { id } from "@/lib/i18n";
import { useCompanyResource } from "@/lib/company-resource";
import { date, money } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { ResourceState } from "./list-state";
import { JournalForm } from "./journal-form";
import { Button } from "./ui/button";
import { StatusBadge } from "./ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
export function JournalDetail({ documentId, onClose, onChanged }: { documentId: string; onClose: () => void; onChanged: () => void }) {
  const { company, writable } = useWorkspace(), [current, setCurrent] = useState(documentId), [revision, setRevision] = useState(0), [editing, setEditing] = useState(false), [action, setAction] = useState<"post" | "cancel" | "reverse" | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [reversalDate, setReversalDate] = useState(""), [reason, setReason] = useState(""), [requestKey, setRequestKey] = useState("");
  const result = useCompanyResource<Journal>(`accounting/journals/${current}`, revision), row = result.data;
  const changed = () => { setRevision((v) => v + 1); onChanged(); };
  async function execute() {
    if (!row || !action) return; setBusy(true); setError("");
    try { const saved = await api<Journal>(`/companies/${company.id}/accounting/journals/${row.id}/${action === "reverse" ? "reversal" : "actions"}`, { method: "POST", body: JSON.stringify(action === "reverse" ? { requestKey, date: reversalDate, description: reason, expectedUpdatedAt: row.updatedAt } : { action, expectedUpdatedAt: row.updatedAt }) });
      setCurrent(saved.id); setAction(null); changed(); toast.success(id.journalUpdated);
    } catch (e) { setError(e instanceof Error ? e.message : id.error); } finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={(v) => { if (!v && !busy) onClose(); }}><DialogContent className="max-w-4xl"><DialogTitle className="text-lg font-semibold">{row?.number || id.journalEntry}</DialogTitle><DialogDescription className="-mt-3 text-xs text-muted-foreground">{company.name} · {id.journalScope}</DialogDescription>
    {result.loading || result.error ? <ResourceState error={result.error} retry={() => setRevision((v) => v + 1)} /> : row && <>
      <div className="flex flex-wrap items-center gap-2"><StatusBadge status={row.status} />{row.reversedBy && <span className="rounded-md bg-indigo-50 px-2 py-1 text-[11px] text-indigo-700">{id.journalReversed}</span>}{row.reversalOf && <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-600">{id.journalReversal}</span>}</div>
      <dl className="grid gap-4 border-y py-4 sm:grid-cols-3">{[[id.date, date(row.date)], [id.journalReference, row.reference || "—"], [id.amount, money(row.amount, row.currency)], [id.journalCreatedBy, row.creatorName], [id.journalPostedBy, row.posterName || "—"], [id.journalPostedAt, row.postedAt ? date(row.postedAt) : "—"]].map(([label, value]) => <div key={label}><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="mt-1 text-xs font-medium">{value}</dd></div>)}</dl>
      <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{row.description}</p>
      <p className="text-[11px] text-muted-foreground">{id.autoJournalOrigin}: <strong>{row.origin === "OPENING" ? id.autoOpeningOrigin : row.origin === "OPERATIONAL" ? id.autoOperationalOrigin : id.autoManualOrigin}</strong>{row.origin && row.origin !== "MANUAL" && <> · <Link className="text-link" href="/automatic-accounting">{id.automaticAccounting}</Link><span className="mt-2 block">{id.autoManualProtected}</span></>}</p>
      <div className="table-scroll"><table className="erp-table"><thead><tr><th>{id.account}</th><th>{id.description}</th><th>{id.debit}</th><th>{id.credit}</th></tr></thead><tbody>{row.lines.map((line) => <tr key={line.id}><td><Link className="text-link whitespace-nowrap" href={`/general-ledger?accountId=${line.accountId}&from=${row.date}&to=${row.date}`}>{line.accountCode} · {line.accountName}</Link></td><td>{line.description || "—"}</td><td className="whitespace-nowrap">{money(line.debit, row.currency)}</td><td className="whitespace-nowrap">{money(line.credit, row.currency)}</td></tr>)}</tbody><tfoot><tr className="font-semibold"><td colSpan={2}>{id.journalBalanced}</td><td>{money(row.amount, row.currency)}</td><td>{money(row.amount, row.currency)}</td></tr></tfoot></table></div>
      {row.reversalOf && <p className="text-xs">{id.journalOriginal}: <button className="text-link" onClick={() => setCurrent(row.reversalOf!.id)}>{row.reversalOf.number}</button></p>}{row.reversedBy && <p className="text-xs">{id.journalReversal}: <button className="text-link" onClick={() => setCurrent(row.reversedBy!.id)}>{row.reversedBy.number}</button> · {date(row.reversedBy.date)}</p>}
      <p className="text-[11px] text-muted-foreground">{row.origin && row.origin !== "MANUAL" ? id.autoManualProtected : row.status === "DRAFT" ? id.journalDraftHint : id.journalPostHint}</p>
      <div className="flex flex-wrap justify-end gap-2 border-t pt-4"><Button variant="outline" onClick={onClose}>{id.close}</Button>{writable && row.status === "DRAFT" && <><Button variant="outline" onClick={() => setEditing(true)}>{id.edit}</Button><Button variant="outline" onClick={() => { setAction("cancel"); setError(""); }}>{id.journalCancel}</Button><Button onClick={() => { setAction("post"); setError(""); }}>{id.journalPost}</Button></>}{writable && company.role === "ADMIN" && (!row.origin || row.origin === "MANUAL") && row.status === "POSTED" && !row.reversalOf && !row.reversedBy && <Button variant="outline" onClick={() => { setRequestKey(crypto.randomUUID()); setReversalDate([row.date, new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })].sort().at(-1)!); setReason(""); setError(""); setAction("reverse"); }}>{id.journalReverse}</Button>}</div>
    </>}
    {editing && row && <JournalForm record={row} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); changed(); }} />}
    <Dialog open={!!action} onOpenChange={(v) => { if (!v && !busy) setAction(null); }}><DialogContent><DialogTitle>{action === "reverse" ? id.journalReverse : action === "post" ? id.journalPost : id.journalCancel}</DialogTitle><DialogDescription>{action === "reverse" ? id.journalReverseHint : action === "cancel" ? id.journalCancelHint : id.journalPostHint}</DialogDescription>{action === "reverse" && <><label><span className="field-label">{id.journalReverseDate} *</span><input className="field" type="date" value={reversalDate} onChange={(e) => setReversalDate(e.target.value)} disabled={busy} /></label><label><span className="field-label">{id.journalReverseReason} *</span><textarea className="field min-h-20" value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} disabled={busy} /></label></>}{error && <p className="field-error" role="alert">{error}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setAction(null)}>{id.cancel}</Button><Button disabled={busy || (action === "reverse" && (!reversalDate || reason.trim().length < 5))} onClick={execute}>{busy && <Loader2 className="animate-spin" />}{id.confirm}</Button></div></DialogContent></Dialog>
  </DialogContent></Dialog>;
}
