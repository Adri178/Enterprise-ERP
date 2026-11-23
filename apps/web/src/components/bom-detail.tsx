"use client";
import { useState } from "react";
import type { Bom } from "@erp/shared";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useCompanyResource } from "@/lib/company-resource";
import { id } from "@/lib/i18n";
import { number } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { BomForm } from "./bom-form";
import { ResourceState } from "./list-state";
import { StatusBadge } from "./ui/badge";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
export function BomDetail({ documentId, onClose, onChanged }: { documentId: string; onClose: () => void; onChanged: () => void }) {
  const { company, writable } = useWorkspace(), [revision, setRevision] = useState(0), [editing, setEditing] = useState(false), [action, setAction] = useState<"activate" | "retire" | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const result = useCompanyResource<Bom>(`manufacturing/boms/${documentId}`, revision), row = result.data;
  const changed = () => { setRevision((v) => v + 1); onChanged(); };
  return <Dialog open onOpenChange={(v) => { if (!v && !busy) onClose(); }}><DialogContent className="max-w-3xl"><DialogTitle className="text-lg font-semibold">{row ? `${row.code} · ${row.name}` : id.bom}</DialogTitle><DialogDescription className="-mt-3 text-xs text-muted-foreground">{company.name} · {id.bomScope}</DialogDescription>{result.loading || result.error ? <ResourceState error={result.error} retry={changed} /> : row && <><div><StatusBadge status={row.status} /><p className="mt-4 text-xs"><span className="text-muted-foreground">{id.productionOutput}: </span><strong>{number(row.outputQuantity)} {row.outputUnit} · {row.outputCode} · {row.outputName}</strong></p></div><p className="whitespace-pre-wrap text-xs text-muted-foreground">{row.description}</p><div className="table-scroll"><table className="erp-table"><thead><tr><th>{id.materials}</th><th>{id.materialQuantity}</th><th>{id.unit}</th></tr></thead><tbody>{row.lines.map((l) => <tr key={l.id}><td>{l.itemCode} · {l.itemName}</td><td>{number(l.quantity)}</td><td>{l.unit}</td></tr>)}</tbody></table></div><div className="flex flex-wrap justify-end gap-2 border-t pt-4"><Button variant="outline" onClick={onClose}>{id.close}</Button>{writable && row.status === "DRAFT" && <><Button variant="outline" onClick={() => setEditing(true)}>{id.edit}</Button><Button onClick={() => { setAction("activate"); setError(""); }}>{id.bomActivate}</Button></>}{writable && row.status === "ACTIVE" && <Button variant="outline" onClick={() => { setAction("retire"); setError(""); }}>{id.bomRetire}</Button>}</div></>}{editing && row && <BomForm record={row} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); changed(); }} />}<Dialog open={!!action} onOpenChange={(v) => { if (!v && !busy) setAction(null); }}><DialogContent><DialogTitle>{action === "activate" ? id.bomActivate : id.bomRetire}</DialogTitle><DialogDescription>{action === "activate" ? id.bomActivateHint : id.bomRetireHint}</DialogDescription>{error && <p className="field-error" role="alert">{error}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setAction(null)}>{id.cancel}</Button><Button disabled={busy} onClick={async () => { if (!row) return; setBusy(true); setError(""); try { await api(`/companies/${company.id}/manufacturing/boms/${row.id}/actions`, { method: "POST", body: JSON.stringify({ action, expectedUpdatedAt: row.updatedAt }) }); setAction(null); changed(); toast.success(id.bomUpdated); } catch (e) { setError(e instanceof Error ? e.message : id.error); } finally { setBusy(false); } }}>{busy && <Loader2 className="animate-spin" />}{id.confirm}</Button></div></DialogContent></Dialog></DialogContent></Dialog>;
}
