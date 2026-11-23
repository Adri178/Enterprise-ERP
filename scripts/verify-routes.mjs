import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const source = readFileSync(
  new URL("../apps/web/src/lib/navigation.ts", import.meta.url),
  "utf8",
);
const slugs = [
  ...new Set(
    [...source.matchAll(/slug:\s*["']([^"']+)["']/g)].map((match) => match[1]),
  ),
];
assert.ok(slugs.length >= 11, "navigation routes were discovered");
const base = process.env.TEST_WEB_URL || "http://localhost:3000";
for (const slug of [...slugs, "login", "change-password"]) {
  const response = await fetch(`${base}/${slug}`);
  const html = await response.text();
  assert.equal(response.status, 200, `${slug} HTTP status`);
  assert.ok(html.includes("<h1"), `${slug} page heading`);
  assert.ok(
    !html.includes("Module not found"),
    `${slug} compiled without missing modules`,
  );
}
assert.equal((await fetch(`${base}/this-page-does-not-exist`)).status, 404);
console.log(`Route checks passed: ${slugs.length + 2} pages and 404 handling.`);
