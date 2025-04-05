"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const BesuConfigurator_1 = require("./BesuConfigurator");
const fs = __importStar(require("fs"));
vitest_1.vi.mock("fs");
(0, vitest_1.describe)("BesuConfigurator", () => {
    // Save original environment and process.env
    const originalEnv = { ...process.env };
    (0, vitest_1.beforeEach)(() => {
        // Mock filesystem functions
        vitest_1.vi.mocked(fs.existsSync).mockReturnValue(true);
        // Fix the mockImplementation return type to match what fs.mkdirSync should return
        vitest_1.vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
        vitest_1.vi.mocked(fs.readFileSync).mockImplementation(() => "{}");
        vitest_1.vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
        // Fix the readdirSync return type to use string[] instead of Dirent[]
        vitest_1.vi.mocked(fs.readdirSync).mockReturnValue(["besu-config-2025-01-01T00-00-00.json"]);
        // Set up environment for testing
        process.env.BESU_ENDPOINT = "http://localhost:8545";
        process.env.AZURE_SUBSCRIPTION_ID = "test-subscription";
        process.env.AZURE_TENANT_ID = "test-tenant";
        process.env.AZURE_CLIENT_ID = "test-client";
    });
    (0, vitest_1.afterEach)(() => {
        // Restore environment after each test
        process.env = { ...originalEnv };
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)("deploy writes versioned config when all pre-flight checks pass", async () => {
        const configurator = new BesuConfigurator_1.BesuConfigurator();
        await configurator.deploy("test/besu-config.json");
        (0, vitest_1.expect)(fs.writeFileSync).toHaveBeenCalled();
    });
    (0, vitest_1.it)("should skip deployment when Besu is not available", async () => {
        // Remove Besu endpoint from environment
        delete process.env.BESU_ENDPOINT;
        // Create spy for console.log to check for warning messages
        const consoleLogSpy = vitest_1.vi.spyOn(console, "log");
        const configurator = new BesuConfigurator_1.BesuConfigurator();
        await configurator.deploy("test/besu-config.json");
        // Verify deployment was not executed (writeFileSync shouldn't be called for deployment)
        (0, vitest_1.expect)(fs.writeFileSync).not.toHaveBeenCalled();
        // Check that appropriate warning was logged
        (0, vitest_1.expect)(consoleLogSpy).toHaveBeenCalledWith(vitest_1.expect.stringContaining("Cannot deploy: Besu network is not available"));
    });
    (0, vitest_1.it)("should warn but continue deployment when Azure credentials are missing", async () => {
        // Remove Azure credentials but keep Besu endpoint
        delete process.env.AZURE_SUBSCRIPTION_ID;
        process.env.DEPLOY_TO_AZURE = "true";
        const consoleLogSpy = vitest_1.vi.spyOn(console, "log");
        const configurator = new BesuConfigurator_1.BesuConfigurator();
        await configurator.deploy("test/besu-config.json");
        // Verify deployment was executed despite missing Azure credentials
        (0, vitest_1.expect)(fs.writeFileSync).toHaveBeenCalled();
        // Check that appropriate warning was logged
        (0, vitest_1.expect)(consoleLogSpy).toHaveBeenCalledWith(vitest_1.expect.stringContaining("Azure credentials not found but DEPLOY_TO_AZURE is set"));
    });
    (0, vitest_1.it)("rollback finds and uses the correct version file", async () => {
        const configurator = new BesuConfigurator_1.BesuConfigurator();
        await configurator.rollbackToVersion("2025-01-01");
        // Verify correct file operations were performed
        (0, vitest_1.expect)(fs.readdirSync).toHaveBeenCalled();
        (0, vitest_1.expect)(fs.readFileSync).toHaveBeenCalled();
    });
    (0, vitest_1.it)("should skip rollback when Besu is not available", async () => {
        // Remove Besu endpoint from environment
        delete process.env.BESU_ENDPOINT;
        const consoleLogSpy = vitest_1.vi.spyOn(console, "log");
        const configurator = new BesuConfigurator_1.BesuConfigurator();
        await configurator.rollbackToVersion("2025-01-01");
        // Verify rollback was not executed (readFileSync shouldn't be called for rollback payload)
        (0, vitest_1.expect)(fs.readdirSync).not.toHaveBeenCalled();
        // Check that appropriate warning was logged
        (0, vitest_1.expect)(consoleLogSpy).toHaveBeenCalledWith(vitest_1.expect.stringContaining("Cannot rollback: Besu network is not available"));
    });
});
