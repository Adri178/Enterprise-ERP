import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { PrismaClient } from "@prisma/client";
import { accountingPurposes } from "@erp/shared";
import { AutomaticAccountingPage } from "../src/components/automatic-accounting-page";
import { WorkspaceProvider, useWorkspace } from "../src/components/workspace-provider";
import { id } from "../src/lib/i18n";
async function json(path: string, method = "GET", body?: unknown, expected?: number) {
  let result: Awaited<ReturnType<Response["json"]>>;
  await act(async () => { const r = await fetch(`/api${path}`, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) }); result = await r.json(); assert.ok(expected ? r.status === expected : r.ok, `${path}: ${JSON.stringify(result)}`); }); return result;
}
const dialog = () => Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).at(-1);
const button = (text: string, parent: ParentNode = document) => Array.from(parent.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent?.trim() === text)!;
async function click(text: string, parent?: ParentNode) { assert.ok(button(text, parent), text); await act(async () => button(text, parent).click()); }
async function waitFor(check: () => boolean) { for (let n = 0; n < 250; n++) { if (check()) return; await act(async () => { await new Promise((r) => setTimeout(r, 40)); }); } throw new Error(`Automatic Accounting UI did not settle: ${document.body.textContent?.slice(-2500)}`); }
async function input(label: string, text: string) {
  const target = Array.from(document.querySelectorAll("label")).find((l) => l.textContent?.startsWith(label))?.querySelector("input,textarea"); assert.ok(target,label);
  await act(async () => { const proto = target.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,"value")!.set!.call(target,text); target.dispatchEvent(new window.Event("input",{bubbles:true})); target.dispatchEvent(new window.Event("change",{bubbles:true})); });
}
async function submit() { await act(async () => { document.querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles:true,cancelable:true })); }); }
function Controls() { const { switchCompany } = useWorkspace(); return <button onClick={() => switchCompany("gamma")}>QA Gamma</button>; }
test("Automatic Accounting UI validates and confirms scoped mapping, handles zero opening, opens real Journal/source links and discards previous Company details",async () => {
  const prisma=new PrismaClient(), code=`AU${Date.now().toString(36).toUpperCase()}`, root=createRoot(document.getElementById("root")!), today=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Jakarta"}); let company: { id:string; code:string } | undefined;
  const { automaticChart, cleanAutomaticCompany } = await import(pathToFileURL(resolve("scripts/automatic-accounting-test-fixtures.mjs")).href);
  try {
    const user=await json("/auth/me"); company=await json("/companies","POST",{code,name:"QA Automatic UI",industry:"Pengujian",city:"Jakarta",currency:"IDR",status:"ACTIVE",address:"",email:"",phone:"",taxId:""}); const rootPath=`/companies/${company!.id}`;
    await automaticChart(json,rootPath); localStorage.clear(); localStorage.setItem(`enterprise-erp-active:${user.id}`,company!.id);
    await act(async()=>root.render(<SearchParamsContext.Provider value={new URLSearchParams()}><WorkspaceProvider><Controls /><AutomaticAccountingPage /></WorkspaceProvider></SearchParamsContext.Provider>));
    await waitFor(()=>!!button(id.autoActivate)); await submit(); assert.ok(document.body.textContent?.includes("Pilih Account"));
    for (let index=0;index<accountingPurposes.length;index++) {
      await act(async()=>document.querySelectorAll<HTMLButtonElement>('[role="combobox"]')[index].click()); const code=`A-${accountingPurposes[index].replaceAll('_','-')}`;
      await waitFor(()=>!!Array.from(dialog()!.querySelectorAll("button")).find(b=>b.textContent?.includes(code)));
      await act(async()=>Array.from(dialog()!.querySelectorAll<HTMLButtonElement>("button")).find(b=>b.textContent?.includes(code))!.click());
    }
    await input(id.autoReason,"QA reviewed opening and mappings"); await submit(); assert.ok(dialog()?.textContent?.includes(id.autoConfirmTitle)); await click(id.cancel,dialog());
    let policyCount=0; await act(async()=>{policyCount=await prisma.accountingPolicy.count({where:{companyId:company!.id}});}); assert.equal(policyCount,0);
    await submit(); await click(id.confirm,dialog()); await waitFor(()=>!dialog() && !!document.body.textContent?.includes(id.autoEnabled)); assert.equal(document.querySelectorAll('[role="combobox"]').length,0);
    const policy=await json(rootPath+"/accounting/policy"); assert.equal(policy.openingJournal,null); assert.equal(policy.effectiveFrom,today);
    assert.equal((await json("/auth/me")).companies.find((c: { id:string })=>c.id===company!.id).currencyLocked,true);
    const master=(kind:string,code:string,extra={})=>json(rootPath+`/master/${kind}`,"POST",{code,name:`QA ${code}`,category:"Accounting",email:"",phone:"",description:"",status:"ACTIVE",...extra});
    const branch=await master("branches","BR",{city:"Jakarta"}), wh=await master("warehouses","WH",{branchId:branch.id}), item=await master("items","ITEM",{unit:"pcs",trackStock:true,reorderLevel:0});
    let stock=await json(rootPath+"/stock/operations","POST",{requestKey:crypto.randomUUID(),kind:"ADJUSTMENT",date:today,warehouseId:wh.id,targetWarehouseId:"",description:"QA UI automatic journal",lines:[{itemId:item.id,quantity:2,unitPrice:1.25}]});
    stock=await json(rootPath+`/stock/operations/${stock.id}/actions`,"POST",{action:"post",expectedUpdatedAt:stock.updatedAt}); await click(id.accessRefresh); await waitFor(()=>!!button(stock.number));
    const posting=(await json(rootPath+"/accounting/postings")).data[0]; await click(posting.journal.number); await waitFor(()=>!!dialog()?.textContent?.includes(id.autoManualProtected)); assert.equal(button(id.journalReverse,dialog()),undefined); assert.match(dialog()!.textContent!,/2,5/); await click(id.close,dialog());
    await click(stock.number); await waitFor(()=>!!dialog()?.textContent?.includes("QA UI automatic journal")); await click(id.close,dialog());
    await click(posting.journal.number); await waitFor(()=>!!dialog()?.textContent?.includes(posting.journal.number)); await click("QA Gamma"); assert.equal(dialog(),undefined); assert.ok(!document.body.textContent?.includes(stock.number)); await waitFor(()=>!!document.body.textContent?.includes(id.autoAdminOnly)); assert.equal(button(id.autoActivate),undefined);
  } finally { await act(async()=>root.unmount()); localStorage.clear(); await cleanAutomaticCompany(prisma,company); await prisma.$disconnect(); }
});
