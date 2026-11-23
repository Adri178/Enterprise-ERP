import { test } from "node:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { AppShell } from "../src/components/app-shell";
import { WorkspaceProvider } from "../src/components/workspace-provider";
import { id } from "../src/lib/i18n";

test("workspace shell preserves Company switching, sidebar, global search and profile actions", async () => {
  localStorage.clear();
  const host = document.getElementById("root")!, root = createRoot(host), paths: string[] = [];
  const router: AppRouterInstance = { back() {}, forward() {}, refresh() {}, replace() {}, prefetch() {}, push(path) { paths.push(path); }, bfcacheId: "workspace-test" };
  const click = async (selector: string) => {
    const target = document.querySelector<HTMLButtonElement>(selector);
    assert.ok(target, selector);
    await act(async () => { target.focus(); target.click(); });
  };
  const openMenu = async (selector: string) => {
    const target = document.querySelector<HTMLButtonElement>(selector)!;
    await act(async () => { target.focus(); target.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 })); });
    assert.ok(document.querySelector('[role="menu"]'), selector);
  };
  const escape = async () => { await act(async () => { document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); }); };
  try {
    await act(async () => root.render(<AppRouterContext.Provider value={router}><PathnameContext.Provider value="/dashboard"><WorkspaceProvider><AppShell><p>Workspace content</p></AppShell></WorkspaceProvider></PathnameContext.Provider></AppRouterContext.Provider>));
    assert.match(host.querySelector(".company-name")!.textContent!, /Alpha/);
    assert.equal(host.querySelectorAll(".nav-link").length, 11);
    await openMenu(".company-switcher");
    const beta = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(n => n.textContent?.includes("PT Beta Industri"))!;
    await act(async () => beta.click());
    assert.match(host.querySelector(".company-name")!.textContent!, /Beta/);
    assert.match(host.querySelector(".workspace-company strong")!.textContent!, /Beta/);
    await openMenu(".sidebar-workspace");
    const alpha = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(n => n.textContent?.includes("PT Alpha Distribusi"))!;
    await act(async () => alpha.click());
    assert.match(host.querySelector(".company-name")!.textContent!, /Alpha/);
    await click(".nav-expand");
    assert.equal(host.querySelector(".nav-expand")!.getAttribute("aria-expanded"), "true");
    assert.ok(host.querySelector('.nav-children a[href="/companies"]'));
    await click(".sidebar-collapse");
    assert.ok(host.querySelector(".sidebar-collapsed"));
    assert.ok(host.querySelector(".account-compact"));
    await click(".sidebar-collapse");
    await click(".global-search");
    assert.ok(document.querySelector('[role="dialog"] input'));
    await escape();
    assert.equal(document.querySelector('[role="dialog"]'), null);
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })));
    assert.ok(document.querySelector('[role="dialog"] input'));
    await escape();
    await openMenu(".sidebar-account");
    const profile = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(n => n.textContent === id.profile)!;
    await act(async () => profile.click());
    assert.ok(document.querySelector('[role="dialog"]'));
    assert.match(document.querySelector('[role="dialog"]')!.textContent!, /PT Alpha Distribusi/);
    await escape();
    await openMenu(".sidebar-account");
    const settings = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(n => n.textContent === id.settings)!;
    await act(async () => settings.click());
    assert.deepEqual(paths, ["/settings"]);
  } finally {
    await act(async () => root.unmount());
    localStorage.clear();
  }
});
