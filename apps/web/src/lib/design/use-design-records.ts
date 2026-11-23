"use client";
import { useEffect, useRef, useState } from "react";
import type { z } from "zod";
import type { Company } from "@erp/shared";
import { useWorkspace } from "@/components/workspace-provider";
import { id } from "../i18n";

export function designStorageKey(kind: string, companyId: string) { return `enterprise-erp-design-v1:${kind}:${companyId}`; }
export function parseDesignRecords<T extends { id: string; companyId: string }>(schema: z.ZodType<T>, raw: string, companyId: string) {
  const rows = schema.array().max(500).parse(JSON.parse(raw));
  if (rows.some(row => row.companyId !== companyId) || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error(id.design.storageError);
  return rows;
}
export function useDesignRecords<T extends { id: string; companyId: string }>(kind: string, schema: z.ZodType<T>, seed: (company: Company) => T[]) {
  const { company, writable } = useWorkspace();
  const key = designStorageKey(kind, company.id), active = useRef(false);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ key: string; rows: T[]; loading: boolean; error?: string }>({ key, rows: [], loading: true });
  useEffect(() => {
    active.current = true;
    const timer = setTimeout(() => {
      try {
        const raw = localStorage.getItem(key);
        const rows = raw === null ? seed(company) : parseDesignRecords(schema, raw, company.id);
        setState({ key, rows, loading: false });
      } catch { setState({ key, rows: [], loading: false, error: id.design.storageError }); }
    }, 0);
    return () => { active.current = false; clearTimeout(timer); };
  }, [key, schema, seed, company, revision]);
  const current = state.key === key;
  function update(transform: (rows: T[]) => T[]) {
    if (!active.current || !current || state.loading || state.error || !writable) throw new Error(id.design.readOnly);
    let currentRows: T[];
    try { const raw = localStorage.getItem(key); currentRows = raw === null ? state.rows : parseDesignRecords(schema, raw, company.id); }
    catch { throw new Error(id.design.storageError); }
    const transformed = transform(currentRows);
    let rows: T[];
    try { rows = schema.array().max(500).parse(transformed); }
    catch { throw new Error(id.design.invalidData); }
    if (rows.some(row => row.companyId !== company.id) || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error(id.design.saveError);
    try { localStorage.setItem(key, JSON.stringify(rows)); }
    catch { throw new Error(id.design.saveError); }
    setState({ key, rows, loading: false });
  }
  return { rows: current ? state.rows : [], loading: !current || state.loading, error: current ? state.error : undefined, update, retry: () => setRevision(value => value + 1) };
}
