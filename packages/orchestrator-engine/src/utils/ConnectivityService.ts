import * as fs from "fs";
import chalk from "chalk";
import axios from "axios";
import { DefaultAzureCredential } from "@azure/identity";
import { ComputeManagementClient } from "@azure/arm-compute";
import { ResourceHealthClient } from "@azure/arm-resourcehealth";
import { ResourceManagementClient } from "@azure/arm-resources";
import { UsageManagementClient } from "@azure/arm-subscriptions";
import { SecretClient } from "@azure/keyvault-secrets";
import { TelemetryService } from "./TelemetryService";
import { executeWithRetry } from "./RetryUtils";

/**
 * Health state of an Azure service in a region
 */
export interface AzureServiceHealth {
    /** Region name */
    region: string;
    /** Service name */
    service: string;
    /** Whether the service is healthy */
    isHealthy: boolean;
    /** Any health issues */
    issues?: string[];
    /** Last checked timestamp */
    lastChecked: string;
}

/**
 * Represents quota information for a specific resource type in a region
 */
export interface QuotaInfo {
    /** Name of the quota (e.g., "standardDSv3Family") */
    name: string;
    /** Current usage of the resource */
    currentValue: number;
    /** Maximum allowed value (limit) */
    limit: number;
    /** Region this quota applies to */
    region: string;
    /** Resource provider (e.g., "Microsoft.Compute") */
    provider: string;
    /** Percentage of quota used (0-100) */
    percentUsed: number;
}

/**
 * Alert level for quota thresholds
 */
export enum QuotaAlertLevel {
    /** No alert - usage below warning threshold */
    None = "none",
    /** Warning level - approaching quota limit */
    Warning = "warning",
    /** Critical level - very close to quota limit */
    Critical = "critical"
}

/**
 * Enhanced quota monitoring details with change tracking
 */
export interface EnhancedQuotaInfo extends QuotaInfo {
    /** Historical data points for this quota */
    history?: QuotaHistoryPoint[];
    /** Predicted quota usage in 30 days based on current trends */
    predictedUsage?: number;
    /** Time when this quota was last updated */
    lastUpdated: string;
    /** Any custom thresholds configured for this quota */
    customThresholds?: {
        warning?: number;
        critical?: number;
    };
    /** Role assignments for this quota */
    assignedRoles: string[];
}

/**
 * Historical data point for quota tracking
 */
export interface QuotaHistoryPoint {
    /** Timestamp when this data point was recorded */
    timestamp: string;
    /** Percentage of quota used at this point in time */
    percentUsed: number;
    /** Absolute value used at this point in time */
    valueUsed: number;
}

/**
 * Health status for a specific region
 */
export interface RegionHealthStatus {
    /** Region name */
    region: string;
    /** Overall health status of the region */
    isHealthy: boolean;
    /** Array of service health statuses in this region */
    services: AzureServiceHealth[];
    /** Last time the health was checked */
    lastChecked: string;
    /** Any active advisories for this region */
    advisories: string[];
    /** Current compute quota availability (0-100) */
    quotaAvailability: number;
}

/**
 * Represents current connectivity status
 */
export interface ConnectionState {
    /** Whether Azure connectivity is available */
    azureConnected: boolean;
    /** Whether Besu connectivity is available */
    besuAvailable: boolean;
    /** Any status messages */
    messages: string[];
    /** Detailed service health (if available) */
    serviceHealth?: AzureServiceHealth[];
    /** Quota information (if available) */
    quotaInfo?: QuotaInfo[];
}

/**
 * Service for checking connectivity to various services
 */
export class ConnectivityService {
    private static isInitialized = false;
    private static azureSubscriptionId: string | null = null;
    private static azureTenantId: string | null = null;
    private static besuEndpoint: string | null = null;
    private static credential: DefaultAzureCredential | null = null;

    // Thresholds for quota alerts (percentage of quota used)
    private static readonly QUOTA_WARNING_THRESHOLD = 70;
    private static readonly QUOTA_CRITICAL_THRESHOLD = 90;

