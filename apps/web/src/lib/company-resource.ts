"use client";
import { useEffect, useState } from "react";
import { useWorkspace } from "../components/workspace-provider";
import { api, isLive } from "./api";
export function useCompanyResource<T>(
  path: string,
  revision = 0,
  enabled = true,
) {
  const { company, revision: workspaceRevision } = useWorkspace();
  const key = `${company.id}:${path}:${revision}:${workspaceRevision}`;
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>(
    { key: "" },
  );
  useEffect(() => {
    if (!enabled || !isLive || !company.id) return;
    const controller = new AbortController();
    api<T>(`/companies/${company.id}/${path}`, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ key, error: error.message });
      });
    return () => controller.abort();
  }, [company.id, path, key, enabled]);
  return {
    data: enabled && state.key === key ? state.data : undefined,
    error: enabled && state.key === key ? state.error : undefined,
    loading:
      enabled && isLive && (state.key !== key || (!state.data && !state.error)),
  };
}
