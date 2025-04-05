import { expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import * as matchers from '@testing-library/jest-dom/matchers';
import { JSDOM } from "jsdom";

// Extend Vitest's expect with Testing Library matchers
expect.extend(matchers);

// Initialize jsdom globally
const dom = new JSDOM("<body></body>", { url: "http://localhost" });
global.document = dom.window.document;
global.window = dom.window;
global.navigator = dom.window.navigator;

// Mock fetch globally
global.fetch = vi.fn();