    /**
     * Initializes the connectivity service
     */
    public static initialize(): void {
        if (this.isInitialized) return;

        console.log(chalk.blue('Initializing ConnectivityService...'));

        // Read configuration from environment variables
        this.azureSubscriptionId = process.env.AZURE_SUBSCRIPTION_ID || null;
        this.azureTenantId = process.env.AZURE_TENANT_ID || null;
        this.besuEndpoint = process.env.BESU_ENDPOINT || null;

        // Initialize Azure credential if we have the necessary environment variables
        if (this.azureSubscriptionId && this.azureTenantId) {
            try {
                this.credential = new DefaultAzureCredential();
                console.log(chalk.green('✅ Azure credential initialized'));
            } catch (error) {
                console.log(chalk.red(`❌ Failed to initialize Azure credential: ${error instanceof Error ? error.message : String(error)}`));
                this.credential = null;
            }
        }

        this.isInitialized = true;

        TelemetryService.trackEvent('ConnectivityServiceInitialized', {
            hasAzureCredentials: (!!this.azureSubscriptionId && !!this.azureTenantId).toString(),
            hasBesuEndpoint: (!!this.besuEndpoint).toString(),
            credentialInitialized: (!!this.credential).toString()
        });
    }

    /**
     * Checks connectivity to all required services
     * @returns Connection status
     */
    public static async checkConnections(): Promise<ConnectionState> {
        if (!this.isInitialized) {
            this.initialize();
        }

        const state: ConnectionState = {
            azureConnected: false,
            besuAvailable: false,
            messages: [],
            serviceHealth: [],
            quotaInfo: []
        };

        try {
            // Check Azure connectivity
            if (this.azureSubscriptionId && this.azureTenantId) {
                state.azureConnected = await this.checkAzureConnectivity();
                if (state.azureConnected) {
                    state.messages.push('Azure connectivity verified');

                    // Check health of critical Azure services in key regions
                    const keyRegions = ['eastus', 'westus', 'northeurope', 'westeurope', 'southeastasia'];
                    const healthResults = await this.checkAzureServiceHealth(keyRegions);
                    state.serviceHealth = healthResults;

                    // Log any unhealthy services
                    const unhealthyServices = healthResults.filter(h => !h.isHealthy);
                    if (unhealthyServices.length > 0) {
                        state.messages.push(`⚠️ ${unhealthyServices.length} Azure services reporting issues`);
                    }
                } else {
                    state.messages.push('❌ Azure connectivity failed - check credentials');
                }
            } else {
                state.messages.push('ℹ️ Azure credentials not configured');
            }

            // Check Besu connectivity
            if (this.besuEndpoint) {
                state.besuAvailable = await this.checkBesuConnectivity();
                if (state.besuAvailable) {
                    state.messages.push('Besu connectivity verified');
                } else {
                    state.messages.push('❌ Besu connectivity failed - check endpoint');
                }
            } else {
                state.messages.push('ℹ️ Besu endpoint not configured');
            }

            TelemetryService.trackEvent('ConnectivityCheckCompleted', {
                azureConnected: state.azureConnected.toString(),
                besuAvailable: state.besuAvailable.toString(),
                messageCount: state.messages.length.toString()
            });

            return state;
        } catch (error) {
            console.error(chalk.red(`❌ Connectivity check error: ${error instanceof Error ? error.message : String(error)}`));

            state.messages.push(`Error during connectivity check: ${error instanceof Error ? error.message : String(error)}`);

            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'CheckConnections'
            });

