import { test } from "node:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { PrismaClient } from "@prisma/client";
import { WorkspaceProvider } from "../src/components/workspace-provider";
import { SalesPage } from "../src/components/sales-page";
import { PaymentsPage } from "../src/components/payments-page";
import { id } from "../src/lib/i18n";
async function json(path: string, method = "GET", body?: unknown) {
  let data: Awaited<ReturnType<Response["json"]>>;
  await act(async () => {
    const response = await fetch(`/api${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    data = await response.json();
    assert.ok(response.ok, `${method} ${path}: ${JSON.stringify(data)}`);
  });
  return data;
}
async function waitFor(check: () => boolean) {
  for (let i = 0; i < 180; i++) {
    if (check()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
  }
  throw new Error(
    `Sales UI did not settle: ${document.body.textContent?.slice(-1400)}`,
  );
}
const dialog = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).at(-1)!;
const button = (name: string, parent: ParentNode = document) =>
  Array.from(parent.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => b.textContent?.trim() === name,
  )!;
async function click(name: string, parent?: ParentNode) {
  const target = button(name, parent);
  assert.ok(target, name);
  await act(async () => target.click());
}
async function select(label: string, name: string) {
  const trigger = Array.from(
    dialog().querySelectorAll<HTMLButtonElement>('[role="combobox"]'),
  ).find((b) => b.textContent?.includes(`Pilih ${label}`));
  assert.ok(trigger, label);
  await act(async () => trigger.click());
  await waitFor(
    () =>
      !!Array.from(dialog().querySelectorAll("button")).find((b) =>
        b.textContent?.includes(name),
      ),
  );
  await act(async () =>
    Array.from(dialog().querySelectorAll<HTMLButtonElement>("button"))
      .find((b) => b.textContent?.includes(name))!
      .click(),
  );
}
test("Sales UI completes Quotation→Order→Delivery→Invoice→Payment and separates incoming/outgoing Payments", async () => {
  const prisma = new PrismaClient(),
    code = `QW${Date.now().toString(36).toUpperCase()}`,
    root = createRoot(document.getElementById("root")!);
  let companyId: string | undefined;
  try {
    const user = await json("/auth/me"),
      company = await json("/companies", "POST", {
        code,
        name: "QA UI Sales",
        industry: "Pengujian",
        city: "Jakarta",
        currency: "IDR",
        status: "ACTIVE",
        address: "",
        email: "",
        phone: "",
        taxId: "",
      });
    companyId = company.id;
    const path = `/companies/${companyId}`;
    const master = (kind: string, code: string, extra = {}) =>
      json(`${path}/master/${kind}`, "POST", {
        code,
        name: `QA ${code}`,
        category: "Operasional",
        status: "ACTIVE",
        email: "",
        phone: "",
        description: "",
        ...extra,
      });
    const branch = await master("branches", "BR", { city: "Jakarta" }),
      warehouse = await master("warehouses", "WH", { branchId: branch.id });
    await master("customers", "CUS", { creditLimit: 0 });
    const item = await master("items", "ITM", {
      unit: "pcs",
      purchasePrice: 50000,
      sellingPrice: 125000,
      trackStock: true,
      reorderLevel: 0,
    });
    const stock = await json(`${path}/stock/operations`, "POST", {
      requestKey: crypto.randomUUID(),
      kind: "ADJUSTMENT",
      date: "2026-10-21",
      warehouseId: warehouse.id,
      targetWarehouseId: "",
      description: "Stock awal QA Sales",
      lines: [{ itemId: item.id, quantity: 2, unitPrice: 50000 }],
    });
    await json(`${path}/stock/operations/${stock.id}/actions`, "POST", {
      action: "post",
      expectedUpdatedAt: stock.updatedAt,
    });
    localStorage.clear();
    localStorage.setItem(`enterprise-erp-active:${user.id}`, companyId!);
    await act(async () =>
      root.render(
        <WorkspaceProvider>
          <SalesPage slug="quotations" />
        </WorkspaceProvider>,
      ),
    );
    await waitFor(
      () =>
        !!button(id.createQuotation) && !button(id.createQuotation).disabled,
    );
    await click(id.createQuotation);
    await select(id.customer, "QA CUS");
    await select("Warehouse", "QA WH");
    await select("Items", "QA ITM");
    await act(async () => {
      dialog()
        .querySelector("form")!
        .dispatchEvent(
          new window.Event("submit", { bubbles: true, cancelable: true }),
        );
    });
    await waitFor(() => !!button(id.postDocument, dialog()));
    assert.match(dialog().textContent || "", /125\.000/);
    await click(id.postDocument, dialog());
    await click(id.confirm, dialog());
    await waitFor(() => !!button(id.createDocument(id.salesOrder), dialog()));
    assert.equal(
      (await json(`${path}/stock/balances`)).data[0].quantity,
      2,
      "Quotation does not reserve/deplete Stock",
    );
    for (const stage of [
      id.salesOrder,
      id.deliveryNote,
      id.salesInvoice,
      id.payment,
    ]) {
      await click(id.createDocument(stage), dialog());
      await click(id.confirm, dialog());
      await waitFor(() => !!button(id.postDocument, dialog()));
      await click(id.postDocument, dialog());
      await click(id.confirm, dialog());
      await waitFor(
        () =>
          dialog().textContent?.includes(id.posted) === true &&
          !button(id.postDocument, dialog()),
      );
    }
    await click(id.close, dialog());
    const summary = await json(`${path}/sales/summary`);
    assert.equal(summary.sales, 125000);
    assert.equal(summary.outstanding, 0);
    assert.equal(summary.deliveredValue, 50000);
    const balance = (await json(`${path}/stock/balances`)).data[0];
    assert.equal(balance.quantity, 1);
    assert.equal(balance.value, 50000);
    await act(async () =>
      root.render(
        <WorkspaceProvider>
          <PaymentsPage />
        </WorkspaceProvider>,
      ),
    );
    await click(id.paymentIncoming);
    await waitFor(
      () => !!document.querySelector("tbody")?.textContent?.includes("RCV-"),
    );
    assert.ok(document.querySelector("tbody")?.textContent?.includes("QA CUS"));
    await click(id.paymentOutgoing);
    await waitFor(() => !!document.body.textContent?.includes(id.requestEmpty));
    assert.equal(
      document.querySelector("tbody")?.textContent?.includes("RCV-") || false,
      false,
    );
  } finally {
    await act(async () => root.unmount());
    localStorage.clear();
    if (companyId) {
      assert.equal(
        (await prisma.company.findUnique({ where: { id: companyId } }))?.code,
        code,
      );
      await prisma.$transaction(async (tx) => {
        await tx.stockLedger.deleteMany({ where: { companyId } });
        await tx.stockBalance.deleteMany({ where: { companyId } });
        await tx.salesLine.deleteMany({ where: { companyId } });
        for (const kind of [
          "PAYMENT",
          "SALES_INVOICE",
          "DELIVERY_NOTE",
          "SALES_ORDER",
          "QUOTATION",
        ] as const)
          await tx.salesDocument.deleteMany({ where: { companyId, kind } });
        await tx.stockOperationLine.deleteMany({ where: { companyId } });
        await tx.stockOperation.deleteMany({ where: { companyId } });
        await tx.documentSequence.deleteMany({ where: { companyId } });
        await tx.masterRecord.deleteMany({
          where: { companyId, kind: "warehouses" },
        });
        await tx.masterRecord.deleteMany({ where: { companyId } });
        await tx.auditLog.deleteMany({ where: { companyId } });
        await tx.membership.deleteMany({ where: { companyId } });
        await tx.company.delete({ where: { id: companyId } });
      });
    }
    await prisma.$disconnect();
  }
});
