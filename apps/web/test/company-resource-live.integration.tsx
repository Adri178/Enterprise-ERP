import { test } from "node:test";
import assert from "node:assert/strict";
import { act, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { PageResult, PurchaseDocument } from "@erp/shared";
import {
  WorkspaceProvider,
  useWorkspace,
} from "../src/components/workspace-provider";
import { useCompanyResource } from "../src/lib/company-resource";
let companyId = "",
  enabled = true;
let resource: ReturnType<
  typeof useCompanyResource<PageResult<PurchaseDocument>>
>;
function Probe() {
  const context = useWorkspace(),
    [active, setActive] = useState(true);
  const result = useCompanyResource<PageResult<PurchaseDocument>>(
    "procurement?pageSize=5",
    0,
    active,
  );
  useEffect(() => {
    companyId = context.company.id;
    resource = result;
    enabled = active;
  }, [context.company.id, result, active]);
  return (
    <>
      <button onClick={() => context.switchCompany("alpha")}>Alpha</button>
      <button onClick={() => context.switchCompany("beta")}>Beta</button>
      <button onClick={() => setActive((v) => !v)}>Toggle</button>
      <output>{result.data?.data.map((row) => row.companyId).join(",")}</output>
    </>
  );
}
async function waitFor(check: () => boolean) {
  for (let i = 0; i < 120; i++) {
    if (check()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
  }
  throw new Error("Company resource did not settle");
}
test("Procurement resources hide obsolete company rows immediately and hide disabled search results", async () => {
  localStorage.clear();
  const host = document.getElementById("root")!,
    root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <WorkspaceProvider>
          <Probe />
        </WorkspaceProvider>,
      ),
    );
    await waitFor(() => companyId === "alpha" && !!resource?.data);
    assert.ok(resource.data!.data.every((row) => row.companyId === "alpha"));
    await act(async () => host.querySelectorAll("button")[1].click());
    assert.ok(
      !resource.data ||
        resource.data.data.every((row) => row.companyId === "beta"),
    );
    await waitFor(() => companyId === "beta" && !!resource.data);
    assert.ok(resource.data!.data.every((row) => row.companyId === "beta"));
    await act(async () => host.querySelectorAll("button")[2].click());
    assert.equal(enabled, false);
    assert.equal(resource.data, undefined);
    assert.equal(resource.loading, false);
    await act(async () => host.querySelectorAll("button")[0].click());
    assert.equal(companyId, "alpha");
    assert.equal(resource.data, undefined);
    await act(async () => host.querySelectorAll("button")[2].click());
    await waitFor(() => !!resource.data && !resource.loading);
    assert.ok(resource.data!.data.every((row) => row.companyId === "alpha"));
  } finally {
    await act(async () => root.unmount());
    localStorage.clear();
  }
});
