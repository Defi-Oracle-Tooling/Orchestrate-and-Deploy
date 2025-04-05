import * as fs from "fs";
import chalk from "chalk";
import { DefaultAzureCredential } from "@azure/identity";
import { ComputeManagementClient, ResourceSku } from "@azure/arm-compute";
import { SecretClient } from "@azure/keyvault-secrets";
import { TelemetryService } from "./TelemetryService";
import { executeWithRetry } from "./RetryUtils";

/**
 * ConnectionState stores information about various connectivity requirements
 * for different services in the application.
 */
export interface ConnectionState {
    /** Indicates if Azure API connectivity is available */
    azureConnected: boolean;

    /** Indicates if Besu blockchain connectivity is available */
    besuAvailable: boolean;

    /** Any warnings or error messages during connection checks */
    messages: string[];
}

/**
 * ConnectivityService provides centralized connectivity checking and validation
 * across the application to ensure consistent handling of credentials and connections.
 */
export class ConnectivityService {
    private static azureCredential: DefaultAzureCredential | null = null;

    /**
     * Gets the default Azure credential, initializing it if necessary
     * @returns The default Azure credential
     */
    public static getAzureCredential(): DefaultAzureCredential {
        if (!this.azureCredential) {
            try {
                this.azureCredential = new DefaultAzureCredential();
                console.log(chalk.green('✅ Azure credential initialized'));
            } catch (error) {
                console.log(chalk.red(`❌ Failed to initialize Azure credential: ${error instanceof Error ? error.message : String(error)}`));
                throw error;
            }
        }
        return this.azureCredential;
    }

    /**
     * Perform pre-flight checks for connectivity requirements
     * @returns ConnectionState with information about available connections
     */
    public static async checkConnections(): Promise<ConnectionState> {
        const state: ConnectionState = {
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
        } else {
            try {
                state.azureConnected = await this.checkAzureConnection();
                TelemetryService.trackMetric('AzureConnectivity', state.azureConnected ? 1 : 0);
            } catch (error) {
                state.azureConnected = false;
                state.messages.push(`Azure connectivity check failed: ${error instanceof Error ? error.message : String(error)}`);
                TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
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
            } else {
                state.besuAvailable = await this.checkBesuConnectivity(besuEndpoint);
                TelemetryService.trackMetric('BesuConnectivity', state.besuAvailable ? 1 : 0);
            }
        } catch (error) {
            state.besuAvailable = false;
            state.messages.push(`Besu connectivity check failed: ${error instanceof Error ? error.message : String(error)}`);
            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
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
    public static verifyFileExists(filePath: string, errorMessage?: string): boolean {
        if (!fs.existsSync(filePath)) {
            console.error(chalk.red(`❌ ${errorMessage || `File not found: ${filePath}`}`));
            return false;
        }
        return true;
    }

    /**
     * Checks Azure API connectivity
     * @returns boolean indicating if Azure APIs are accessible
     */
    public static async checkAzureConnection(): Promise<boolean> {
        const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;

        if (!subscriptionId) {
            console.log(chalk.yellow("⚠️ AZURE_SUBSCRIPTION_ID not set"));
            return false;
        }

        try {
            // Use executeWithRetry for better resiliency
            await executeWithRetry(async () => {
                const credential = this.getAzureCredential();

                // Try to access a lightweight Azure API to verify connectivity
                const computeClient = new ComputeManagementClient(credential, subscriptionId);

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

            console.log(chalk.green('✅ Azure connection verified'));
            return true;
        } catch (error) {
            console.log(chalk.red(`❌ Azure connection failed: ${error instanceof Error ? error.message : String(error)}`));
            return false;
        }
    }

    /**
     * Check Azure Resource Health
     * @returns boolean indicating if critical Azure services are healthy
     */
    public static async checkAzureResourceHealth(): Promise<boolean> {
        const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;

        if (!subscriptionId) {
            return false;
        }

        try {
            const credential = this.getAzureCredential();

            // Temporary implementation without ResourceHealthClient
            // Since this API appears to be having compatibility issues
            console.log(chalk.blue('Checking Azure resource health...'));

            // For now we'll return a basic check of Azure services
            // This could be enhanced with a more direct health check in the future
            return await this.checkAzureConnection();

        } catch (error) {
            console.log(chalk.red(`❌ Failed to check Azure resource health: ${error instanceof Error ? error.message : String(error)}`));
            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'CheckAzureResourceHealth'
            });
            return false;
        }
    }

    /**
     * Fetches Besu endpoint from environment or Key Vault
     * @returns Besu endpoint URL or null if not configured
     */
    public static async getBesuEndpoint(): Promise<string | null> {
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
            const client = new SecretClient(url, credential);

            // Use executeWithRetry for better resiliency
            const secret = await executeWithRetry(
                () => client.getSecret(secretName),
                {
                    maxRetries: 2,
                    operationName: 'GetBesuEndpointFromKeyVault'
                }
            );

            if (secret.value) {
                console.log(chalk.green('✅ Retrieved Besu endpoint from Key Vault'));
                return secret.value;
            }

            return null;
        } catch (error) {
            console.log(chalk.yellow(`⚠️ Failed to retrieve Besu endpoint from Key Vault: ${error instanceof Error ? error.message : String(error)}`));
            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
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
    public static async checkBesuConnectivity(endpoint: string): Promise<boolean> {
        try {
            // This would be replaced with actual Besu client library in production
            // For now, we'll just do a simple fetch to check if the endpoint responds

            // Use executeWithRetry for better resiliency
            await executeWithRetry(
                async () => {
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
                },
                {
                    maxRetries: 2,
                    initialDelayMs: 500,
                    operationName: 'CheckBesuConnectivity'
                }
            );

            console.log(chalk.green(`✅ Successfully connected to Besu at ${endpoint}`));
            return true;
        } catch (error) {
            console.log(chalk.red(`❌ Failed to connect to Besu at ${endpoint}: ${error instanceof Error ? error.message : String(error)}`));
            return false;
        }
    }

    /**
     * Log connectivity status with appropriate colors
     * @param state ConnectionState to log
     */
    public static logConnectionStatus(state: ConnectionState): void {
        console.log(chalk.blue('🌐 Connectivity Status:'));
        console.log(`   - Azure API: ${state.azureConnected ? chalk.green('Connected') : chalk.yellow('Disconnected')}`);
        console.log(`   - Besu Chain: ${state.besuAvailable ? chalk.green('Available') : chalk.yellow('Unavailable')}`);

        if (state.messages.length > 0) {
            console.log(chalk.yellow('⚠️ Warnings:'));
            state.messages.forEach(msg => console.log(`   - ${msg}`));
        }

        // Track connectivity status as events
        TelemetryService.trackEvent('ConnectivityStatus', {
            azure: state.azureConnected ? 'connected' : 'disconnected',
            besu: state.besuAvailable ? 'available' : 'unavailable',
            warningCount: state.messages.length.toString()
        });
    }
}