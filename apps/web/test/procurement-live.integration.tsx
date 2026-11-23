import { test } from "node:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { PrismaClient } from "@prisma/client";
import { WorkspaceProvider } from "../src/components/workspace-provider";
import { ProcurementPage } from "../src/components/procurement-page";
import { id } from "../src/lib/i18n";
async function json(path: string, method = "GET", body?: unknown) {
  let value: Awaited<ReturnType<Response["json"]>>;
  await act(async () => {
    const res = await fetch(`/api${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    value = await res.json();
    assert.ok(res.ok, `${method} ${path}: ${JSON.stringify(value)}`);
  });
  return value;
}
async function waitFor(check: () => boolean) {
  for (let i = 0; i < 180; i++) {
    if (check()) return;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40));
    });
  }
  throw new Error(
    `UI did not settle: ${document.body.textContent?.slice(-1500)}`,
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
  assert.ok(target, `Button ${name}`);
  await act(async () => target.click());
}
test("Procurement UI selects company records and completes Request→Approval→Order→Receipt→Invoice→Payment through real API", async () => {
  const prisma = new PrismaClient(),
    code = `QU${Date.now().toString(36).toUpperCase()}`;
  let companyId: string | undefined;
  const root = createRoot(document.getElementById("root")!);
  try {
    const user = await json("/auth/me");
    const company = await json("/companies", "POST", {
      code,
      name: "QA UI Procurement",
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
    await master("warehouses", "WH", { branchId: branch.id });
    await master("suppliers", "SUP");
    await master("items", "ITM", {
      unit: "pcs",
      purchasePrice: 125000,
      sellingPrice: 150000,
      trackStock: true,
      reorderLevel: 0,
    });
    localStorage.clear();
    localStorage.setItem(`enterprise-erp-active:${user.id}`, companyId!);
    await act(async () =>
      root.render(
        <WorkspaceProvider>
          <ProcurementPage slug="purchase-requests" />
        </WorkspaceProvider>,
      ),
    );
    await waitFor(
      () =>
        document.body.textContent?.includes("QA UI Procurement") === true &&
        !!button(id.createRequest) &&
        !button(id.createRequest).disabled,
    );
    await click(id.createRequest);
    await waitFor(() => !!dialog()?.querySelector("form"));
    for (const [label, name] of [
      ["Supplier", "QA SUP"],
      ["Warehouse", "QA WH"],
      ["Items", "QA ITM"],
    ]) {
      const choose = Array.from(
        dialog().querySelectorAll<HTMLButtonElement>('[role="combobox"]'),
      ).find((b) => b.textContent?.includes(`Pilih ${label}`));
      assert.ok(choose, `Select ${label}`);
      await act(async () => choose.click());
      await waitFor(
        () =>
          !!Array.from(dialog().querySelectorAll("button")).find((b) =>
            b.textContent?.includes(name),
          ),
      );
      const option = Array.from(
        dialog().querySelectorAll<HTMLButtonElement>("button"),
      ).find((b) => b.textContent?.includes(name))!;
      await act(async () => option.click());
    }
    await act(async () =>
      dialog()
        .querySelector("form")!
        .dispatchEvent(
          new window.Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    await waitFor(() => !!button(id.submitApproval, dialog()));
    assert.match(dialog().textContent || "", /125\.000/);
    await click(id.submitApproval, dialog());
    await click(id.confirm, dialog());
    await waitFor(() => !!button(id.approveDocument, dialog()));
    await click(id.approveDocument, dialog());
    await click(id.confirm, dialog());
    await waitFor(
      () => !!button(id.createDocument(id.purchaseOrder), dialog()),
    );
    await click(id.createDocument(id.purchaseOrder), dialog());
    await click(id.confirm, dialog());
    await waitFor(() => !!button(id.postDocument, dialog()));
    await click(id.postDocument, dialog());
    await click(id.confirm, dialog());
    await waitFor(
      () => !!button(id.createDocument(id.purchaseReceipt), dialog()),
    );
    assert.equal(
      (await json(`${path}/stock/balances`)).meta.total,
      0,
      "Order has no stock effect",
    );
    for (const name of [id.purchaseReceipt, id.purchaseInvoice, id.payment]) {
      await click(id.createDocument(name), dialog());
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
    const docs = await json(`${path}/procurement`);
    assert.equal(docs.meta.total, 5);
    assert.ok(
      docs.data.some(
        (d: { kind: string; status: string }) =>
          d.kind === "PAYMENT" && d.status === "POSTED",
      ),
    );
    assert.equal((await json(`${path}/stock/balances`)).data[0].quantity, 1);
    assert.equal((await json(`${path}/procurement/summary`)).outstanding, 0);
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
        await tx.purchaseLine.deleteMany({ where: { companyId } });
        for (const kind of [
          "PAYMENT",
          "PURCHASE_INVOICE",
          "PURCHASE_RECEIPT",
          "PURCHASE_ORDER",
          "PURCHASE_REQUEST",
        ] as const)
          await tx.purchaseDocument.deleteMany({ where: { companyId, kind } });
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
