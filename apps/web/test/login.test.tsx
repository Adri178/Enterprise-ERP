import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { id } from "../src/lib/i18n";

test("login form distinguishes credentials, denied origin, throttling, outage and session failures before routing", async () => {
  const priorMode = process.env.NEXT_PUBLIC_DATA_MODE;
  process.env.NEXT_PUBLIC_DATA_MODE = "live";
  const { default: LoginPage } = createRequire(__filename)("../src/app/login/page.js") as typeof import("../src/app/login/page");
  const nativeFetch = globalThis.fetch, host = document.getElementById("root")!, root = createRoot(host), navigations: string[] = [];
  const router: AppRouterInstance = { back() {}, forward() {}, refresh() {}, replace() {}, prefetch() {}, push(path) { navigations.push(path); }, bfcacheId: "login-test" };
  let responses: Array<Response | Error> = [], paths: string[] = [];
  globalThis.fetch = async (path, options) => {
    paths.push(String(path));
    assert.equal(options?.credentials, "include");
    if (String(path).endsWith("/auth/login")) {
      assert.equal(options?.method, "POST");
      assert.deepEqual(JSON.parse(String(options.body)), { email: "admin@enterprise.local", password: "DevOnly!ERP2026" });
    }
    const response = responses.shift();
    if (!response) throw new Error("Unexpected authentication request");
    if (response instanceof Error) throw response;
    return response;
  };
  try {
    await act(async () => { root.render(<AppRouterContext.Provider value={router}><LoginPage /></AppRouterContext.Provider>); });
    async function input(name: string, value: string) {
      const field = host.querySelector<HTMLInputElement>(`#${name}`)!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!.call(field, value);
        field.dispatchEvent(new window.Event("input", { bubbles: true }));
      });
    }
    await input("email", "admin@enterprise.local");
    await input("password", "DevOnly!ERP2026");
    async function submit(next: Array<Response | Error>) {
      responses = next; paths = [];
      await act(async () => { host.querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
      assert.equal(responses.length, 0);
      assert.equal(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled, false);
    }
    for (const [status, message] of [[401, id.loginFailed], [403, id.loginOriginDenied], [429, id.loginRateLimited], [502, id.loginUnavailable]] as const) {
      await submit([new Response("", { status })]);
      assert.equal(host.querySelector('[role="alert"]')?.textContent, message);
      assert.deepEqual(paths, ["/api/auth/login"]);
      assert.equal(host.querySelector<HTMLInputElement>("#password")!.value, "DevOnly!ERP2026");
      assert.equal(navigations.length, 0);
    }
    await submit([new TypeError("fetch failed")]);
    assert.equal(host.querySelector('[role="alert"]')?.textContent, id.loginNetworkFailed);
    for (const [status, message] of [[401, id.loginSessionFailed], [429, id.loginRateLimited], [503, id.loginUnavailable]] as const) {
      await submit([new Response("", { status: 201 }), new Response("", { status })]);
      assert.equal(host.querySelector('[role="alert"]')?.textContent, message);
      assert.deepEqual(paths, ["/api/auth/login", "/api/auth/me"]);
      assert.equal(navigations.length, 0);
    }
    for (const mustChangePassword of [true, false]) {
      await submit([new Response("", { status: 201 }), Response.json({ mustChangePassword })]);
      assert.equal(host.querySelector('[role="alert"]'), null);
      assert.equal(navigations.at(-1), mustChangePassword ? "/change-password" : "/dashboard");
    }
  } finally {
    await act(async () => { root.unmount(); });
    globalThis.fetch = nativeFetch;
    if (priorMode === undefined) delete process.env.NEXT_PUBLIC_DATA_MODE;
    else process.env.NEXT_PUBLIC_DATA_MODE = priorMode;
  }
});