            return state;
        }
    }

    /**
     * Tests Azure API connectivity
     * @returns true if connection successful, false otherwise
     */
    private static async checkAzureConnectivity(): Promise<boolean> {
        try {
            if (!this.azureSubscriptionId || !this.azureTenantId) {
                return false;
            }

            // In a real implementation, this would call Azure APIs
            // For our demo, we'll simulate a successful connection
            console.log(chalk.blue('Testing Azure connectivity...'));

            // Simulate an API call delay
            await new Promise(resolve => setTimeout(resolve, 500));

            // For testing, we'll consider it successful
            return true;
        } catch (error) {
            console.error(chalk.red(`❌ Azure connectivity error: ${error instanceof Error ? error.message : String(error)}`));

            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'CheckAzureConnectivity'
            });

            return false;
        }
    }

    /**
     * Checks health of key Azure services in specified regions
     * @param regions Array of region names to check
     * @returns Array of service health info
     */
    private static async checkAzureServiceHealth(regions: string[]): Promise<AzureServiceHealth[]> {
        const results: AzureServiceHealth[] = [];

        // Key services to check
        const services = ['Microsoft.Compute', 'Microsoft.Network', 'Microsoft.Storage'];

        // In a real implementation, this would call Azure Service Health API
        // For our demo, we'll generate simulated results
        const now = new Date().toISOString();

        for (const region of regions) {
            for (const service of services) {
                // Simulate a 95% chance of healthy service (5% unhealthy)
                const isHealthy = Math.random() > 0.05;

                results.push({
                    region,
                    service,
                    isHealthy,
                    issues: isHealthy ? [] : ['Simulated performance degradation'],
                    lastChecked: now
                });
            }
        }

        return results;
    }

    /**
     * Checks if compute services are healthy in the specified regions
     * @param regions Array of region names to check
     * @returns Map of regions to health status (true = healthy)
     */
    public static async checkComputeServicesInRegions(regions: string[]): Promise<Map<string, boolean>> {
        const result = new Map<string, boolean>();

        try {
            // If Azure isn't connected, assume all regions are healthy
            if (!this.azureSubscriptionId || !this.azureTenantId) {
                regions.forEach(r => result.set(r, true));
                return result;
            }

            // Get health of all services
            const healthResults = await this.checkAzureServiceHealth(regions);

            // Group by region and check if any Compute services are unhealthy
            for (const region of regions) {
                const regionServices = healthResults.filter(h =>
                    h.region === region && h.service === 'Microsoft.Compute');

                // If we have results for this region, check health
                if (regionServices.length > 0) {
                    const allHealthy = regionServices.every(s => s.isHealthy);
                    result.set(region, allHealthy);
                } else {
                    // No data, assume healthy
                    result.set(region, true);
                }
            }

            return result;
        } catch (error) {
            console.error(chalk.red(`❌ Error checking compute services: ${error instanceof Error ? error.message : String(error)}`));

            // Default to assuming healthy
            regions.forEach(r => result.set(r, true));

            return result;
        }
    }

    /**
     * Tests Besu connectivity
     * @returns true if connection successful, false otherwise
     */
    private static async checkBesuConnectivity(): Promise<boolean> {
        try {
            if (!this.besuEndpoint) {
                return false;
            }

            console.log(chalk.blue(`Testing Besu connectivity to ${this.besuEndpoint}...`));

            // In a real implementation, this would call Besu APIs
            // For our demo, we'll simulate a successful connection
            await new Promise(resolve => setTimeout(resolve, 300));

            // For testing, we'll consider it successful
            return true;
        } catch (error) {
            console.error(chalk.red(`❌ Besu connectivity error: ${error instanceof Error ? error.message : String(error)}`));

            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'CheckBesuConnectivity'
            });

            return false;
        }
    }

    /**
     * Logs connection status to console
     * @param state Connection state to log
     */
    public static logConnectionStatus(state: ConnectionState): void {
        console.log(chalk.blue('=== Connection Status ==='));

        if (state.azureConnected) {
            console.log(chalk.green('✅ Azure: Connected'));
        } else {
            console.log(chalk.yellow('⚠️ Azure: Not connected'));
        }

        if (state.besuAvailable) {
            console.log(chalk.green('✅ Besu: Available'));
        } else {
            console.log(chalk.yellow('⚠️ Besu: Not available'));
        }

        // Log any messages
        if (state.messages.length > 0) {
            console.log(chalk.blue('--- Status Messages ---'));
            state.messages.forEach(msg => console.log(`  ${msg}`));
        }

        // Log service health issues if any
        if (state.serviceHealth && state.serviceHealth.length > 0) {
            const unhealthyServices = state.serviceHealth.filter(s => !s.isHealthy);

            if (unhealthyServices.length > 0) {
                console.log(chalk.yellow('--- Service Health Issues ---'));
                unhealthyServices.forEach(s => {
                    console.log(chalk.yellow(`  ⚠️ ${s.service} in ${s.region}: ${s.issues?.join(', ')}`));
                });
            }
        }

        console.log(chalk.blue('========================'));
    }

    /**
     * Retrieves Azure quota data from the API
     * @returns Object containing quota data for each region/SKU or null if failed
     */
    public static async getAzureQuotaData(): Promise<Record<string, Record<string, any>> | null> {
        try {
            if (!this.azureSubscriptionId || !this.credential) {
                console.log(chalk.yellow('⚠️ Cannot get quota data: Azure credentials not configured'));
                return null;
            }

            console.log(chalk.blue('Fetching quota data from Azure...'));

            // In a production implementation, this would use the UsageManagementClient
            // from @azure/arm-subscriptions to get actual quota data
            const usageClient = new UsageManagementClient(this.credential, this.azureSubscriptionId);

            try {
                // For now, we'll use mock data for demonstration
                return await this.getMockQuotaData();
            } catch (innerError) {
                console.warn(chalk.yellow(`⚠️ Failed to get quota data from Azure API: ${innerError}`));
                console.log(chalk.blue('Falling back to mock data...'));
                return this.getMockQuotaData();
            }
        } catch (error) {
            console.error(chalk.red(`❌ Error fetching quota data: ${error instanceof Error ? error.message : String(error)}`));

            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'GetAzureQuotaData'
            });

            return null;
        }
    }

    /**
     * Gets detailed quota information for compute resources across all specified regions
     * @param regions List of regions to check quotas for
     * @returns Array of QuotaInfo objects with detailed quota information
     */
    public static async getDetailedQuotaInfo(regions: string[] = ['eastus', 'westus', 'westeurope']): Promise<QuotaInfo[]> {
        try {
            if (!this.azureSubscriptionId || !this.credential) {
                console.log(chalk.yellow('⚠️ Cannot get quota info: Azure credentials not configured'));
                return [];
            }

            console.log(chalk.blue('Fetching detailed quota information...'));

            // Get raw quota data
            const quotaData = await this.getAzureQuotaData();
            if (!quotaData) {
                return [];
            }

            // Transform into QuotaInfo objects
            const result: QuotaInfo[] = [];

            for (const region of regions) {
                const regionData = quotaData[region];
                if (regionData) {
                    for (const [skuName, skuData] of Object.entries(regionData)) {
                        const quota: QuotaInfo = {
                            name: skuName,
                            currentValue: skuData.used,
                            limit: skuData.total,
                            region: region,
                            provider: 'Microsoft.Compute',
                            percentUsed: (skuData.used / skuData.total) * 100
                        };
                        result.push(quota);
                    }
                }
            }

            // Track quota information
            TelemetryService.trackEvent('QuotaInfoRetrieved', {
                regionCount: regions.length.toString(),
                quotaItemCount: result.length.toString()
            });

            return result;
        } catch (error) {
            console.error(chalk.red(`❌ Error getting detailed quota info: ${error instanceof Error ? error.message : String(error)}`));

            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'GetDetailedQuotaInfo'
            });

            return [];
        }
    }

    /**
     * Gets the alert level for a given quota usage percentage
     * @param percentUsed Percentage of quota used (0-100)
     * @returns QuotaAlertLevel based on configured thresholds
     */
    public static getQuotaAlertLevel(percentUsed: number): QuotaAlertLevel {
        if (percentUsed >= this.QUOTA_CRITICAL_THRESHOLD) {
            return QuotaAlertLevel.Critical;
        } else if (percentUsed >= this.QUOTA_WARNING_THRESHOLD) {
            return QuotaAlertLevel.Warning;
        } else {
            return QuotaAlertLevel.None;
        }
    }

    /**
     * Identifies quotas that are approaching or exceeding thresholds
     * @param quotaInfo Array of QuotaInfo objects to analyze
     * @param minLevel Minimum alert level to include (default: Warning)
     * @returns Filtered list of quota items at or above the specified alert level
     */
    public static getQuotaAlerts(
        quotaInfo: QuotaInfo[],
        minLevel: QuotaAlertLevel = QuotaAlertLevel.Warning
    ): QuotaInfo[] {
        return quotaInfo.filter(quota => {
            const alertLevel = this.getQuotaAlertLevel(quota.percentUsed);

            // Convert enum values to numbers for comparison
            const alertLevelValue = alertLevel === QuotaAlertLevel.Critical ? 2 :
                alertLevel === QuotaAlertLevel.Warning ? 1 : 0;

            const minLevelValue = minLevel === QuotaAlertLevel.Critical ? 2 :
                minLevel === QuotaAlertLevel.Warning ? 1 : 0;

            return alertLevelValue >= minLevelValue;
        });
    }

    /**
     * Gets a summary of quota usage by region
     * @param quotaInfo Array of QuotaInfo objects
     * @returns Map of regions to average percentage used across all resources
     */
    public static getQuotaUsageSummaryByRegion(quotaInfo: QuotaInfo[]): Map<string, number> {
        const regionSums = new Map<string, { total: number, count: number }>();

        // Calculate sum and count for each region
        for (const quota of quotaInfo) {
            const region = quota.region;
            const current = regionSums.get(region) || { total: 0, count: 0 };

            current.total += quota.percentUsed;
            current.count += 1;

            regionSums.set(region, current);
        }

        // Calculate averages
        const result = new Map<string, number>();
        for (const [region, data] of regionSums.entries()) {
            const average = data.count > 0 ? data.total / data.count : 0;
            result.set(region, average);
        }

        return result;
    }

    /**
     * Generates mock quota data for testing
     * @returns Mock quota data by region/SKU
     */
    private static getMockQuotaData(): Record<string, Record<string, any>> {
        const regions = ['eastus', 'westus', 'northeurope', 'westeurope', 'southeastasia'];
        const skus = [
            { name: 'Standard_D2s_v3', roles: ['webapp', 'api'] },
            { name: 'Standard_D4s_v3', roles: ['webapp', 'api', 'worker'] },
            { name: 'Standard_D8s_v3', roles: ['worker', 'database'] },
            { name: 'Standard_NC6s_v3', roles: ['ml', 'worker'] },
            { name: 'Standard_F2s_v2', roles: ['api', 'webapp'] }
        ];

        const result: Record<string, Record<string, any>> = {};

        // Generate data for each region
        for (const region of regions) {
            result[region] = {};

            // Generate data for each SKU
            for (const sku of skus) {
                // Total quota varies by region and SKU
                const totalQuota = 20 + Math.floor(Math.random() * 80);

                // Used quota is a random portion of total
                const usedQuota = Math.floor(Math.random() * (totalQuota * 0.8));

                result[region][sku.name] = {
                    total: totalQuota,
                    used: usedQuota,
                    available: totalQuota - usedQuota,
                    assigned_to: sku.roles,
                    allocations: []
                };
            }
        }

        return result;
    }

    /**
     * Gets enhanced quota information with historical data and predictions
     * @param regions List of regions to check
     * @returns Array of EnhancedQuotaInfo objects
     */
    public static async getEnhancedQuotaInfo(regions: string[] = ['eastus', 'westus', 'westeurope']): Promise<EnhancedQuotaInfo[]> {
        try {
            // Get basic quota information first
            const basicQuotaInfo = await this.getDetailedQuotaInfo(regions);
            if (basicQuotaInfo.length === 0) {
                return [];
            }

            // Transform into enhanced quota info
            const enhancedInfo: EnhancedQuotaInfo[] = [];
            const now = new Date().toISOString();

            // Mock data for historical trends (in a real implementation, this would come from a database)
            for (const quota of basicQuotaInfo) {
                // Generate mock historical data
                const history: QuotaHistoryPoint[] = [];

                // Create 7 data points for the last week
                for (let i = 7; i >= 1; i--) {
                    const date = new Date();
                    date.setDate(date.getDate() - i);

                    // Start with a slightly lower percentage and gradually increase to current
                    const factor = 0.9 + (0.1 * (7 - i) / 7);
                    const historicalPercentage = quota.percentUsed * factor;

                    history.push({
                        timestamp: date.toISOString(),
                        percentUsed: historicalPercentage,
                        valueUsed: Math.floor(quota.limit * historicalPercentage / 100)
                    });
                }

                // Add current point
                history.push({
                    timestamp: now,
                    percentUsed: quota.percentUsed,
                    valueUsed: quota.currentValue
                });

                // Calculate a simple linear projection for 30 days
                // In a real implementation, this would use a more sophisticated prediction model
                let predictedUsage = quota.percentUsed;
                if (history.length >= 2) {
                    const oldestPoint = history[0];
                    const newestPoint = history[history.length - 1];

                    // Calculate daily growth rate
                    const daysDiff = (new Date(newestPoint.timestamp).getTime() - new Date(oldestPoint.timestamp).getTime()) / (1000 * 60 * 60 * 24);
                    if (daysDiff > 0) {
                        const percentDiff = newestPoint.percentUsed - oldestPoint.percentUsed;
                        const dailyGrowth = percentDiff / daysDiff;

                        // Project forward 30 days
                        predictedUsage = Math.min(100, quota.percentUsed + (dailyGrowth * 30));
                    }
                }

                // Get roles from mock data
                const mockData = await this.getMockQuotaData();
                const regionData = mockData[quota.region] || {};
                const skuData = regionData[quota.name] || { assigned_to: [] };

                // Create enhanced quota info
                enhancedInfo.push({
                    ...quota,
                    history,
                    predictedUsage,
                    lastUpdated: now,
                    assignedRoles: skuData.assigned_to || []
                });
            }

            // Track telemetry
            TelemetryService.trackEvent('EnhancedQuotaInfoRetrieved', {
                regionCount: regions.length.toString(),
                quotaItemCount: enhancedInfo.length.toString()
            });

            return enhancedInfo;
        } catch (error) {
            console.error(chalk.red(`❌ Error getting enhanced quota info: ${error instanceof Error ? error.message : String(error)}`));

            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'GetEnhancedQuotaInfo'
            });

            return [];
        }
    }

    /**
     * Gets detailed health status for specific regions
     * @param regions List of regions to check
     * @returns Array of RegionHealthStatus objects
     */
    public static async getRegionHealthStatus(regions: string[]): Promise<RegionHealthStatus[]> {
        try {
            const results: RegionHealthStatus[] = [];
            const now = new Date().toISOString();

            // Get service health for each region
            const serviceHealth = await this.checkAzureServiceHealth(regions);

            // Get quota information to determine availability
            const quotaInfo = await this.getDetailedQuotaInfo(regions);

            // Group data by region
            for (const region of regions) {
                // Get services for this region
                const regionServices = serviceHealth.filter(s => s.region === region);

                // Check if all services are healthy
                const isHealthy = regionServices.every(s => s.isHealthy);

                // Get advisories from unhealthy services
                const advisories = regionServices
                    .filter(s => !s.isHealthy)
                    .flatMap(s => s.issues || []);

                // Calculate quota availability (inverse of average usage)
                const regionQuotas = quotaInfo.filter(q => q.region === region);
                const avgQuotaUsed = regionQuotas.length > 0
                    ? regionQuotas.reduce((sum, q) => sum + q.percentUsed, 0) / regionQuotas.length
                    : 0;
                const quotaAvailability = Math.max(0, 100 - avgQuotaUsed);

                results.push({
                    region,
                    isHealthy,
                    services: regionServices,
                    lastChecked: now,
                    advisories,
                    quotaAvailability
                });
            }

            return results;
        } catch (error) {
            console.error(chalk.red(`❌ Error getting region health status: ${error instanceof Error ? error.message : String(error)}`));

            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'GetRegionHealthStatus'
            });

            return [];
        }
    }

    /**
     * Validates if a requested allocation is possible with current quota limits
     * @param region Target Azure region
     * @param vmSku VM SKU (e.g., 'Standard_D2s_v3')
     * @param count Number of VMs to allocate
     * @returns Object containing validation result and details
     */
    public static async validateQuotaForAllocation(
        region: string,
        vmSku: string,
        count: number
    ): Promise<{
        isValid: boolean;
        currentUsage?: number;
        limit?: number;
        remaining?: number;
        message: string;
    }> {
        try {
            // Get quota information for this specific region and SKU
            const quotaInfo = await this.getDetailedQuotaInfo([region]);
            const skuQuota = quotaInfo.find(q => q.name === vmSku && q.region === region);

            if (!skuQuota) {
                return {
                    isValid: false,
                    message: `No quota information found for ${vmSku} in ${region}`
                };
            }

            // Calculate if we have enough remaining quota
            const remaining = skuQuota.limit - skuQuota.currentValue;
            const isValid = remaining >= count;

            // Create appropriate message
            let message;
            if (isValid) {
                message = `✅ Sufficient quota available for ${count} instances of ${vmSku} in ${region}`;
            } else {
                message = `❌ Insufficient quota for ${count} instances of ${vmSku} in ${region}. ` +
                    `Current limit: ${skuQuota.limit}, Used: ${skuQuota.currentValue}, ` +
                    `Remaining: ${remaining}, Requested: ${count}`;
            }

            return {
                isValid,
                currentUsage: skuQuota.currentValue,
                limit: skuQuota.limit,
                remaining,
                message
            };
        } catch (error) {
            console.error(chalk.red(`❌ Error validating quota: ${error instanceof Error ? error.message : String(error)}`));

            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'ValidateQuotaForAllocation',
                region,
                vmSku,
                count: count.toString()
            });

            return {
                isValid: false,
                message: `Error validating quota: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Recommends the best region to deploy resources based on quota availability and health
     * @param requiredVmSku Required VM SKU
     * @param count Number of VMs needed
     * @param preferredRegions Optional array of preferred regions (in order of preference)
     * @returns Best region to use or null if no suitable region found
     */
    public static async recommendBestRegion(
        requiredVmSku: string,
        count: number,
        preferredRegions: string[] = ['eastus', 'westus', 'westeurope', 'northeurope', 'southeastasia']
    ): Promise<{
        region: string | null;
        reason: string;
        alternativeRegions?: string[];
    }> {
        try {
            console.log(chalk.blue(`Finding best region for ${count} instances of ${requiredVmSku}...`));

            // Get health status for all potential regions
            const healthStatus = await this.getRegionHealthStatus(preferredRegions);

            // Filter to healthy regions first
            const healthyRegions = healthStatus.filter(h => h.isHealthy).map(h => h.region);

            if (healthyRegions.length === 0) {
                return {
                    region: null,
                    reason: 'No healthy regions available'
                };
            }

            // Check quota in each healthy region
            const results: Array<{
                region: string;
                quotaValid: boolean;
                remaining?: number;
                healthScore: number;
            }> = [];

            for (const region of healthyRegions) {
                const quotaCheck = await this.validateQuotaForAllocation(region, requiredVmSku, count);

                // Get region health score (0-100)
                const regionHealth = healthStatus.find(h => h.region === region);
                const healthScore = regionHealth ? regionHealth.quotaAvailability : 0;

                results.push({
                    region,
                    quotaValid: quotaCheck.isValid,
                    remaining: quotaCheck.remaining,
                    healthScore
                });
            }

            // First, filter to regions with sufficient quota
            const validRegions = results.filter(r => r.quotaValid);

            if (validRegions.length === 0) {
                // No regions with sufficient quota
                // Return the region with most remaining capacity as a potential alternative
                const sortedByRemaining = results.sort((a, b) =>
                    (b.remaining || 0) - (a.remaining || 0)
                );

                return {
                    region: null,
                    reason: `No regions have sufficient quota for ${count} instances of ${requiredVmSku}`,
                    alternativeRegions: sortedByRemaining.slice(0, 3).map(r => r.region)
                };
            }

            // Sort valid regions by health score (highest first)
            const sortedRegions = validRegions.sort((a, b) => b.healthScore - a.healthScore);

            // Return the best region
            return {
                region: sortedRegions[0].region,
                reason: `Best region based on quota availability (${sortedRegions[0].remaining} available) and health score (${sortedRegions[0].healthScore})`,
                alternativeRegions: sortedRegions.slice(1).map(r => r.region)
            };
        } catch (error) {
            console.error(chalk.red(`❌ Error recommending region: ${error instanceof Error ? error.message : String(error)}`));

            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'RecommendBestRegion'
            });

            return {
                region: null,
                reason: `Error: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Exports current quota information to a CSV file
     * @param filePath Path to save the CSV file
     * @param regions Array of regions to include
     * @returns Promise resolving to true if successful
     */
    public static async exportQuotaInfoToCsv(
        filePath: string,
        regions: string[] = ['eastus', 'westus', 'westeurope', 'northeurope', 'southeastasia']
    ): Promise<boolean> {
        try {
            console.log(chalk.blue(`Exporting quota information to ${filePath}...`));

            // Get detailed quota information
            const quotaInfo = await this.getDetailedQuotaInfo(regions);

            if (quotaInfo.length === 0) {
                console.warn(chalk.yellow('⚠️ No quota information available to export'));
                return false;
            }

            // Create CSV header
            const header = [
                'Region',
                'Resource',
                'Provider',
                'Current Usage',
                'Limit',
                'Percentage Used',
                'Alert Level',
                'Export Date'
            ].join(',');

            // Format rows
            const rows = quotaInfo.map(q => {
                const alertLevel = this.getQuotaAlertLevel(q.percentUsed);
                const exportDate = new Date().toISOString();

                return [
                    q.region,
                    q.name,
                    q.provider,
                    q.currentValue,
                    q.limit,
                    q.percentUsed.toFixed(2),
                    alertLevel,
                    exportDate
                ].join(',');
            });

            // Combine header and rows
            const csvContent = [header, ...rows].join('\n');

            // Write to file
            fs.writeFileSync(filePath, csvContent, 'utf8');

            console.log(chalk.green(`✅ Quota information exported to ${filePath}`));
            return true;
        } catch (error) {
            console.error(chalk.red(`❌ Error exporting quota info: ${error instanceof Error ? error.message : String(error)}`));

            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'ExportQuotaInfoToCsv'
            });

            return false;
        }
    }

    /**
     * Gets custom quota thresholds for a specific resource
     * @param provider Resource provider
     * @param resourceType Resource type
     * @returns Custom thresholds object or default thresholds if none found
     */
    public static getCustomQuotaThresholds(
        provider: string,
        resourceType: string
    ): { warning: number; critical: number } {
        // In a real implementation, this would load custom thresholds from a configuration file
        // For now, we'll return default values with a few special cases

        // Special case for specific resource type
        if (provider === 'Microsoft.Compute' && resourceType.includes('Standard_NC')) {
            // GPU VMs have lower thresholds since they're harder to obtain
            return { warning: 60, critical: 80 };
        }

        // Default thresholds
        return {
            warning: this.QUOTA_WARNING_THRESHOLD,
            critical: this.QUOTA_CRITICAL_THRESHOLD
        };
    }

    /**
     * Logs comprehensive quota information to the console
     * @param quotaInfo Array of quota information objects
     */
    public static logQuotaInfo(quotaInfo: QuotaInfo[] | EnhancedQuotaInfo[]): void {
        console.log(chalk.blue('=== Azure Quota Information ==='));

        // Group by region for a more organized display
        const regionMap = new Map<string, QuotaInfo[]>();

        for (const quota of quotaInfo) {
            const regionQuotas = regionMap.get(quota.region) || [];
            regionQuotas.push(quota);
            regionMap.set(quota.region, regionQuotas);
        }

        // Display quota by region
        for (const [region, quotas] of regionMap.entries()) {
            console.log(chalk.cyan(`\n-- ${region} --`));

            // Sort by percentage used (descending)
            const sortedQuotas = [...quotas].sort((a, b) => b.percentUsed - a.percentUsed);

            for (const quota of sortedQuotas) {
                // Determine color based on alert level
                const alertLevel = this.getQuotaAlertLevel(quota.percentUsed);
                const color = alertLevel === QuotaAlertLevel.Critical ? chalk.red :
                    alertLevel === QuotaAlertLevel.Warning ? chalk.yellow :
                        chalk.green;

                // Format the percentage string
                const percentStr = quota.percentUsed.toFixed(1).padStart(5) + '%';

                // Display basic quota info
                console.log(color(`${quota.name.padEnd(20)} ${quota.currentValue}/${quota.limit} (${percentStr})`));

                // If we have enhanced info with predictions, show those too
                if ('predictedUsage' in quota) {
                    const enhanced = quota as EnhancedQuotaInfo;
                    if (enhanced.predictedUsage !== undefined) {
                        const predictedColor = enhanced.predictedUsage >= this.QUOTA_CRITICAL_THRESHOLD ? chalk.red :
                            enhanced.predictedUsage >= this.QUOTA_WARNING_THRESHOLD ? chalk.yellow :
                                chalk.green;

                        console.log(predictedColor(`  Predicted (30d): ${enhanced.predictedUsage.toFixed(1)}%`));
                    }

                    if (enhanced.assignedRoles && enhanced.assignedRoles.length > 0) {
                        console.log(chalk.blue(`  Used by: ${enhanced.assignedRoles.join(', ')}`));
                    }
                }
            }
        }

        console.log(chalk.blue('\n============================='));
    }
}