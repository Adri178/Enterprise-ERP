import type { CookieOptions } from "express";
import { normalizeBasePath } from "@erp/shared";
export function sessionCookieOptions(): CookieOptions {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: normalizeBasePath(process.env.SESSION_COOKIE_PATH) || "/" };
}
export function frontendOrigin() {
  const url = new URL(process.env.FRONTEND_ORIGIN || "http://localhost:3000");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("FRONTEND_ORIGIN harus berupa origin seperti http://localhost:3000 tanpa path, query, atau kredensial");
  return url.origin;
}
