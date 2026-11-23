import { JSDOM } from "jsdom";
import "./ui-aliases.mjs";
const dom = new JSDOM(
  '<!doctype html><html><body><div id="root"></div></body></html>',
  { url: "http://localhost:3000" },
);
global.window = dom.window;
global.self = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.HTMLElement = dom.window.HTMLElement;
global.NodeFilter = dom.window.NodeFilter;
for (const key of [
  "Node",
  "Element",
  "DocumentFragment",
  "MutationObserver",
  "CustomEvent",
  "HTMLInputElement",
  "HTMLSelectElement",
  "HTMLTextAreaElement",
  "HTMLButtonElement",
  "MouseEvent",
  "KeyboardEvent",
  "getComputedStyle",
])
  globalThis[key] = dom.window[key];
global.requestAnimationFrame = (callback) => setTimeout(callback, 0);
global.cancelAnimationFrame = clearTimeout;
global.IS_REACT_ACT_ENVIRONMENT = true;
