import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { CookieJar } from "jsdom";
config({ path:new URL("../apps/api/.env",import.meta.url),quiet:true });
if(process.env.NODE_ENV === "production") throw new Error("Subpath development verification only; uses the development account");
const app = new URL(process.env.TEST_WEB_URL || "http://localhost:3001/erp"), prefix=app.pathname.replace(/\/+$/, "");
if(!prefix) throw new Error("TEST_WEB_URL must include the mounted path, e.g. http://localhost:3001/erp");
const endpoint=(path)=>new URL(`${prefix}${path}`,app.origin), request=(path,options={})=>fetch(endpoint(path),options);
const routes=[...new Set([...readFileSync(new URL("../apps/web/src/lib/navigation.ts",import.meta.url),"utf8").matchAll(/slug:\s*["']([^"']+)["']/g)].map(m=>m[1]))];
for(const route of [...routes,"login","change-password"]) {
  const r=await request(`/${route}`),html=await r.text(); assert.equal(r.status,200,route); assert.ok(html.includes("<h1"),route);
}
const loginHtml=await (await request("/login")).text();
assert.ok(loginHtml.includes(`href="${prefix}/dashboard"`),"Next links retain the mount prefix");
const assets=[...loginHtml.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+)"/g)].map(m=>m[1].replaceAll("&amp;","&"));
assert.ok(assets.length>0); for(const asset of [...new Set(assets)].slice(0,4)) { assert.ok(asset.startsWith(prefix+"/_next/")); assert.equal((await fetch(new URL(asset,app.origin))).status,200,asset); }
const entry=await request("",{redirect:"manual"}),entryHtml=await entry.text();
assert.ok(entry.headers.get("location")?.startsWith(prefix+"/dashboard") || entryHtml.includes(prefix+"/dashboard"),"Home redirect remains inside ERP");
assert.equal((await fetch(new URL("/dashboard",app.origin))).status,404,"ERP does not claim a portfolio root route");
assert.equal((await request("/this-page-does-not-exist")).status,404);
assert.equal((await request("/api/auth/me")).status,401);
assert.equal((await fetch(new URL("/api/auth/me",app.origin))).status,404,"API is exposed under the mounted application only");
const login=await request("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json",Origin:app.origin},body:JSON.stringify({email:"admin@enterprise.local",password:process.env.DEMO_PASSWORD})});
assert.equal(login.status,201); const issued=login.headers.get("set-cookie"),cookie=issued?.split(";")[0]; assert.ok(cookie);
assert.ok(issued.includes(`Path=${prefix};`),"session path"); assert.ok(/HttpOnly/i.test(issued),"HttpOnly cookie"); assert.ok(/SameSite=Strict/i.test(issued),"strict cookie");
const jar=new CookieJar(), publicOrigin="https://adzr.my.id";
jar.setCookieSync(issued,`${publicOrigin}${prefix}/api/auth/login`);
assert.ok(jar.getCookieStringSync(`${publicOrigin}${prefix}/api/auth/me`));
for(const outside of ["/","/portfolio","/api/auth/me",`${prefix}-other/api/auth/me`]) assert.equal(jar.getCookieStringSync(publicOrigin+outside),"",outside);
const profile=await request("/api/auth/me",{headers:{Cookie:cookie}}); assert.equal(profile.status,200); assert.equal(profile.headers.get("cache-control"),"no-store");
const user=await profile.json(); assert.ok(user.companies.some(c=>c.id==="alpha"));
assert.equal((await request("/api/companies/alpha/master/suppliers?pageSize=1",{headers:{Cookie:cookie}})).status,200);
assert.equal((await request("/api/companies/not-authorized/master-summary",{headers:{Cookie:cookie}})).status,403);
assert.equal((await request("/api/auth/logout",{method:"POST",headers:{Origin:"https://other.example",Cookie:cookie}})).status,403);
const logout=await request("/api/auth/logout",{method:"POST",headers:{Origin:app.origin,Cookie:cookie}}); assert.equal(logout.status,201);
const cleared=logout.headers.get("set-cookie"); assert.ok(cleared.includes(`Path=${prefix};`)); assert.match(cleared,/Expires=Thu, 01 Jan 1970/i);
jar.setCookieSync(cleared,`${publicOrigin}${prefix}/api/auth/logout`); assert.equal(jar.getCookieStringSync(`${publicOrigin}${prefix}/api/auth/me`),"");
console.log(`Subpath passed: ${routes.length+2} pages, prefixed links/assets/redirects, isolated root routes, login/profile/catalog API proxy, Company access, origin checks and scoped cookie issue/clear.`);
