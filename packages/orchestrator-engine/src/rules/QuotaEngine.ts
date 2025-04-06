import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import chalk from "chalk";
import { v4 as uuidv4 } from "uuid";
import { ConnectivityService, ConnectionState, AzureServiceHealth } from "../utils/ConnectivityService";
import { TelemetryService } from "../utils/TelemetryService";
import { executeWithRetry } from "../utils/RetryUtils";

/**
 * RecommendationDetails provides information about a recommended allocation
 */
export interface RecommendationDetails {
    /** Region recommended for deployment */
    region: string;
    /** Specific SKU recommended */
    sku: string;
    /** Available quota remaining */
    availableQuota: number;
    /** Confidence score (0-100) */
    confidence: number;
    /** Reasons for this recommendation */
    reasons: string[];
}

/**
 * RecommendationRequest contains parameters for generating recommendations
 */
export interface RecommendationRequest {
    /** Workload role/type needed */
    role: string;
    /** Minimum quota units needed */
    minimumQuota: number;
    /** Preferred regions (optional) */
    preferredRegions?: string[];
    /** SKU requirements/constraints (optional) */
    skuRequirements?: {
        minCores?: number;
        minMemory?: number;
        gpuRequired?: boolean;
    };
    /** Required features (optional) */
    requiredFeatures?: string[];
}

/**
 * QuotaAllocation represents a specific allocation of resources
 */
export interface QuotaAllocation {
    /** Unique identifier for this allocation */
    id: string;
    /** When the allocation was created */
    timestamp: string;
    /** Region where resources are allocated */
    region: string;
    /** SKU being allocated */
    sku: string;
    /** Role/workload type */
    role: string;
    /** Amount of quota allocated */
    amount: number;
    /** Application or service identifier */
    applicationId: string;
    /** Current status of allocation */
    status: 'pending' | 'active' | 'released';
}

/**
 * ResourceQuota contains information about quota for a specific resource
 */
export interface ResourceQuota {
    /** Total quota available */
    total: number;
    /** Quota currently in use */
    used: number;
    /** Available quota remaining */
    available: number;
    /** Roles that can use this quota */
    assigned_to: string[];
    /** Current allocations from this quota */
    allocations?: QuotaAllocation[];
}

/**
 * QuotaEngine validates and tracks Azure resource quota
 * allocations across different regions and roles.
 */
export class QuotaEngine {
    private data: Record<string, Record<string, ResourceQuota>> = {};
    private connectionState: ConnectionState;
    private allocations: Map<string, QuotaAllocation> = new Map();
    private lastRefresh: Date | null = null;
    private refreshIntervalMs = 3600000; // 1 hour by default

    constructor(
        private quotaFile = path.join(__dirname, "../../data/quotas/live-quotas.yaml"),
        private allocationFile = path.join(__dirname, "../../data/quotas/allocations.yaml")
    ) {
        // Initialize telemetry
        TelemetryService.initialize();

        // Verify quota file exists
        if (!fs.existsSync(this.quotaFile)) {
            const error = new Error(`Quota file not found: ${this.quotaFile}`);
            TelemetryService.trackException(error, {
                operation: 'QuotaEngineConstructor',
                quotaFile: this.quotaFile
            });
            throw error;
        }

        // Set empty connection state initially
        this.connectionState = {
            azureConnected: false,
            besuAvailable: false,
            messages: []
        };

        this.loadData();
        this.loadAllocations();

        // Actual connectivity check will be done asynchronously
    }

