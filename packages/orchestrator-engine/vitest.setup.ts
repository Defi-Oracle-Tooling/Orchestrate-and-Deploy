import { beforeEach, afterEach, vi } from 'vitest';

// Mock Azure SDK services
vi.mock('@azure/identity', () => ({
    DefaultAzureCredential: vi.fn().mockImplementation(() => ({
        getToken: vi.fn().mockResolvedValue({ token: 'mock-token' }),
    })),
}));

vi.mock('@azure/arm-compute', () => ({
    ComputeManagementClient: vi.fn().mockImplementation(() => ({
        resourceSkus: {
            list: vi.fn().mockResolvedValue([
                { name: 'Standard_D2_v3', locations: ['eastus', 'westus'], capabilities: [] },
                { name: 'Standard_D4_v3', locations: ['eastus', 'westus'], capabilities: [] },
            ]),
        },
    })),
}));

// Mock Application Insights
vi.mock('applicationinsights', () => ({
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

// Reset mocks before each test
beforeEach(() => {
    vi.resetAllMocks();
});

afterEach(() => {
    vi.clearAllMocks();
});