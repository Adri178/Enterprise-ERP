"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Pencil, Trash2 } from "lucide-react";
import { id } from "@/lib/i18n";
import { date, money, number } from "@/lib/utils";
import { demoItems, demoSuppliers, offerTotal, type Offer, type Rfq } from "@/lib/design/models";
import { useWorkspace } from "../workspace-provider";
import { Button } from "../ui/button";
import { DesignBadge, DesignDialog, DesignFacts } from "./common";
import { OfferForm } from "./rfq-form";

const d = id.design;
export function RfqBadge({ record }: { record: Rfq }) { return <DesignBadge tone={record.status === "SELECTED" ? "green" : record.status === "SENT" ? "amber" : record.status === "CANCELLED" ? "red" : "neutral"}>{d.rfqStatus[record.status]}</DesignBadge>; }
export function RfqDetail({ record, onClose, onEdit, onDelete, onCancel, onSend, onOffer, onSelect }: { record: Rfq; onClose: () => void; onEdit: () => void; onDelete: () => void; onCancel: () => void; onSend: () => void; onOffer: (input: Offer) => void; onSelect: (supplierId: string) => void }) {
  const { company, writable } = useWorkspace(), [offering, setOffering] = useState<string | null>(null), [choice, setChoice] = useState<string | null>(null);
  const minimum = Math.min(...record.offers.map(offer => offerTotal(record, offer)));
  return <DesignDialog title={record.title} description={`${record.number} · ${company.name}`} onClose={onClose} wide><div><RfqBadge record={record} /></div><DesignFacts items={[{ label: d.requestReference, value: record.requestReference }, { label: d.deadline, value: date(record.deadline) }, { label: id.description, value: record.description }]} /><section><h3 className="mb-3 text-sm font-semibold">{d.requirements}</h3><div className="table-scroll rounded-lg border"><table className="erp-table" aria-label={d.requirements}><thead><tr><th>{d.item}</th><th>{d.quantity}</th><th>{d.unit}</th></tr></thead><tbody>{record.lines.map(line => { const item = demoItems.find(item => item.id === line.itemId)!; return <tr key={line.itemId}><td>{item.code} · {item.name}</td><td>{number(line.quantity)}</td><td>{item.unit}</td></tr>; })}</tbody></table></div></section>
    <section><h3 className="mb-2 text-sm font-semibold">{d.offers}</h3><p className="mb-3 text-xs text-muted-foreground">{d.offerHint}</p><div className="table-scroll rounded-lg border"><table className="erp-table" aria-label={d.offers}><thead><tr><th>{d.suppliers}</th><th>{d.quotationReference}</th><th>{d.offerTotal}</th><th>{d.leadDays}</th><th>{id.actions}</th></tr></thead><tbody>{record.supplierIds.map(supplierId => {
      const supplier = demoSuppliers.find(supplier => supplier.id === supplierId)!, offer = record.offers.find(offer => offer.supplierId === supplierId), total = offer ? offerTotal(record, offer) : null;
      return <tr key={supplierId} className={record.selectedSupplierId === supplierId ? "bg-emerald-50/60" : ""}><td><span className="block">{supplier.name}</span>{record.selectedSupplierId === supplierId ? <span className="mt-1 inline-block text-xs font-semibold text-primary">{d.selected}</span> : total === minimum && <span className="mt-1 inline-block text-xs text-primary">{d.lowest}</span>}</td><td>{offer?.reference || d.awaitingOffer}</td><td className="tabular-nums">{total === null ? "—" : money(total, company.currency)}</td><td>{offer ? `${offer.leadDays} ${d.days}` : "—"}</td><td>{writable && record.status === "SENT" && <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => { setOffering(supplierId); setChoice(null); }}>{offer ? d.offerEdit : d.offerRecord}</Button>{offer && <Button variant="ghost" size="sm" onClick={() => { setChoice(supplierId); setOffering(null); }}>{d.selectSupplier}</Button>}</div>}</td></tr>;
    })}</tbody></table></div></section>
    {offering && record.status === "SENT" && writable && <OfferForm key={offering} rfq={record} supplierId={offering} currency={company.currency} onClose={() => setOffering(null)} onSave={input => { onOffer(input); setOffering(null); }} />}
    {choice && writable && record.status === "SENT" && <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"><h3 className="text-sm font-semibold">{d.selectConfirm}</h3><p className="mt-2 text-sm">{demoSuppliers.find(supplier => supplier.id === choice)?.name}</p><p className="mt-2 text-xs text-muted-foreground">{d.selectHint}</p><div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={() => setChoice(null)}>{id.cancel}</Button><Button onClick={() => { onSelect(choice); setChoice(null); }}>{id.confirm}</Button></div></section>}
    <div className="flex flex-wrap gap-2 border-t pt-4">{writable && record.status === "DRAFT" && <><Button variant="outline" onClick={onEdit}><Pencil />{d.edit}</Button><Button variant="ghost" onClick={onDelete}><Trash2 />{d.remove}</Button><Button onClick={onSend}>{d.rfqSend}</Button></>}{writable && ["DRAFT", "SENT"].includes(record.status) && <Button variant="outline" onClick={onCancel}>{d.rfqCancel}</Button>}{record.status === "SELECTED" && <Button variant="outline" asChild><Link href="/purchase-orders">{d.purchaseOrderLink}<ArrowRight /></Link></Button>}</div>
  </DesignDialog>;
}
