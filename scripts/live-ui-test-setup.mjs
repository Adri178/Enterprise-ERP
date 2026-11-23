import "./ui-test-setup.mjs";
import { config } from "dotenv";
config({ path: new URL("../apps/api/.env", import.meta.url), quiet: true });
if (process.env.NODE_ENV === "production")
  throw new Error("Live UI checks are development-only");
process.env.NEXT_PUBLIC_DATA_MODE = "live";
const origin = new URL(process.env.TEST_WEB_URL || "http://localhost:3000");
const mount = origin.pathname.replace(/\/+$/, "");
const nativeFetch = globalThis.fetch;
let session;
export async function setLiveSession(email, password = process.env.DEMO_PASSWORD) {
  const login = await nativeFetch(new URL(`${mount}/api/auth/login`, origin), {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin.origin },
    body: JSON.stringify({
      email,
      password,
    }),
  });
  if (login.status !== 201)
    throw new Error(`Development login failed (${login.status})`);
  session = login.headers.get("set-cookie")?.split(";")[0];
  if (!session) throw new Error("No development session cookie");
}
if (process.env.ERP_TEST_SESSION) session = process.env.ERP_TEST_SESSION;
else await setLiveSession("admin@enterprise.local");
const primarySession = session;
export function restoreLiveSession() { session = primarySession; }
globalThis.fetch = (path, options = {}) => {
  const url = new URL(String(path), origin);
  if (url.origin !== origin.origin)
    throw new Error("Live UI tests only call their own local application");
  const headers = new Headers(options.headers);
  headers.set("Cookie", session);
  if (options.method && options.method !== "GET")
    headers.set("Origin", origin.origin);
  return nativeFetch(url, { ...options, headers });
};
