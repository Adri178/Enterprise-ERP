"use client";
import { useState } from "react";
import {
  useFieldArray,
  useForm,
  useWatch,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { tradeDraftSchema, type TradeDraftInput } from "@erp/shared";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { id } from "@/lib/i18n";
import { money } from "@/lib/utils";
import { tradeSpec, type TradeDomain } from "@/lib/trade-ui";
import { useWorkspace } from "./workspace-provider";
import { RecordSelect } from "./record-select";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
export function TradeForm({
  domain = "procurement",
  onClose,
  onSaved,
}: {
  onClose: () => void;
  domain?: TradeDomain;
  onSaved: (doc: { id: string }) => void;
}) {
  const { company } = useWorkspace();
  const spec = tradeSpec(domain);
  const [labels, setLabels] = useState<Record<string, string>>({}),
    [error, setError] = useState("");
  const form = useForm<TradeDraftInput>({
    resolver: zodResolver(tradeDraftSchema) as Resolver<TradeDraftInput>,
    defaultValues: {
      requestKey: crypto.randomUUID(),
      date: new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Jakarta",
      }),
      partyId: "",
      warehouseId: "",
      description: "",
      lines: [{ itemId: "", quantity: 1, unitPrice: 0 }],
    },
  });
  const array = useFieldArray({ control: form.control, name: "lines" });
  const values = useWatch({ control: form.control });
  const total = (values.lines || []).reduce(
    (sum, l) => sum + (l.quantity || 0) * (l.unitPrice || 0),
    0,
  );
  const busy = form.formState.isSubmitting;
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent className="max-w-4xl">
        <div>
          <DialogTitle className="text-lg font-semibold">
            {spec.create}
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs text-muted-foreground">
            {spec.formHint} · {company.name}
          </DialogDescription>
        </div>
        <form
          onSubmit={form.handleSubmit(async (input) => {
            setError("");
            try {
              const { partyId, ...draft } = input;
              const doc = await api<{ id: string }>(
                `/companies/${company.id}/${domain}/${domain === "sales" ? "quotations" : "requests"}`,
                {
                  method: "POST",
                  body: JSON.stringify({
                    ...draft,
                    [domain === "sales" ? "customerId" : "supplierId"]: partyId,
                  }),
                },
              );
              toast.success(spec.saved);
              onSaved(doc);
            } catch (e) {
              setError(e instanceof Error ? e.message : id.error);
            }
          })}
          className="space-y-5"
        >
          <fieldset disabled={busy} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <RecordSelect
                kind={domain === "sales" ? "customers" : "suppliers"}
                label={spec.party}
                value={values.partyId || ""}
                selectedLabel={labels.party}
                error={form.formState.errors.partyId?.message}
                onChange={(r) => {
                  form.setValue("partyId", r.id, { shouldValidate: true });
                  setLabels((p) => ({ ...p, party: r.name }));
                }}
              />
              <RecordSelect
                kind="warehouses"
                label="Warehouse"
                value={values.warehouseId || ""}
                selectedLabel={labels.warehouse}
                error={form.formState.errors.warehouseId?.message}
                onChange={(r) => {
                  form.setValue("warehouseId", r.id, { shouldValidate: true });
                  setLabels((p) => ({ ...p, warehouse: r.name }));
                }}
              />
              <label>
                <span className="field-label">{id.date} *</span>
                <input
                  className="field"
                  type="date"
                  {...form.register("date")}
                />
                <span className="field-error">
                  {form.formState.errors.date?.message}
                </span>
              </label>
            </div>
            <div className="rounded-lg border">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="section-heading">{id.documentItems}</h3>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={array.fields.length >= 50}
                  onClick={() =>
                    array.append({ itemId: "", quantity: 1, unitPrice: 0 })
                  }
                >
                  <Plus />
                  {id.addLine}
                </Button>
              </div>
              <div className="space-y-3 p-4">
                {array.fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="grid items-start gap-3 border-b pb-3 last:border-0 last:pb-0 sm:grid-cols-[minmax(160px,2fr)_80px_minmax(100px,1fr)_30px]"
                  >
                    <RecordSelect
                      kind="items"
                      label="Items"
                      stockOnly
                      value={values.lines?.[index]?.itemId || ""}
                      selectedLabel={labels[field.id]}
                      error={
                        form.formState.errors.lines?.[index]?.itemId?.message
                      }
                      onChange={(r) => {
                        form.setValue(`lines.${index}.itemId`, r.id, {
                          shouldValidate: true,
                        });
                        form.setValue(
                          `lines.${index}.unitPrice`,
                          (domain === "sales"
                            ? r.sellingPrice
                            : r.purchasePrice) || 0,
                        );
                        setLabels((p) => ({
                          ...p,
                          [field.id]: `${r.code} · ${r.name}`,
                        }));
                      }}
                    />
                    <label>
                      <span className="field-label">{id.quantity} *</span>
                      <input
                        className="field"
                        type="number"
                        min={1}
                        max={1000000}
                        step={1}
                        {...form.register(`lines.${index}.quantity`, {
                          valueAsNumber: true,
                        })}
                      />
                      <span className="field-error">
                        {
                          form.formState.errors.lines?.[index]?.quantity
                            ?.message
                        }
                      </span>
                    </label>
                    <label>
                      <span className="field-label">{id.unitPrice} *</span>
                      <input
                        className="field"
                        type="number"
                        min="0.01"
                        max="10000000000"
                        step="0.01"
                        {...form.register(`lines.${index}.unitPrice`, {
                          valueAsNumber: true,
                        })}
                      />
                      <span className="field-error">
                        {
                          form.formState.errors.lines?.[index]?.unitPrice
                            ?.message
                        }
                      </span>
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="sm:mt-6"
                      aria-label={`${id.removeLine} ${index + 1}`}
                      disabled={array.fields.length === 1}
                      onClick={() => array.remove(index)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
                <p className="field-error" role="alert">
                  {form.formState.errors.lines?.root?.message ||
                    form.formState.errors.lines?.message}
                </p>
              </div>
              <div className="flex justify-end gap-6 border-t bg-muted/40 px-4 py-3 text-sm">
                <span className="text-muted-foreground">{id.total}</span>
                <strong>{money(total, company.currency)}</strong>
              </div>
            </div>
            <label className="block">
              <span className="field-label">{id.description}</span>
              <textarea
                className="field min-h-20 resize-y"
                maxLength={1000}
                {...form.register("description")}
              />
            </label>
          </fieldset>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {spec.scope}
          </p>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              {id.cancel}
            </Button>
            <Button disabled={busy} type="submit">
              {busy && <Loader2 className="animate-spin" />}
              {id.save}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