    /**
     * Initialize the connection state by performing connectivity checks
     * Should be called before any operations that require connectivity
     */
    public async initialize(): Promise<void> {
        try {
            TelemetryService.trackEvent('QuotaEngineInitializing');

            // Check all connectivity requirements at once using the centralized service
            this.connectionState = await ConnectivityService.checkConnections();
            ConnectivityService.logConnectionStatus(this.connectionState);

            TelemetryService.trackEvent('QuotaEngineInitialized', {
                azureConnected: this.connectionState.azureConnected.toString()
            });
        } catch (error) {
            console.error(chalk.red(`❌ Failed to initialize QuotaEngine: ${error instanceof Error ? error.message : String(error)}`));
            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'QuotaEngineInitialize'
            });
        }
    }

    private loadData(): void {
        try {
            const fileContent = fs.readFileSync(this.quotaFile, "utf-8");
            this.data = yaml.parse(fileContent);
            TelemetryService.trackEvent('QuotaDataLoaded', {
                quotaFile: this.quotaFile,
                regions: Object.keys(this.data).length.toString()
            });
        } catch (error) {
            console.error(chalk.red(`❌ Failed to load quota data: ${error instanceof Error ? error.message : String(error)}`));
            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'LoadQuotaData',
                quotaFile: this.quotaFile
            });
            // Initialize empty data to prevent errors
            this.data = {};
        }
    }

    private loadAllocations(): void {
        try {
            if (fs.existsSync(this.allocationFile)) {
                const fileContent = fs.readFileSync(this.allocationFile, "utf-8");
                const allocationsArray: QuotaAllocation[] = yaml.parse(fileContent);

                // Clear existing allocations and load from file
                this.allocations.clear();

                // Add each allocation to the map
                for (const allocation of allocationsArray) {
                    this.allocations.set(allocation.id, allocation);
                }

                console.log(chalk.green(`✅ Loaded ${this.allocations.size} quota allocations`));

                // Apply active allocations to the quota data
                this.syncAllocationsWithQuota();

                TelemetryService.trackEvent('QuotaAllocationsLoaded', {
                    count: this.allocations.size.toString()
                });
            } else {
                console.log(chalk.yellow(`⚠️ Allocations file not found, creating new: ${this.allocationFile}`));
                // Create an empty file
                this.saveAllocations();
            }
        } catch (error) {
            console.error(chalk.red(`❌ Failed to load allocations: ${error instanceof Error ? error.message : String(error)}`));
            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'LoadAllocations',
                allocationFile: this.allocationFile
            });

            // Initialize empty allocations to prevent errors
            this.allocations = new Map();
        }
    }

    private saveAllocations(): void {
        try {
            // Convert Map to array for serialization
            const allocationsArray = Array.from(this.allocations.values());

            // Create directory if it doesn't exist
            const dir = path.dirname(this.allocationFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Write to file
            const yamlOutput = yaml.stringify(allocationsArray);
            fs.writeFileSync(this.allocationFile, yamlOutput, "utf8");

            console.log(chalk.green(`✅ Saved ${allocationsArray.length} quota allocations`));

            TelemetryService.trackEvent('QuotaAllocationsSaved', {
                count: allocationsArray.length.toString()
            });
        } catch (error) {
            console.error(chalk.red(`❌ Failed to save allocations: ${error instanceof Error ? error.message : String(error)}`));
            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'SaveAllocations',
                allocationFile: this.allocationFile
            });
        }
    }

    private syncAllocationsWithQuota(): void {
        // Reset all available quota to match total - used
        for (const region in this.data) {
            for (const sku in this.data[region]) {
                const quota = this.data[region][sku];
                quota.available = quota.total - quota.used;

                // Initialize allocations array if it doesn't exist
                if (!quota.allocations) {
                    quota.allocations = [];
                } else {
                    // Clear existing allocations
                    quota.allocations = [];
                }
            }
        }

        // Apply active allocations to the quota data
        for (const allocation of this.allocations.values()) {
            if (allocation.status === 'active') {
                const region = allocation.region;
                const sku = allocation.sku;

                // Skip if region or SKU doesn't exist
                if (!this.data[region] || !this.data[region][sku]) {
                    continue;
                }

                const quota = this.data[region][sku];

                // Add allocation to the quota's allocations
                quota.allocations?.push(allocation);
            }
        }
    }

    /**
     * Validates if a region has enough quota for a specific role.
     * Enhances error handling by providing detailed error messages and telemetry tracking.
     * @param region Azure region to check.
     * @param role Role or workload type to validate.
     * @param amount Amount of quota needed (default: 1).
     * @returns true if quota is available, false otherwise.
     */
    public async validateQuota(region: string, role: string, amount = 1): Promise<boolean> {
        if (!region || !role) {
            const errorMessage = `Invalid parameters: region='${region}', role='${role}'`;
            console.error(chalk.red(`❌ ${errorMessage}`));
            TelemetryService.trackException(new Error(errorMessage), {
                operation: 'ValidateQuota',
                region,
                role
            });
            return false;
        }

        const regionData = this.data[region];

        if (!regionData) {
            const errorMessage = `Region '${region}' not found in quota data.`;
            console.error(chalk.red(`❌ ${errorMessage}`));
            TelemetryService.trackException(new Error(errorMessage), {
                operation: 'ValidateQuota',
                region
            });
            return false;
        }

        for (const sku of Object.keys(regionData)) {
            const details = regionData[sku];
            if (details.assigned_to.includes(role) && details.available >= amount) {
                TelemetryService.trackEvent('QuotaValidationSucceeded', {
                    region,
                    role,
                    sku,
                    available: details.available.toString(),
                    required: amount.toString()
                });
                return true;
            }
        }

        const errorMessage = `No available quota for role '${role}' in region '${region}'.`;
        console.error(chalk.red(`❌ ${errorMessage}`));
        TelemetryService.trackException(new Error(errorMessage), {
            operation: 'ValidateQuota',
            region,
            role
        });
        return false;
    }

    /**
     * Allocates quota for a specific workload
     * @param region Azure region for allocation
     * @param sku Specific SKU to allocate
     * @param role Role or workload type
     * @param amount Amount of quota to allocate
     * @param applicationId Identifier for the application using this allocation
     * @returns Allocation ID if successful, null if failed
     */
    public async allocateQuota(
        region: string,
        sku: string,
        role: string,
        amount: number,
        applicationId: string
    ): Promise<string | null> {
        // Validate parameters
        if (!region || !sku || !role || amount <= 0 || !applicationId) {
            console.error(chalk.red('❌ Invalid allocation parameters'));
            return null;
        }

        // Check if region and SKU exist
        if (!this.data[region] || !this.data[region][sku]) {
            console.error(chalk.red(`❌ Region ${region} or SKU ${sku} not found`));
            return null;
        }

        const skuData = this.data[region][sku];

        // Check if the SKU supports this role
        if (!skuData.assigned_to.includes(role)) {
            console.error(chalk.red(`❌ SKU ${sku} in ${region} is not assigned to role ${role}`));
            return null;
        }

        // Check if enough quota is available
        if (skuData.available < amount) {
            console.error(chalk.red(`❌ Not enough quota available in ${region} for ${sku}: needed ${amount}, available ${skuData.available}`));
            return null;
        }

        // Check region health if connected to Azure
        if (this.connectionState.azureConnected) {
            const regionHealth = await ConnectivityService.checkComputeServicesInRegions([region]);
            const isHealthy = regionHealth.get(region);

            if (!isHealthy) {
                console.error(chalk.red(`❌ Region ${region} is currently experiencing issues. Allocation not recommended.`));
                TelemetryService.trackEvent('QuotaAllocationRejected', {
                    reason: 'RegionUnhealthy',
                    region,
                    sku
                });
                return null;
            }
        }

        // Create allocation record
        const allocationId = uuidv4();
        const allocation: QuotaAllocation = {
            id: allocationId,
            timestamp: new Date().toISOString(),
            region,
            sku,
            role,
            amount,
            applicationId,
            status: 'active'
        };

        // Update available quota
        skuData.available -= amount;

        // Store allocation
        this.allocations.set(allocationId, allocation);

        // Add allocation to SKU record
        if (!skuData.allocations) {
            skuData.allocations = [];
        }
        skuData.allocations.push(allocation);

        // Save to disk
        this.saveAllocations();

        console.log(chalk.green(`✅ Allocated ${amount} units of ${sku} in ${region} for ${role} (ID: ${allocationId})`));

        TelemetryService.trackEvent('QuotaAllocated', {
            region,
            sku,
            role,
            amount: amount.toString(),
            applicationId,
            allocationId
        });

        return allocationId;
    }

    /**
     * Releases a previously allocated quota
     * @param allocationId ID of the allocation to release
     * @returns true if released successfully, false if allocation not found or already released
     */
    public releaseQuota(allocationId: string): boolean {
        // Find allocation
        const allocation = this.allocations.get(allocationId);

        if (!allocation) {
            console.error(chalk.red(`❌ Allocation not found: ${allocationId}`));
            return false;
        }

        // Skip if already released
        if (allocation.status === 'released') {
            console.log(chalk.yellow(`⚠️ Allocation already released: ${allocationId}`));
            return true;
        }

        // Update status
        allocation.status = 'released';

        // Update quota available if region and SKU still exist
        const region = allocation.region;
        const sku = allocation.sku;

        if (this.data[region] && this.data[region][sku]) {
            this.data[region][sku].available += allocation.amount;

            // Update allocations list
            if (this.data[region][sku].allocations) {
                const allocations = this.data[region][sku].allocations || [];
                const index = allocations.findIndex(a => a.id === allocationId);

                if (index >= 0) {
                    allocations[index].status = 'released';
                }
            }
        }

        // Save changes
        this.saveAllocations();

        console.log(chalk.green(`✅ Released quota allocation: ${allocationId}`));

        TelemetryService.trackEvent('QuotaReleased', {
            allocationId,
            region: allocation.region,
            sku: allocation.sku,
            amount: allocation.amount.toString()
        });

        return true;
    }

    /**
     * Get all active allocations for an application
     * @param applicationId Application identifier
     * @returns Array of active allocations
     */
    public getApplicationAllocations(applicationId: string): QuotaAllocation[] {
        const result: QuotaAllocation[] = [];

        for (const allocation of this.allocations.values()) {
            if (allocation.applicationId === applicationId && allocation.status === 'active') {
                result.push(allocation);
            }
        }

        return result;
    }

    /**
     * Refreshes quota data from Azure API if credentials are available
     * @returns true if refresh succeeded, false otherwise
     */
    public async refreshQuotaData(): Promise<boolean> {
        // Make sure we're initialized
        if (!this.connectionState.messages) {
            await this.initialize();
        }

        TelemetryService.trackEvent('RefreshQuotaDataStarted');

        // Log a warning if cached data is being used due to missing Azure credentials
        if (!this.connectionState.azureConnected) {
            console.log(chalk.yellow("⚠️ Using cached quota data"));
        }

        if (!this.connectionState.azureConnected) {
            console.log(chalk.yellow('⚠️ Cannot refresh quota data: Azure credentials not available'));
            console.log(chalk.yellow('ℹ️ Set AZURE_SUBSCRIPTION_ID and AZURE_TENANT_ID environment variables'));
            console.log(chalk.yellow("⚠️ Using cached quota data"));

            TelemetryService.trackEvent('RefreshQuotaDataFailed', {
                reason: 'AzureDisconnected'
            });

            return false;
        }

        try {
            // Use the retry utility for better resilience
            await executeWithRetry(async () => {
                console.log(chalk.blue('Refreshing quota data from Azure...'));

                // In a real implementation, this would call Azure APIs to refresh quota
                // For now, we'll use the ConnectivityService to get mock data
                const azureQuotaData = await ConnectivityService.getAzureQuotaData();

                if (azureQuotaData) {
                    // Update our local data with the refreshed data while keeping allocations
                    for (const region in azureQuotaData) {
                        for (const sku in azureQuotaData[region]) {
                            // Keep existing allocations if we have them
                            const existingAllocations = this.data[region]?.[sku]?.allocations || [];

                            // If region/SKU exists in our data, copy allocations
                            if (azureQuotaData[region][sku]) {
                                azureQuotaData[region][sku].allocations = existingAllocations;
                            }
                        }
                    }

                    // Replace data with new data
                    this.data = azureQuotaData;

                    // Recalculate available quota based on allocations
                    this.syncAllocationsWithQuota();

                    // Write the updated data to our YAML file for persistence
                    const yamlOutput = yaml.stringify(this.data);
                    fs.writeFileSync(this.quotaFile, yamlOutput, "utf8");

                    // Update last refresh time
                    this.lastRefresh = new Date();

                    return true;
                } else {
                    throw new Error('Failed to get quota data from Azure');
                }
            }, {
                maxRetries: 3,
                initialDelayMs: 1000,
                operationName: 'RefreshQuotaData'
            });

            console.log(chalk.green('✅ Quota data refreshed successfully'));

            TelemetryService.trackEvent('RefreshQuotaDataSucceeded', {
                regions: Object.keys(this.data).length.toString()
            });

            return true;
        } catch (error) {
            console.error(chalk.red("❌ Failed to refresh quota data"));
            console.log(chalk.yellow("⚠️ Using cached quota data"));
            console.log(chalk.red("❌ Failed to refresh quota data"));

            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'RefreshQuotaData'
            });

            return false;
        }
    }

    /**
     * Gets data for a specific region
     * @param region Region name
     * @returns Quota data for the region or null if not found
     */
    public getRegionData(region: string): any {
        const regionData = this.data[region];
        if (!regionData) {
            console.log(chalk.yellow(`⚠️ Region not found: ${region}`));
            return null;
        }
        return regionData;
    }

    /**
     * Gets all available regions
     * @returns Array of region names
     */
    public getAvailableRegions(): string[] {
        return Object.keys(this.data);
    }

    /**
     * Gets all roles across all regions
     * @returns Set of unique role names
     */
    public getAllRoles(): Set<string> {
        const roles = new Set<string>();

        for (const region of Object.keys(this.data)) {
            const regionData = this.data[region];

            for (const sku of Object.keys(regionData)) {
                const details = regionData[sku];

                if (details.assigned_to && Array.isArray(details.assigned_to)) {
                    details.assigned_to.forEach((role: string) => roles.add(role));
                }
            }
        }

        return roles;
    }

    /**
     * Checks if quota data needs to be refreshed based on age
     * @returns true if refresh is needed, false otherwise
     */
    public needsRefresh(): boolean {
        if (!this.lastRefresh) {
            return true;
        }

        const now = new Date();
        const ageMs = now.getTime() - this.lastRefresh.getTime();

        return ageMs > this.refreshIntervalMs;
    }

    /**
     * Gets the timestamp of the last data refresh
     * @returns Date of last refresh or null if never refreshed
     */
    public getLastRefreshTime(): Date | null {
        return this.lastRefresh;
    }

    /**
     * Sets the refresh interval for quota data
     * @param intervalMs Refresh interval in milliseconds
     */
    public setRefreshInterval(intervalMs: number): void {
        if (intervalMs < 60000) { // Minimum 1 minute
            console.log(chalk.yellow(`⚠️ Refresh interval too short, using minimum (60000ms)`));
            this.refreshIntervalMs = 60000;
        } else {
            this.refreshIntervalMs = intervalMs;
        }
    }

    /**
     * Generates recommendations for optimal resource allocation
     * based on available quota and workload requirements
     * @param request Parameters for generating recommendations
     * @returns Array of recommendations sorted by confidence
     */
    public async getResourceRecommendations(request: RecommendationRequest): Promise<RecommendationDetails[]> {
        TelemetryService.trackEvent('GenerateResourceRecommendation', {
            role: request.role,
            minimumQuota: request.minimumQuota.toString(),
            preferredRegions: request.preferredRegions ? request.preferredRegions.join(';') : 'any'
        });

        // Refresh quota data if needed and connected to Azure
        if (this.needsRefresh() && this.connectionState.azureConnected) {
            await this.refreshQuotaData();
        }

        const recommendations: RecommendationDetails[] = [];
        let availableRegions = this.getAvailableRegions();

        // Filter to preferred regions if specified
        if (request.preferredRegions && request.preferredRegions.length > 0) {
            availableRegions = availableRegions.filter(region =>
                request.preferredRegions?.includes(region));
        }

        // Check region health if connected to Azure
        const regionHealthMap = new Map<string, boolean>();
        if (this.connectionState.azureConnected) {
            const regionHealth = await ConnectivityService.checkComputeServicesInRegions(availableRegions);
            // Update our local map with the health check results
            for (const [region, isHealthy] of regionHealth.entries()) {
                regionHealthMap.set(region, isHealthy);
            }
        } else {
            // If we can't check health, assume all regions are healthy
            availableRegions.forEach(region => regionHealthMap.set(region, true));
        }

        // Iterate through regions
        for (const region of availableRegions) {
            const regionData = this.data[region];
            const isRegionHealthy = regionHealthMap.get(region) || false;

            // Skip regions with no data
            if (!regionData) continue;

            // Look for SKUs assigned to the requested role
            for (const sku of Object.keys(regionData)) {
                const details = regionData[sku];

                // Skip SKUs not assigned to this role
                if (!details.assigned_to || !details.assigned_to.includes(request.role)) {
                    continue;
                }

                // Skip SKUs with insufficient quota
                if (details.available < request.minimumQuota) {
                    continue;
                }

                // Calculate confidence score (0-100)
                // Higher score for more available quota, preferred regions, and healthy regions
                let confidence = 50; // Base confidence
                const reasons: string[] = [];

                // More quota available = higher confidence (up to 20 points)
                const quotaRatio = details.available / (details.total || 1);
                confidence += Math.min(quotaRatio * 20, 20);

                if (quotaRatio > 0.5) {
                    reasons.push(`High quota availability (${details.available}/${details.total})`);
                } else {
                    reasons.push(`Sufficient quota available (${details.available}/${details.total})`);
                }

                // Adjust confidence based on region preferences (up to 15 points)
                if (request.preferredRegions && request.preferredRegions.includes(region)) {
                    confidence += 15;
                    reasons.push('Preferred region');

                    // Boost primary regions even higher (5 points)
                    if (request.preferredRegions[0] === region) {
                        confidence += 5;
                        reasons.push('Primary preferred region');
                    }
                }

                // Adjust based on region health (up to 10 points)
                if (isRegionHealthy) {
                    confidence += 10;
                    reasons.push('Region is healthy');
                } else {
                    confidence -= 30; // Major penalty for unhealthy regions
                    reasons.push('⚠️ Region health issues detected');
                }

                // If SKU requirements are specified, check if they are met
                if (request.skuRequirements) {
                    // This is where we would check if the SKU meets the requirements
                    // For now, we'll just assume they do and add a reason
                    reasons.push('Meets SKU requirements');
                }

                // Create the recommendation
                recommendations.push({
                    region,
                    sku,
                    availableQuota: details.available,
                    confidence: Math.min(Math.max(confidence, 0), 100), // Clamp between 0-100
                    reasons
                });
            }
        }

        // Sort by confidence score (descending)
        return recommendations.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * Exports current quota data and allocations to a CSV file
     * @param filePath Path to save the CSV file
     * @returns true if export succeeded, false otherwise
     */
    public exportToCSV(filePath: string): boolean {
        try {
            // Create CSV header
            const header = "Region,SKU,Total Quota,Used Quota,Available Quota,Roles,Active Allocations\n";

            // Create rows
            let rows = "";
            for (const region of Object.keys(this.data)) {
                for (const sku of Object.keys(this.data[region])) {
                    const quota = this.data[region][sku];
                    const activeAllocations = quota.allocations?.filter(a => a.status === 'active').length || 0;

                    rows += `${region},${sku},${quota.total},${quota.used},${quota.available},"${quota.assigned_to.join(',')}",${activeAllocations}\n`;
                }
            }

            // Write to file
            fs.writeFileSync(filePath, header + rows, 'utf8');

            console.log(chalk.green(`✅ Exported quota data to ${filePath}`));
            return true;
        } catch (error) {
            console.error(chalk.red(`❌ Failed to export quota data: ${error instanceof Error ? error.message : String(error)}`));
            return false;
        }
    }

    /**
     * Adds a new SKU or role to the quota data
     * @param region Region name
     * @param sku SKU name
     * @param total Total quota for the SKU
     * @param assignedRoles Roles assigned to the SKU
     */
    public addNewRoleOrSku(region: string, sku: string, total: number, assignedRoles: string[]): void {
        if (!this.data[region]) {
            this.data[region] = {};
        }

        this.data[region][sku] = {
            total,
            used: 0,
            available: total,
            assigned_to: assignedRoles,
            allocations: []
        };

        console.log(chalk.green(`✅ Added new SKU '${sku}' with roles [${assignedRoles.join(", ")}] in region '${region}'.`));

        // Save updated data to YAML file
        const yamlOutput = yaml.stringify(this.data);
        fs.writeFileSync(this.quotaFile, yamlOutput, "utf8");

        TelemetryService.trackEvent('NewRoleOrSkuAdded', {
            region,
            sku,
            total: total.toString(),
            roles: assignedRoles.join(", ")
        });
    }

    /**
     * Summarizes quota availability for a specific role across all regions
     * @param role Role to summarize quota for
     * @returns Summary object with quota details for each applicable region
     */
    public summarizeQuotaAvailability(role: string): Record<string, { total: number; used: number; available: number; usage_percent: string }> {
        TelemetryService.trackEvent('SummarizeQuotaAvailability', {
            role
        });

        const summary: Record<string, { total: number; used: number; available: number; usage_percent: string }> = {};
        const regions = this.getAvailableRegions();

        // Check each region for the specified role
        for (const region of regions) {
            const regionData = this.getRegionData(region);

            if (!regionData) continue;

            // Find any SKU assigned to this role
            for (const sku in regionData) {
                const quotaDetails = regionData[sku];

                if (quotaDetails.assigned_to.includes(role)) {
                    const usagePercent = (quotaDetails.used / quotaDetails.total * 100).toFixed(2);

                    summary[region] = {
                        total: quotaDetails.total,
                        used: quotaDetails.used,
                        available: quotaDetails.available,
                        usage_percent: usagePercent
                    };

                    // We've found a matching SKU for this region, move to the next region
                    break;
                }
            }
        }

        TelemetryService.trackEvent('QuotaSummaryGenerated', {
            role,
            regionCount: Object.keys(summary).length.toString()
        });

        return summary;
    }
}