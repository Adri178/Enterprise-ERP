import { test } from "node:test";
import assert from "node:assert/strict";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { PrismaClient } from "@prisma/client";
import { WorkspaceProvider } from "../src/components/workspace-provider";
import { StockOperationsPage } from "../src/components/stock-operations-page";
import { id } from "../src/lib/i18n";
async function json(path: string, method = "GET", body?: unknown) {
  let result: Awaited<ReturnType<Response["json"]>>;
  await act(async () => {
    const response = await fetch(`/api${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    result = await response.json();
    assert.ok(response.ok, `${method} ${path}: ${JSON.stringify(result)}`);
  });
  return result;
}
async function waitFor(check: () => boolean) {
  for (let i = 0; i < 180; i++) {
    if (check()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
  }
  throw new Error(
    `Inventory UI did not settle: ${document.body.textContent?.slice(-1400)}`,
  );
}
const dialog = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).at(-1)!;
function button(name: string, parent: ParentNode = document) {
  return Array.from(parent.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => b.textContent?.trim() === name,
  )!;
}
async function click(name: string, parent?: ParentNode) {
  const target = button(name, parent);
  assert.ok(target, name);
  await act(async () => target.click());
}
async function fill(selector: string, value: string) {
  const input = dialog().querySelector<HTMLInputElement | HTMLTextAreaElement>(
    selector,
  )!;
  assert.ok(input, selector);
  await act(async () => {
    const prototype =
      input instanceof HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(
      input,
      value,
    );
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
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
function Probe() {
  const [kind, setKind] = useState<"TRANSFER" | "ADJUSTMENT">("ADJUSTMENT");
  return (
    <>
      <button onClick={() => setKind("TRANSFER")}>{id.stockTransfer}</button>
      <button onClick={() => setKind("ADJUSTMENT")}>
        {id.stockAdjustment}
      </button>
      <StockOperationsPage key={kind} kind={kind} />
    </>
  );
}
test("Inventory UI creates and posts additions, Transfer, and negative Adjustment with real ledger/balances", async () => {
  const prisma = new PrismaClient(),
    code = `QV${Date.now().toString(36).toUpperCase()}`,
    root = createRoot(document.getElementById("root")!);
  let companyId: string | undefined;
  try {
    const user = await json("/auth/me"),
      company = await json("/companies", "POST", {
        code,
        name: "QA UI Inventory",
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
    const branch = await master("branches", "BR", { city: "Jakarta" });
    const source = await master("warehouses", "WH-A", { branchId: branch.id }),
      target = await master("warehouses", "WH-B", { branchId: branch.id });
    await master("items", "ITM", {
      unit: "pcs",
      purchasePrice: 10.25,
      sellingPrice: 20,
      trackStock: true,
      reorderLevel: 0,
    });
    localStorage.clear();
    localStorage.setItem(`enterprise-erp-active:${user.id}`, companyId!);
    await act(async () =>
      root.render(
        <WorkspaceProvider>
          <Probe />
        </WorkspaceProvider>,
      ),
    );
    await waitFor(
      () =>
        !!button(id.createDocument(id.stockAdjustment)) &&
        !button(id.createDocument(id.stockAdjustment)).disabled,
    );
    async function postForm() {
      await act(async () => {
        dialog()
          .querySelector("form")!
          .dispatchEvent(
            new window.Event("submit", { bubbles: true, cancelable: true }),
          );
      });
      await waitFor(() => !!button(id.postDocument, dialog()));
      await click(id.postDocument, dialog());
      await click(id.confirm, dialog());
      await waitFor(
        () =>
          dialog().textContent?.includes(id.posted) === true &&
          !button(id.postDocument, dialog()),
      );
      await click(id.close, dialog());
    }
    await click(id.createDocument(id.stockAdjustment));
    await select("Warehouse", "QA WH-A");
    await select("Items", "QA ITM");
    await fill('input[name="lines.0.quantity"]', "3");
    await fill('textarea[name="description"]', "Saldo awal pengujian");
    await postForm();
    let balances = (await json(`${path}/stock/balances`)).data;
    assert.equal(balances[0].quantity, 3);
    assert.equal(balances[0].value, 30.75);
    await click(id.stockTransfer);
    await click(id.createDocument(id.stockTransfer));
    await select(id.sourceWarehouse, "QA WH-A");
    await select(id.targetWarehouse, "QA WH-B");
    await select("Items", "QA ITM");
    await waitFor(
      () => dialog().textContent?.includes(`${id.stockAvailable}: 3`) === true,
    );
    await fill('textarea[name="description"]', "Pemindahan antar-Warehouse");
    await postForm();
    balances = (await json(`${path}/stock/balances`)).data;
    assert.equal(
      balances.find((r: { warehouseId: string }) => r.warehouseId === source.id)
        .quantity,
      2,
    );
    assert.equal(
      balances.find((r: { warehouseId: string }) => r.warehouseId === target.id)
        .quantity,
      1,
    );
    await click(id.stockAdjustment);
    await click(id.createDocument(id.stockAdjustment));
    await select("Warehouse", "QA WH-A");
    await select("Items", "QA ITM");
    await fill('input[name="lines.0.quantity"]', "-1");
    assert.ok(dialog().textContent?.includes(id.calculatedOnPost));
    assert.equal(
      dialog().querySelector('input[name="lines.0.unitPrice"]'),
      null,
    );
    await fill('textarea[name="description"]', "Koreksi hasil hitung fisik");
    await postForm();
    balances = (await json(`${path}/stock/balances`)).data;
    assert.equal(
      balances.find((r: { warehouseId: string }) => r.warehouseId === source.id)
        .quantity,
      1,
    );
    const ledger = await json(`${path}/stock/ledger`);
    assert.equal(ledger.meta.total, 4);
    assert.ok(ledger.data.some((r: { quantity: number }) => r.quantity < 0));
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
