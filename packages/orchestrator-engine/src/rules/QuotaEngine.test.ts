import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import { QuotaEngine } from "./QuotaEngine";
import * as fs from "fs";
import * as yaml from "yaml";

vi.mock("fs");
vi.mock("yaml");

describe("QuotaEngine", () => {
    // Save original environment
    const originalEnv = { ...process.env };

    // Mock data for tests
    const mockQuotaData = {
        "eastus": {
            "Standard_D4s_v3": {
                total: 100,
                used: 50,
                available: 50,
                assigned_to: ["web", "api"]
            }
        },
        "westus": {
            "Standard_F8s_v2": {
                total: 50,
                used: 50,
                available: 0,
                assigned_to: ["database"]
            }
        }
    };

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Mock file system
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue("quota-data");

        // Mock yaml parser
        vi.mocked(yaml.parse).mockReturnValue(mockQuotaData);

        // Set up environment variables
        process.env.AZURE_SUBSCRIPTION_ID = "test-subscription";
        process.env.AZURE_TENANT_ID = "test-tenant";
    });

    afterEach(() => {
        // Restore environment
        process.env = { ...originalEnv };
    });

    it("should validate quota when enough is available", () => {
        const engine = new QuotaEngine();
        expect(engine.validateQuota("eastus", "web")).toBe(true);
    });

    it("should not validate quota when not enough is available", () => {
        const engine = new QuotaEngine();
        expect(engine.validateQuota("westus", "database")).toBe(false);
    });

    it("should not validate quota for non-existent region", () => {
        const engine = new QuotaEngine();
        expect(engine.validateQuota("centralus", "web")).toBe(false);
    });

    it("should warn when using cached data due to missing Azure credentials", () => {
        // Remove required Azure environment variables
        delete process.env.AZURE_SUBSCRIPTION_ID;
        delete process.env.AZURE_TENANT_ID;

        const consoleLogSpy = vi.spyOn(console, "log");

        const engine = new QuotaEngine();
        engine.validateQuota("eastus", "web");

        // Check if warning about cached data was logged
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Using cached quota data"));
    });

    it("should fail to refresh quota data when Azure credentials are missing", async () => {
        // Remove required Azure environment variables
        delete process.env.AZURE_SUBSCRIPTION_ID;

        const engine = new QuotaEngine();
        const result = await engine.refreshQuotaData();

        expect(result).toBe(false);
    });

    it("should successfully refresh quota data when credentials are available", async () => {
        const engine = new QuotaEngine();
        const result = await engine.refreshQuotaData();

        expect(result).toBe(true);
        expect(fs.readFileSync).toHaveBeenCalledTimes(2); // Once in constructor, once in refresh
    });

    it("should throw an error if quota file doesn't exist", () => {
        vi.mocked(fs.existsSync).mockReturnValueOnce(false);

        expect(() => new QuotaEngine()).toThrow("Quota file not found");
    });
});