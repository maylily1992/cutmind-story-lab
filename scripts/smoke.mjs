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
globalThis.Node = dom.window.Node;
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.MutationObserver = dom.window.MutationObserver;
globalThis.fetch = async () => new Response("{}", { status: 204 });

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

console.log(`SMOKE_OK ${bundle} chars=${text.length}`);
