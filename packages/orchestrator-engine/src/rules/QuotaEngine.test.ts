import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QuotaEngine } from "./QuotaEngine";
import * as fs from "fs";
import { ConnectivityService } from "../utils/ConnectivityService";

// Mock filesystem
vi.mock("fs", () => ({
    readFileSync: vi.fn().mockImplementation((path) => {
        if (path.includes("live-quotas.yaml")) {
            return `
eastus:
  Standard_D2s_v3:
    total: 100
    used: 20
    available: 80
    assigned_to: ['web', 'validator']
  Standard_D4s_v3:
    total: 50
    used: 30
    available: 20
    assigned_to: ['database', 'storage']
westus:
  Standard_D8s_v3:
    total: 10
    used: 10
    available: 0
    assigned_to: ['database', 'network']
`;
        } else if (path.includes("allocations.yaml")) {
            return "[]";
        }
        return "{}";
    }),
    writeFileSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
}));

// Mock ConnectivityService
vi.mock("../utils/ConnectivityService", () => ({
    ConnectivityService: {
        checkConnections: vi.fn().mockResolvedValue({
            azureConnected: false,
            besuAvailable: false,
            messages: []
        }),
        checkComputeServicesInRegions: vi.fn().mockResolvedValue(new Map([
            ["eastus", true],
            ["westus", true]
        ])),
        getAzureQuotaData: vi.fn().mockResolvedValue(null),
        logConnectionStatus: vi.fn()
    }
}));

// Mock chalk to avoid colorization issues in tests
vi.mock("chalk", () => ({
    default: {
        blue: (text) => `BLUE: ${text}`,
        green: (text) => `GREEN: ${text}`,
        red: (text) => `RED: ${text}`,
        yellow: (text) => `YELLOW: ${text}`,
        cyan: (text) => `CYAN: ${text}`
    }
}));

// Mock Application Insights
vi.mock("applicationinsights", () => ({
    defaultClient: {
        trackEvent: vi.fn(),
        trackException: vi.fn(),
        trackMetric: vi.fn(),
    },
    setup: vi.fn().mockReturnValue({
        setAutoDependencyCorrelation: vi.fn().mockReturnThis(),
        setAutoCollectRequests: vi.fn().mockReturnThis(),
        setAutoCollectPerformance: vi.fn().mockReturnThis(),
        setAutoCollectExceptions: vi.fn().mockReturnThis(),
        setAutoCollectDependencies: vi.fn().mockReturnThis(),
        setAutoCollectConsole: vi.fn().mockReturnThis(),
        setUseDiskRetryCaching: vi.fn().mockReturnThis(),
        start: vi.fn().mockReturnThis(),
    }),
}));

// Mock Azure SDK
vi.mock("@azure/identity", () => ({
    DefaultAzureCredential: vi.fn().mockImplementation(() => ({
        getToken: vi.fn().mockResolvedValue({ token: 'mock-token' }),
    })),
}));

vi.mock("@azure/arm-compute", () => ({
    ComputeManagementClient: vi.fn().mockImplementation(() => ({
        resourceSkus: {
            list: vi.fn().mockResolvedValue([
                { name: 'Standard_D2s_v3', locations: ['eastus'], capacity: [], restrictions: [] },
                { name: 'Standard_D4s_v3', locations: ['eastus'], capacity: [], restrictions: [] },
                { name: 'Standard_D8s_v3', locations: ['westus'], capacity: [], restrictions: [] },
            ]),
        },
    })),
}));

// Mock the TelemetryService 
vi.mock("../utils/TelemetryService", () => ({
    TelemetryService: {
        trackEvent: vi.fn(),
        trackException: vi.fn(),
        trackMetric: vi.fn(),
        initialize: vi.fn(),
    }
}));

describe("QuotaEngine", () => {
    let originalEnv;
    let consoleLogSpy;

    beforeEach(() => {
        originalEnv = { ...process.env };
        process.env.AZURE_SUBSCRIPTION_ID = undefined;
        process.env.AZURE_TENANT_ID = undefined;
        consoleLogSpy = vi.spyOn(console, 'log');
        vi.clearAllMocks();
    });

    afterEach(() => {
        process.env = originalEnv;
        consoleLogSpy.mockRestore();
    });

    it("should validate quota when enough is available", async () => {
        const engine = new QuotaEngine();
        const result = await engine.validateQuota("eastus", "web", 1);
        expect(result).toBe(true);
    });

    it("should not validate quota when not enough is available", async () => {
        const engine = new QuotaEngine();
        const result = await engine.validateQuota("westus", "database", 1);
        expect(result).toBe(false);
    });

    it("should not validate quota for non-existent region", async () => {
        const engine = new QuotaEngine();
        const result = await engine.validateQuota("centralus", "web", 1);
        expect(result).toBe(false);
    });

    it("should warn when using cached data due to missing Azure credentials", async () => {
        // Create a new instance and run the validation
        const engine = new QuotaEngine();
        await engine.initialize(); // Make sure we initialize
        await engine.validateQuota("eastus", "web", 1);

        // Check that the warning about cached data was logged 
        // It uses console.log with yellow chalk
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Using cached quota data"));
    });

    it("should fail to refresh quota data when Azure credentials are missing", async () => {
        const engine = new QuotaEngine();
        await engine.initialize();
        const result = await engine.refreshQuotaData();
        expect(result).toBe(false);
    });

    it("should attempt to refresh quota data when credentials are available", async () => {
        // Set Azure credentials for this test
        process.env.AZURE_SUBSCRIPTION_ID = "test-subscription";
        process.env.AZURE_TENANT_ID = "test-tenant";

        // Mock the ConnectivityService to return successful connection
        vi.mocked(ConnectivityService.checkConnections).mockResolvedValueOnce({
            azureConnected: true,
            besuAvailable: false,
            messages: []
        });

        const engine = new QuotaEngine();
        await engine.initialize();
        const result = await engine.refreshQuotaData();

        // This will still be false because getAzureQuotaData returns null in our mock
        expect(result).toBe(false);
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to refresh quota data"));
    });

    it("should throw an error if quota file doesn't exist", async () => {
        vi.mocked(fs.existsSync).mockReturnValueOnce(false);
        expect(() => new QuotaEngine()).toThrow();
    });
});