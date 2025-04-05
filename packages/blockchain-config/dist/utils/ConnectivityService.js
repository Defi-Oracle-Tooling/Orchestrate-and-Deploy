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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectivityService = void 0;
const fs = __importStar(require("fs"));
const chalk_1 = __importDefault(require("chalk"));
const identity_1 = require("@azure/identity");
const arm_compute_1 = require("@azure/arm-compute");
const keyvault_secrets_1 = require("@azure/keyvault-secrets");
const TelemetryService_1 = require("./TelemetryService");
const RetryUtils_1 = require("./RetryUtils");
/**
 * ConnectivityService provides centralized connectivity checking and validation
 * across the application to ensure consistent handling of credentials and connections.
 */
class ConnectivityService {
    /**
     * Gets the default Azure credential, initializing it if necessary
     * @returns The default Azure credential
     */
    static getAzureCredential() {
        if (!this.azureCredential) {
            try {
                this.azureCredential = new identity_1.DefaultAzureCredential();
                console.log(chalk_1.default.green('✅ Azure credential initialized'));
            }
            catch (error) {
                console.log(chalk_1.default.red(`❌ Failed to initialize Azure credential: ${error instanceof Error ? error.message : String(error)}`));
                throw error;
            }
        }
        return this.azureCredential;
    }
    /**
     * Perform pre-flight checks for connectivity requirements
     * @returns ConnectionState with information about available connections
     */
    static async checkConnections() {
        const state = {
            azureConnected: false,
            besuAvailable: false,
            messages: []
        };
        // Check Azure connectivity
        const azureSubscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
        const azureTenantId = process.env.AZURE_TENANT_ID;
        if (!azureSubscriptionId || !azureTenantId) {
            state.messages.push('Azure credentials missing. Set AZURE_SUBSCRIPTION_ID and AZURE_TENANT_ID environment variables.');
            state.azureConnected = false;
        }
        else {
            try {
                state.azureConnected = await this.checkAzureConnection();
                TelemetryService_1.TelemetryService.trackMetric('AzureConnectivity', state.azureConnected ? 1 : 0);
            }
            catch (error) {
                state.azureConnected = false;
                state.messages.push(`Azure connectivity check failed: ${error instanceof Error ? error.message : String(error)}`);
                TelemetryService_1.TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                    connectionCheck: 'Azure'
                });
            }
        }
        // Check Besu connectivity
        try {
            const besuEndpoint = await this.getBesuEndpoint();
            if (!besuEndpoint) {
                state.messages.push('Besu endpoint not configured. Set BESU_ENDPOINT environment variable or configure in Key Vault.');
                state.besuAvailable = false;
            }
            else {
                state.besuAvailable = await this.checkBesuConnectivity(besuEndpoint);
                TelemetryService_1.TelemetryService.trackMetric('BesuConnectivity', state.besuAvailable ? 1 : 0);
            }
        }
        catch (error) {
            state.besuAvailable = false;
            state.messages.push(`Besu connectivity check failed: ${error instanceof Error ? error.message : String(error)}`);
            TelemetryService_1.TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                connectionCheck: 'Besu'
            });
        }
        return state;
    }
    /**
     * Verifies if a specific file exists
     * @param filePath Path to file to check
     * @param errorMessage Optional custom error message
     * @returns boolean indicating if file exists
     */
    static verifyFileExists(filePath, errorMessage) {
        if (!fs.existsSync(filePath)) {
            console.error(chalk_1.default.red(`❌ ${errorMessage || `File not found: ${filePath}`}`));
            return false;
        }
        return true;
    }
    /**
     * Checks Azure API connectivity
     * @returns boolean indicating if Azure APIs are accessible
     */
    static async checkAzureConnection() {
        const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
        if (!subscriptionId) {
            console.log(chalk_1.default.yellow("⚠️ AZURE_SUBSCRIPTION_ID not set"));
            return false;
        }
        try {
            // Use executeWithRetry for better resiliency
            await (0, RetryUtils_1.executeWithRetry)(async () => {
                const credential = this.getAzureCredential();
                // Try to access a lightweight Azure API to verify connectivity
                const computeClient = new arm_compute_1.ComputeManagementClient(credential, subscriptionId);
                // Just call list with minimal parameters
                const result = await computeClient.resourceSkus.list();
                // Check if we have at least one result
                let hasValue = false;
                // Get the first item to verify we can access the data
                for await (const item of result) {
                    hasValue = true;
                    break;
                }
                return hasValue;
            }, {
                maxRetries: 2,
                initialDelayMs: 500,
                operationName: 'CheckAzureConnection'
            });
            console.log(chalk_1.default.green('✅ Azure connection verified'));
            return true;
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Azure connection failed: ${error instanceof Error ? error.message : String(error)}`));
            return false;
        }
    }
    /**
     * Check Azure Resource Health
     * @returns boolean indicating if critical Azure services are healthy
     */
    static async checkAzureResourceHealth() {
        const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
        if (!subscriptionId) {
            return false;
        }
        try {
            const credential = this.getAzureCredential();
            // Temporary implementation without ResourceHealthClient
            // Since this API appears to be having compatibility issues
            console.log(chalk_1.default.blue('Checking Azure resource health...'));
            // For now we'll return a basic check of Azure services
            // This could be enhanced with a more direct health check in the future
            return await this.checkAzureConnection();
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to check Azure resource health: ${error instanceof Error ? error.message : String(error)}`));
            TelemetryService_1.TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'CheckAzureResourceHealth'
            });
            return false;
        }
    }
    /**
     * Fetches Besu endpoint from environment or Key Vault
     * @returns Besu endpoint URL or null if not configured
     */
    static async getBesuEndpoint() {
        // First check environment variable
        const envBesuEndpoint = process.env.BESU_ENDPOINT;
        if (envBesuEndpoint) {
            return envBesuEndpoint;
        }
        // Try to get from Key Vault if configured
        const keyVaultName = process.env.KEY_VAULT_NAME;
        const secretName = process.env.BESU_ENDPOINT_SECRET_NAME || 'besu-endpoint';
        if (!keyVaultName) {
            // Key Vault not configured, return null
            return null;
        }
        try {
            const credential = this.getAzureCredential();
            const url = `https://${keyVaultName}.vault.azure.net`;
            const client = new keyvault_secrets_1.SecretClient(url, credential);
            // Use executeWithRetry for better resiliency
            const secret = await (0, RetryUtils_1.executeWithRetry)(() => client.getSecret(secretName), {
                maxRetries: 2,
                operationName: 'GetBesuEndpointFromKeyVault'
            });
            if (secret.value) {
                console.log(chalk_1.default.green('✅ Retrieved Besu endpoint from Key Vault'));
                return secret.value;
            }
            return null;
        }
        catch (error) {
            console.log(chalk_1.default.yellow(`⚠️ Failed to retrieve Besu endpoint from Key Vault: ${error instanceof Error ? error.message : String(error)}`));
            TelemetryService_1.TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'GetBesuEndpointFromKeyVault'
            });
            return null;
        }
    }
    /**
     * Checks Besu blockchain connectivity
     * @param endpoint The Besu endpoint to check (HTTP URL)
     * @returns boolean indicating if Besu network is reachable
     */
    static async checkBesuConnectivity(endpoint) {
        try {
            // This would be replaced with actual Besu client library in production
            // For now, we'll just do a simple fetch to check if the endpoint responds
            // Use executeWithRetry for better resiliency
            await (0, RetryUtils_1.executeWithRetry)(async () => {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'net_version',
                        params: [],
                        id: 1
                    })
                });
                if (!response.ok) {
                    throw new Error(`Besu responded with status: ${response.status}`);
                }
                const data = await response.json();
                return data;
            }, {
                maxRetries: 2,
                initialDelayMs: 500,
                operationName: 'CheckBesuConnectivity'
            });
            console.log(chalk_1.default.green(`✅ Successfully connected to Besu at ${endpoint}`));
            return true;
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to connect to Besu at ${endpoint}: ${error instanceof Error ? error.message : String(error)}`));
            return false;
        }
    }
    /**
     * Log connectivity status with appropriate colors
     * @param state ConnectionState to log
     */
    static logConnectionStatus(state) {
        console.log(chalk_1.default.blue('🌐 Connectivity Status:'));
        console.log(`   - Azure API: ${state.azureConnected ? chalk_1.default.green('Connected') : chalk_1.default.yellow('Disconnected')}`);
        console.log(`   - Besu Chain: ${state.besuAvailable ? chalk_1.default.green('Available') : chalk_1.default.yellow('Unavailable')}`);
        if (state.messages.length > 0) {
            console.log(chalk_1.default.yellow('⚠️ Warnings:'));
            state.messages.forEach(msg => console.log(`   - ${msg}`));
        }
        // Track connectivity status as events
        TelemetryService_1.TelemetryService.trackEvent('ConnectivityStatus', {
            azure: state.azureConnected ? 'connected' : 'disconnected',
            besu: state.besuAvailable ? 'available' : 'unavailable',
            warningCount: state.messages.length.toString()
        });
    }
}
exports.ConnectivityService = ConnectivityService;
ConnectivityService.azureCredential = null;
