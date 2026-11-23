import { test } from "node:test";
import assert from "node:assert/strict";
import { act, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  WorkspaceProvider,
  useWorkspace,
} from "../src/components/workspace-provider";
import { useCatalogList } from "../src/lib/catalog-hooks";
import { apiUrl } from "../src/lib/api";
let context: ReturnType<typeof useWorkspace>;
let result: ReturnType<typeof useCatalogList>;
let search: (query: string) => void;
function Probe() {
  const current = useWorkspace();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const catalog = useCatalogList("suppliers", {
    q: query,
    page,
    pageSize: 2,
    sort: "name",
    direction: "asc",
  });
  useEffect(() => {
    context = current;
    result = catalog;
    search = (value) => {
      setQuery(value);
      setPage(1);
    };
  }, [current, catalog]);
  return (
    <>
      <h1>{current.company.name}</h1>
      <button onClick={() => current.switchCompany("beta")}>Beta</button>
      <button onClick={() => current.switchCompany("alpha")}>Alpha</button>
      <button onClick={() => current.switchCompany("gamma")}>Gamma</button>
      <button onClick={() => setPage((value) => value + 1)}>Next</button>
      <output>{catalog.data.map((row) => row.companyId).join(",")}</output>
    </>
  );
}
async function waitFor(predicate: () => boolean) {
  for (let i = 0; i < 120; i++) {
    if (predicate()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  }
  throw new Error("Live UI state did not settle");
}
test("live React context and catalog use real JWT/API data with pagination, company switching and persisted edits", async () => {
  localStorage.clear();
  const host = document.getElementById("root")!;
  const root = createRoot(host);
  const code = `QA-LIVE-${Date.now()}`;
  let createdId: string | undefined;
  try {
    await act(async () => {
      root.render(
        <WorkspaceProvider>
          <Probe />
        </WorkspaceProvider>,
      );
    });
    await waitFor(
      () => !!context?.user.id && !context.loading && !result.loading,
    );
    assert.equal(context.company.id, "alpha");
    assert.equal(result.data.length, 2);
    assert.ok(result.data.every((row) => row.companyId === "alpha"));
    const firstIds = result.data.map((row) => row.id);
    await act(async () => {
      host.querySelectorAll("button")[3].click();
    });
    await waitFor(() => !result.loading && result.meta.page === 2);
    assert.ok(result.data.every((row) => !firstIds.includes(row.id)));
    await act(async () => {
      host.querySelectorAll("button")[0].click();
    });
    assert.ok(
      result.data.every((row) => row.companyId === "beta"),
      "old-company rows are never exposed while switching",
    );
    await waitFor(
      () =>
        context.company.id === "beta" && !context.loading && !result.loading,
    );
    assert.ok(result.data.every((row) => row.companyId === "beta"));
    await act(async () => {
      host.querySelectorAll("button")[1].click();
      search(code);
    });
    await waitFor(
      () =>
        context.company.id === "alpha" && !context.loading && !result.loading,
    );
    assert.equal(result.meta.total, 0);
    await act(async () => {
      await context.saveRecord("suppliers", {
        code,
        name: "QA Live Supplier",
        category: "Jasa",
        status: "ACTIVE",
        email: "",
        phone: "",
        description: "",
        paymentTermsDays: 14,
      });
    });
    await waitFor(
      () => !context.loading && !result.loading && result.meta.total === 1,
    );
    createdId = result.data[0].id;
    assert.equal(result.data[0].paymentTermsDays, 14);
    const before = result.data[0];
    await act(async () => {
      await context.saveRecord(
        "suppliers",
        { ...before, name: "QA Live Supplier Updated" },
        before.id,
        before.updatedAt,
      );
    });
    await waitFor(
      () =>
        !context.loading &&
        !result.loading &&
        result.data[0]?.name === "QA Live Supplier Updated",
    );
    await assert.rejects(
      context.saveRecord(
        "suppliers",
        { ...before, name: "Stale UI Edit" },
        before.id,
        before.updatedAt,
      ),
    );
    await act(async () => {
      await context.deleteRecord("suppliers", createdId!);
    });
    createdId = undefined;
    await waitFor(
      () => !context.loading && !result.loading && result.meta.total === 0,
    );
    await act(async () => {
      host.querySelectorAll("button")[2].click();
      search("");
    });
    await waitFor(
      () =>
        context.company.id === "gamma" && !context.loading && !result.loading,
    );
    assert.equal(context.writable, false);
    assert.ok(result.data.every((row) => row.companyId === "gamma"));
  } finally {
    if (createdId)
      await fetch(apiUrl(`/companies/alpha/master/suppliers/${createdId}`), {
        method: "DELETE",
      });
    await act(async () => {
      root.unmount();
    });
    localStorage.clear();
  }
});
