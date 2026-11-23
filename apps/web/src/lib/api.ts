import { id } from "./i18n";
import { deploymentApiPath, normalizeBasePath } from "@erp/shared";
export const isLive = process.env.NEXT_PUBLIC_DATA_MODE === "live";
export const appBasePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
export const apiUrl = (path: string) => deploymentApiPath(appBasePath, path);
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    cache: "no-store",
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event("erp-session-expired"));
      throw new Error(id.sessionExpired);
    }
    const body = await response.json().catch(() => null);
    if (body?.code === "PASSWORD_CHANGE_REQUIRED" && typeof window !== "undefined") window.dispatchEvent(new Event("erp-password-change-required"));
    throw new Error(body?.message || id.error);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
