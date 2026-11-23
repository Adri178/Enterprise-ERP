"use client";
import { useState } from "react";
import {
  useFieldArray,
  useForm,
  useWatch,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  stockOperationSchema,
  type StockOperation,
  type StockOperationInput,
  type StockOperationKind,
  type PageResult,
  type StockBalanceRow,
} from "@erp/shared";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { id, stockOperationLabels } from "@/lib/i18n";
import { useCompanyResource } from "@/lib/company-resource";
import { number } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { RecordSelect } from "./record-select";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
function StockAvailable({
  warehouseId,
  itemId,
}: {
  warehouseId: string;
  itemId: string;
}) {
  const result = useCompanyResource<PageResult<StockBalanceRow>>(
    `stock/balances?warehouseId=${encodeURIComponent(warehouseId)}&itemId=${encodeURIComponent(itemId)}&pageSize=1`,
    0,
    !!warehouseId && !!itemId,
  );
  if (!warehouseId || !itemId) return null;
  return (
    <p
      className="mt-1 text-[10px] text-muted-foreground"
      role={result.error ? "alert" : "status"}
    >
      {result.error ||
        (result.loading
          ? id.loading
          : `${id.stockAvailable}: ${number(result.data?.data[0]?.quantity || 0)} ${result.data?.data[0]?.unit || ""}`)}
    </p>
  );
}
export function StockOperationForm({
  kind,
  onClose,
  onSaved,
}: {
  kind: StockOperationKind;
  onClose: () => void;
  onSaved: (doc: StockOperation) => void;
}) {
  const { company } = useWorkspace(),
    [labels, setLabels] = useState<Record<string, string>>({}),
    [error, setError] = useState("");
  const transfer = kind === "TRANSFER";
  const form = useForm<StockOperationInput>({
    resolver: zodResolver(
      stockOperationSchema,
    ) as Resolver<StockOperationInput>,
    defaultValues: {
      requestKey: crypto.randomUUID(),
      kind,
      date: new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Jakarta",
      }),
      warehouseId: "",
      targetWarehouseId: "",
      description: "",
      lines: [{ itemId: "", quantity: 1, unitPrice: 0 }],
    },
  });
  const array = useFieldArray({ control: form.control, name: "lines" }),
    values = useWatch({ control: form.control }),
    busy = form.formState.isSubmitting;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-w-4xl">
        <div>
          <DialogTitle className="text-lg font-semibold">
            {id.createDocument(stockOperationLabels[kind])}
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs text-muted-foreground">
            {company.name} ·{" "}
            {transfer ? id.stockTransferHint : id.stockAdjustmentHint}
          </DialogDescription>
        </div>
        <form
          className="space-y-5"
          onSubmit={form.handleSubmit(async (input) => {
            setError("");
            try {
              const result = await api<StockOperation>(
                `/companies/${company.id}/stock/operations`,
                { method: "POST", body: JSON.stringify(input) },
              );
              toast.success(id.stockCreated);
              onSaved(result);
            } catch (e) {
              setError(e instanceof Error ? e.message : id.error);
            }
          })}
        >
          <fieldset disabled={busy} className="space-y-5">
            <div
              className={`grid gap-4 ${transfer ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
            >
              <RecordSelect
                kind="warehouses"
                label={transfer ? id.sourceWarehouse : "Warehouse"}
                value={values.warehouseId || ""}
                selectedLabel={labels.source}
                error={form.formState.errors.warehouseId?.message}
                onChange={(r) => {
                  form.setValue("warehouseId", r.id, { shouldValidate: true });
                  setLabels((p) => ({ ...p, source: r.name }));
                }}
              />
              {transfer && (
                <RecordSelect
                  kind="warehouses"
                  label={id.targetWarehouse}
                  value={values.targetWarehouseId || ""}
                  selectedLabel={labels.target}
                  error={form.formState.errors.targetWarehouseId?.message}
                  onChange={(r) => {
                    form.setValue("targetWarehouseId", r.id, {
                      shouldValidate: true,
                    });
                    setLabels((p) => ({ ...p, target: r.name }));
                  }}
                />
              )}
              <label>
                <span className="field-label">{id.date} *</span>
                <input
                  type="date"
                  className="field"
                  {...form.register("date")}
                />
                <span className="field-error">
                  {form.formState.errors.date?.message}
                </span>
              </label>
            </div>
            <section className="rounded-lg border">
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
                {array.fields.map((field, index) => {
                  const quantityField = form.register(
                    `lines.${index}.quantity`,
                    { valueAsNumber: true },
                  );
                  const incoming =
                    !transfer && (values.lines?.[index]?.quantity || 0) > 0;
                  return (
                    <div
                      key={field.id}
                      className="grid items-start gap-3 border-b pb-3 last:border-0 last:pb-0 sm:grid-cols-[minmax(160px,2fr)_minmax(100px,1fr)_minmax(100px,1fr)_30px]"
                    >
                      <div>
                        <RecordSelect
                          kind="items"
                          label="Items"
                          stockOnly
                          value={values.lines?.[index]?.itemId || ""}
                          selectedLabel={labels[field.id]}
                          error={
                            form.formState.errors.lines?.[index]?.itemId
                              ?.message
                          }
                          onChange={(r) => {
                            form.setValue(`lines.${index}.itemId`, r.id, {
                              shouldValidate: true,
                            });
                            form.setValue(
                              `lines.${index}.unitPrice`,
                              incoming ? r.purchasePrice || 0 : 0,
                            );
                            setLabels((p) => ({
                              ...p,
                              [field.id]: `${r.code} · ${r.name}`,
                            }));
                          }}
                        />
                        <StockAvailable
                          warehouseId={values.warehouseId || ""}
                          itemId={values.lines?.[index]?.itemId || ""}
                        />
                      </div>
                      <label>
                        <span className="field-label">
                          {transfer ? id.quantity : id.adjustmentQuantity} *
                        </span>
                        <input
                          className="field"
                          type="number"
                          min={transfer ? 1 : -1000000}
                          max={1000000}
                          step={1}
                          {...quantityField}
                          onChange={(e) => {
                            void quantityField.onChange(e);
                            if (Number(e.target.value) <= 0)
                              form.setValue(`lines.${index}.unitPrice`, 0);
                          }}
                        />
                        <span className="field-error">
                          {
                            form.formState.errors.lines?.[index]?.quantity
                              ?.message
                          }
                        </span>
                      </label>
                      <div>
                        {incoming ? (
                          <label>
                            <span className="field-label">
                              {id.unitPrice} *
                            </span>
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
                          </label>
                        ) : (
                          <>
                            <span className="field-label">{id.stockCost}</span>
                            <p className="rounded-md bg-muted px-3 py-2.5 text-[11px] text-muted-foreground">
                              {id.calculatedOnPost}
                            </p>
                          </>
                        )}
                        <span className="field-error">
                          {
                            form.formState.errors.lines?.[index]?.unitPrice
                              ?.message
                          }
                        </span>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="sm:mt-6"
                        disabled={array.fields.length === 1}
                        aria-label={`${id.removeLine} ${index + 1}`}
                        onClick={() => array.remove(index)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  );
                })}
                <p className="field-error" role="alert">
                  {form.formState.errors.lines?.root?.message ||
                    form.formState.errors.lines?.message}
                </p>
              </div>
            </section>
            {!transfer && (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {id.adjustmentQuantityHint}
              </p>
            )}
            <label className="block">
              <span className="field-label">{id.adjustmentReason} *</span>
              <textarea
                className="field min-h-20 resize-y"
                maxLength={1000}
                {...form.register("description")}
              />
              <span className="field-error">
                {form.formState.errors.description?.message}
              </span>
            </label>
          </fieldset>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {id.stockDraftHint} {id.stockDateHint}
          </p>
          {error && (
            <p className="field-error" role="alert">
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
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {id.save}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
