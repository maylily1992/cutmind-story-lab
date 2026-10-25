import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
  pretendToBeVisual: true,
  url: "https://example.test/",
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
});
globalThis.localStorage = dom.window.localStorage;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.SVGElement = dom.window.SVGElement;
globalThis.Node = dom.window.Node;
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.MutationObserver = dom.window.MutationObserver;
globalThis.fetch = async () => new Response("{}", { status: 204 });
globalThis.ResizeObserver = class {
  constructor(callback) {
    this.callback = callback;
  }
  observe(target) {
    this.callback([{ target, contentRect: { width: 390, height: 440 } }]);
  }
  disconnect() {}
};

const assets = await readdir(resolve("docs/assets"));
const bundle = assets.find((name) => name.startsWith("index-") && name.endsWith(".js"));
if (!bundle) throw new Error("Built JavaScript bundle not found");
await import(pathToFileURL(resolve("docs/assets", bundle)).href);
await new Promise((resolvePromise) => setTimeout(resolvePromise, 120));

const text = document.getElementById("root")?.textContent ?? "";
for (const phrase of ["切面", "不是学名词", "今日十词", "收下今天的一刀"]) {
  if (!text.includes(phrase)) throw new Error(`Missing rendered text: ${phrase}`);
}

const captureButton = [...document.querySelectorAll("button")].find((button) =>
  button.textContent?.includes("快捕"),
);
if (!captureButton) throw new Error("Capture navigation missing");
captureButton.click();
await new Promise((resolvePromise) => setTimeout(resolvePromise, 60));
const input = document.querySelector(".capture-textarea");
if (!(input instanceof dom.window.HTMLTextAreaElement)) {
  throw new Error("Capture textarea missing");
}
const setter = Object.getOwnPropertyDescriptor(
  dom.window.HTMLTextAreaElement.prototype,
  "value",
)?.set;
setter?.call(input, "「元叙事呼吸口」是自反破裂后短暂释放压力，再带着变化返回沉浸。");
input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
const parseButton = [...document.querySelectorAll("button")].find((button) =>
  button.textContent?.includes("解析成技法草稿"),
);
if (!parseButton) throw new Error("Parse button missing");
parseButton.click();
await new Promise((resolvePromise) => setTimeout(resolvePromise, 160));
if (!document.querySelector(".draft-card")) throw new Error("Draft card missing");
const confirmButton = [...document.querySelectorAll("button")].find((button) =>
  button.textContent?.includes("确认并长入图谱"),
);
if (!confirmButton) throw new Error("Confirm button missing");
confirmButton.click();
await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
const saved = dom.window.localStorage.getItem("cutmind-story-os-v2");
if (!saved?.includes("元叙事呼吸口")) throw new Error("Captured node was not persisted");

const atlasButton = [...document.querySelectorAll("button")].find((button) =>
  button.textContent?.includes("图谱"),
);
if (!atlasButton) throw new Error("Atlas navigation missing");
atlasButton.click();
await new Promise((resolvePromise) => setTimeout(resolvePromise, 120));
const galaxySvg = document.querySelector(".canvas-viewport-wrap svg");
if (!galaxySvg) throw new Error("Atlas galaxy missing");
const initialLayers = galaxySvg.querySelectorAll(".canvas-node-layer");
if (initialLayers.length !== 5) throw new Error("Atlas layers were not rendered");
initialLayers[0].dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
await new Promise((resolvePromise) => setTimeout(resolvePromise, 90));
const branches = galaxySvg.querySelectorAll(".canvas-node-branch");
if (!branches.length) throw new Error("Atlas branches were not rendered");
branches[0].dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
await new Promise((resolvePromise) => setTimeout(resolvePromise, 90));
const groups = galaxySvg.querySelectorAll(".canvas-node-group");
if (!groups.length) throw new Error("Atlas branch did not expand into groups");
groups[0].dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
await new Promise((resolvePromise) => setTimeout(resolvePromise, 90));
const leaves = galaxySvg.querySelectorAll(".canvas-node-node");
if (!leaves.length) throw new Error("Atlas group did not expand into techniques");
leaves[0].dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
await new Promise((resolvePromise) => setTimeout(resolvePromise, 80));
if (!document.querySelector(".node-sheet")) throw new Error("Node detail sheet missing");

console.log(`SMOKE_OK ${bundle} chars=${text.length}`);
