import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import { BesuConfigurator } from "./BesuConfigurator";
import * as fs from "fs";
import * as path from "path";
import { ConnectivityService } from "../utils/ConnectivityService";
import { executeWithRetry } from "../utils/RetryUtils";

// Mock fs module completely
vi.mock("fs", () => {
    return {
        writeFileSync: vi.fn(),
        readFileSync: vi.fn().mockReturnValue("{}"),
        readdirSync: vi.fn().mockReturnValue(["besu-config-2025-01-01T00-00-00.json"]),
        existsSync: vi.fn().mockReturnValue(true),
        mkdirSync: vi.fn(),
        statSync: vi.fn().mockReturnValue({ isDirectory: () => true })
    };
});

// Mock path operations
vi.mock("path", () => ({
    join: vi.fn().mockImplementation((...args) => args.join("/")),
    extname: vi.fn().mockReturnValue(".json"),
    dirname: vi.fn().mockReturnValue("test-dir")
}));

// Mock ConnectivityService
vi.mock("../utils/ConnectivityService", () => ({
    ConnectivityService: {
        checkConnections: vi.fn().mockResolvedValue({
            azureConnected: true,
            besuAvailable: true,
            messages: []
        }),
        verifyFileExists: vi.fn().mockReturnValue(true),
        logConnectionStatus: vi.fn()
    }
}));

// Mock TelemetryService
vi.mock("../utils/TelemetryService", () => ({
    TelemetryService: {
        trackEvent: vi.fn(),
        trackException: vi.fn(),
        initialize: vi.fn()
    }
}));

// Mock executeWithRetry to directly execute the function
vi.mock("../utils/RetryUtils", () => ({
    executeWithRetry: vi.fn().mockImplementation(async (fn) => {
        try {
            return await fn();
        } catch (error) {
            console.error("Error in executeWithRetry mock:", error);
            throw error;
        }
    })
}));

describe("BesuConfigurator", () => {
    // Save original environment
    const originalEnv = { ...process.env };

    beforeEach(() => {
        // Reset all mocks
        vi.resetAllMocks();

        // Set default mock returns
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue("{}");
        vi.mocked(fs.readdirSync).mockReturnValue(["besu-config-2025-01-01T00-00-00.json"]);

        // Set default environment variables
        process.env.BESU_ENDPOINT = "http://localhost:8545";
        process.env.AZURE_SUBSCRIPTION_ID = "test-subscription";
        process.env.AZURE_TENANT_ID = "test-tenant";
        process.env.AZURE_CLIENT_ID = "test-client";

        // Set up default mock behavior
        vi.mocked(ConnectivityService.checkConnections).mockResolvedValue({
            azureConnected: true,
            besuAvailable: true,
            messages: []
        });
    });

    afterEach(() => {
        // Restore original environment
        process.env = { ...originalEnv };
        vi.clearAllMocks();
    });

    it("deploy writes versioned config when all pre-flight checks pass", async () => {
        const configurator = new BesuConfigurator();
        await configurator.initialize();
        await configurator.deploy("test/besu-config.json");

        // Verify writeFileSync was called for deployment
        expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it("should skip deployment when Besu is not available", async () => {
        // Mock Besu as unavailable
        vi.mocked(ConnectivityService.checkConnections).mockResolvedValue({
            azureConnected: true,
            besuAvailable: false,
            messages: ["Besu network not available"]
        });

        const consoleLogSpy = vi.spyOn(console, "log");

        const configurator = new BesuConfigurator();
        await configurator.initialize();
        await configurator.deploy("test/besu-config.json");

        // Verify deployment was not executed
        expect(fs.writeFileSync).not.toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Cannot deploy"));
    });

    it("should warn but continue deployment when Azure credentials are missing", async () => {
        // Mock Azure as unavailable
        vi.mocked(ConnectivityService.checkConnections).mockResolvedValue({
            azureConnected: false,
            besuAvailable: true,
            messages: ["Azure credentials missing"]
        });

        // Set DEPLOY_TO_AZURE env var
        process.env.DEPLOY_TO_AZURE = "true";

        const consoleLogSpy = vi.spyOn(console, "log");

        const configurator = new BesuConfigurator();
        await configurator.initialize();
        await configurator.deploy("test/besu-config.json");

        // Verify deployment was executed despite missing Azure credentials
        expect(fs.writeFileSync).toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Azure credentials not found"));
    });

    it("rollback finds and uses the correct version file", async () => {
        const configurator = new BesuConfigurator();
        await configurator.initialize();
        await configurator.rollbackToVersion("2025-01-01");

        // Verify correct file operations were performed
        expect(fs.readdirSync).toHaveBeenCalled();
        expect(fs.readFileSync).toHaveBeenCalled();
    });

    it("should skip rollback when Besu is not available", async () => {
        // Mock Besu as unavailable
        vi.mocked(ConnectivityService.checkConnections).mockResolvedValue({
            azureConnected: true,
            besuAvailable: false,
            messages: ["Besu network not available"]
        });

        const consoleLogSpy = vi.spyOn(console, "log");

        const configurator = new BesuConfigurator();
        await configurator.initialize();
        await configurator.rollbackToVersion("2025-01-01");

        // Verify rollback was not executed
        expect(fs.readdirSync).not.toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Cannot rollback"));
    });
});