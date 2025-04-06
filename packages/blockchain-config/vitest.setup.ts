import { beforeEach, afterEach, vi } from 'vitest';

// Mock filesystem functions
vi.mock('fs', () => ({
    writeFileSync: vi.fn(),
    readFileSync: vi.fn().mockReturnValue('{}'),
    readdirSync: vi.fn().mockReturnValue(['besu-config-2025-01-01T00-00-00.json']),
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    statSync: vi.fn(),
}));

// Mock process.env
const originalEnv = { ...process.env };
beforeEach(() => {
    // Set default test environment variables
    process.env.BESU_ENDPOINT = 'http://localhost:8545';
    process.env.AZURE_SUBSCRIPTION_ID = 'test-subscription';
    process.env.AZURE_TENANT_ID = 'test-tenant';
    process.env.AZURE_CLIENT_ID = 'test-client';

    // Reset all mocks before each test
    vi.resetAllMocks();
});

afterEach(() => {
    // Restore original environment after each test
    process.env = { ...originalEnv };
    vi.clearAllMocks();
});