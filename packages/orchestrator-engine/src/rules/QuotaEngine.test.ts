import { describe, it, beforeAll, expect, vi } from "vitest";
import { QuotaEngine } from "./QuotaEngine";
import * as fs from "fs";

vi.mock("fs");

describe("QuotaEngine", () => {
    beforeAll(() => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(`
westus:
  DSv4:
    total: 128
    used: 96
    available: 32
    assigned_to:
      - validator
  BSv2:
    total: 24
    used: 12
    available: 12
    assigned_to:
      - boot_node
      - public_rpc
`);
    });

    it("validateQuota returns true if quota available", () => {
        const engine = new QuotaEngine();
        expect(engine.validateQuota("westus", "validator")).toBe(true);
    });

    it("suggestRegion returns a region if available", () => {
        const engine = new QuotaEngine();
        expect(engine.suggestRegion("validator")).toBe("westus");
    });

    it("summarizeAvailability returns correct usage percent", () => {
        const engine = new QuotaEngine();
        const summary = engine.summarizeAvailability("validator");
        expect(summary["westus"].usage_percent).toBe("75.00");
    });
});