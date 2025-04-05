import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import { BesuConfigurator } from "./BesuConfigurator";
import * as fs from "fs";
import { PathLike } from "fs";

vi.mock("fs");

describe("BesuConfigurator", () => {
    // Save original environment and process.env
    const originalEnv = { ...process.env };

    beforeEach(() => {
        // Mock filesystem functions
        vi.mocked(fs.existsSync).mockReturnValue(true);
        // Fix the mockImplementation return type to match what fs.mkdirSync should return
        vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
        vi.mocked(fs.readFileSync).mockImplementation(() => "{}");
        vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
        // Fix the readdirSync return type to use string[] instead of Dirent[]
        vi.mocked(fs.readdirSync).mockReturnValue(["besu-config-2025-01-01T00-00-00.json"] as unknown as fs.Dirent[]);

        // Set up environment for testing
        process.env.BESU_ENDPOINT = "http://localhost:8545";
        process.env.AZURE_SUBSCRIPTION_ID = "test-subscription";
        process.env.AZURE_TENANT_ID = "test-tenant";
        process.env.AZURE_CLIENT_ID = "test-client";
    });

    afterEach(() => {
        // Restore environment after each test
        process.env = { ...originalEnv };
        vi.clearAllMocks();
    });

    it("deploy writes versioned config when all pre-flight checks pass", async () => {
        const configurator = new BesuConfigurator();
        await configurator.deploy("test/besu-config.json");
        expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it("should skip deployment when Besu is not available", async () => {
        // Remove Besu endpoint from environment
        delete process.env.BESU_ENDPOINT;

        // Create spy for console.log to check for warning messages
        const consoleLogSpy = vi.spyOn(console, "log");

        const configurator = new BesuConfigurator();
        await configurator.deploy("test/besu-config.json");

        // Verify deployment was not executed (writeFileSync shouldn't be called for deployment)
        expect(fs.writeFileSync).not.toHaveBeenCalled();

        // Check that appropriate warning was logged
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Cannot deploy: Besu network is not available"));
    });

    it("should warn but continue deployment when Azure credentials are missing", async () => {
        // Remove Azure credentials but keep Besu endpoint
        delete process.env.AZURE_SUBSCRIPTION_ID;
        process.env.DEPLOY_TO_AZURE = "true";

        const consoleLogSpy = vi.spyOn(console, "log");

        const configurator = new BesuConfigurator();
        await configurator.deploy("test/besu-config.json");

        // Verify deployment was executed despite missing Azure credentials
        expect(fs.writeFileSync).toHaveBeenCalled();

        // Check that appropriate warning was logged
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Azure credentials not found but DEPLOY_TO_AZURE is set"));
    });

    it("rollback finds and uses the correct version file", async () => {
        const configurator = new BesuConfigurator();
        await configurator.rollbackToVersion("2025-01-01");

        // Verify correct file operations were performed
        expect(fs.readdirSync).toHaveBeenCalled();
        expect(fs.readFileSync).toHaveBeenCalled();
    });

    it("should skip rollback when Besu is not available", async () => {
        // Remove Besu endpoint from environment
        delete process.env.BESU_ENDPOINT;

        const consoleLogSpy = vi.spyOn(console, "log");

        const configurator = new BesuConfigurator();
        await configurator.rollbackToVersion("2025-01-01");

        // Verify rollback was not executed (readFileSync shouldn't be called for rollback payload)
        expect(fs.readdirSync).not.toHaveBeenCalled();

        // Check that appropriate warning was logged
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Cannot rollback: Besu network is not available"));
    });
});