"use client";
import { useEffect, useMemo, useState } from "react";
import {
  catalogQuerySchema,
  type CatalogQuery,
  type CatalogSearchHit,
  type MasterKind,
  type MasterRecord,
  type PageResult,
} from "@erp/shared";
import { useWorkspace } from "../components/workspace-provider";
import { api, isLive } from "./api";

export function catalogQueryString(query: CatalogQuery) {
  return new URLSearchParams(
    Object.entries(query).map(([key, value]) => [key, String(value)]),
  ).toString();
}
export function useDebouncedValue<T>(value: T, delay = 200) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
export function filterCatalog(
  rows: MasterRecord[],
  query: CatalogQuery,
): PageResult<MasterRecord> {
  const q = query.q.toLowerCase();
  const filtered = rows
    .filter(
      (row) =>
        (!q ||
          `${row.code} ${row.name} ${row.email}`.toLowerCase().includes(q)) &&
        (!query.branchId || row.branchId === query.branchId) &&
        (query.status === "ALL" || row.status === query.status) &&
        (query.category === "ALL" || row.category === query.category),
    )
    .sort((a, b) => {
      const result = String(a[query.sort] || "").localeCompare(
        String(b[query.sort] || ""),
        "id-ID",
        { numeric: true },
      );
      return (
        (query.direction === "asc" ? result : -result) ||
        a.id.localeCompare(b.id)
      );
    });
  const pageCount = Math.max(1, Math.ceil(filtered.length / query.pageSize));
  const page = Math.min(query.page, pageCount);
  return {
    data: filtered.slice((page - 1) * query.pageSize, page * query.pageSize),
    meta: { page, pageCount, pageSize: query.pageSize, total: filtered.length },
  };
}
export function useCatalogList(
  kind: MasterKind,
  options: Partial<CatalogQuery>,
) {
  const {
    company,
    records,
    revision,
    loading: workspaceLoading,
  } = useWorkspace();
  const query = catalogQuerySchema.parse(options);
  const debouncedQ = useDebouncedValue(query.q);
  const effectiveQuery = { ...query, q: isLive ? debouncedQ : query.q };
  const queryString = catalogQueryString(effectiveQuery);
  const key = `${company.id}:${kind}:${queryString}:${revision}`;
  const [result, setResult] = useState<{
    key: string;
    value?: PageResult<MasterRecord>;
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (!isLive || !company.id) return;
    const controller = new AbortController();
    api<PageResult<MasterRecord>>(
      `/companies/${company.id}/master/${kind}?${queryString}`,
      { signal: controller.signal },
    )
      .then((value) => {
        if (!controller.signal.aborted) setResult({ key, value });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({ key, error: error.message });
      });
    return () => controller.abort();
  }, [company.id, kind, queryString, key]);
  const demo = useMemo(
    () =>
      filterCatalog(
        records[kind],
        catalogQuerySchema.parse(
          Object.fromEntries(new URLSearchParams(queryString)),
        ),
      ),
    [records, kind, queryString],
  );
  const pending = isLive && (result?.key !== key || query.q !== debouncedQ);
  const value = !isLive
    ? demo
    : !pending && result?.value
      ? result.value
      : {
          data: [],
          meta: {
            total: 0,
            page: query.page,
            pageSize: query.pageSize,
            pageCount: 1,
          },
        };
  return {
    ...value,
    loading: workspaceLoading || pending,
    error: isLive && result?.key === key ? result.error || null : null,
  };
}
export function useCatalogSearch(query: string) {
  const { company, records, revision } = useWorkspace();
  const q = useDebouncedValue(query.trim());
  const key = `${company.id}:${q}:${revision}`;
  const [result, setResult] = useState<{
    key: string;
    rows: CatalogSearchHit[];
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (!isLive || !company.id || q.length < 2) return;
    const controller = new AbortController();
    api<CatalogSearchHit[]>(
      `/companies/${company.id}/search?q=${encodeURIComponent(q)}`,
      { signal: controller.signal },
    )
      .then((rows) => {
        if (!controller.signal.aborted) setResult({ key, rows });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({ key, rows: [], error: error.message });
      });
    return () => controller.abort();
  }, [company.id, q, key]);
  const demo =
    query.trim().length < 2
      ? []
      : Object.entries(records)
          .flatMap(([kind, rows]) =>
            rows
              .filter((row) =>
                `${row.name} ${row.code}`
                  .toLowerCase()
                  .includes(query.trim().toLowerCase()),
              )
              .map((row) => ({
                id: row.id,
                name: row.name,
                code: row.code,
                kind: kind as MasterKind,
              })),
          )
          .slice(0, 8);
  return {
    rows: isLive
      ? result?.key === key && query.trim() === q
        ? result.rows
        : []
      : demo,
    loading:
      isLive &&
      query.trim().length > 1 &&
      (query.trim() !== q || result?.key !== key),
    error: result?.key === key ? result.error : undefined,
  };
}
