import { expect } from "vitest";
import matchers from "@testing-library/jest-dom/matchers";

// Extend Vitest's expect with Testing Library matchers
expect.extend(matchers);

// Initialize jsdom globally
import { JSDOM } from "jsdom";
const dom = new JSDOM("<body></body>", { url: "http://localhost" });
global.document = dom.window.document;
global.window = dom.window;
global.navigator = dom.window.navigator;

globalThis.document = dom.window.document;
globalThis.window = dom.window;
globalThis.navigator = dom.window.navigator;

console.log("Global document object:", global.document);

console.log("jsdom environment initialized");