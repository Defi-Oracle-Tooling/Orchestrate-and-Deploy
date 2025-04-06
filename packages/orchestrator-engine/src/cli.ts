#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { QuotaEngine } from './rules/QuotaEngine';
import { ConnectivityService } from './utils/ConnectivityService';
import { TelemetryService } from './utils/TelemetryService';
import { executeWithRetry } from './utils/RetryUtils';

// Initialize telemetry for tracking CLI usage
TelemetryService.initialize();

const program = new Command();

// Set up program metadata
program
    .name('orchestrator-cli')
    .description('CLI for the Orchestrator Engine')
    .version('1.0.0');

// Create quota engine instance
let quotaEngine: QuotaEngine;

/**
 * Initialize the quota engine with proper error handling and connectivity checks
 */
async function initializeQuotaEngine(): Promise<QuotaEngine> {
    if (quotaEngine) {
        return quotaEngine;
    }

    try {
        // Initialize with retry for better reliability
        return await executeWithRetry(
            async () => {
                console.log(chalk.blue('🔍 Initializing quota engine...'));

                const engine = new QuotaEngine();
                await engine.initialize();

                console.log(chalk.green('✅ Quota engine initialized successfully'));
                return engine;
            },
            {
                maxRetries: 3,
                initialDelayMs: 1000,
                operationName: 'InitializeQuotaEngine'
            }
        );
    } catch (error) {
        console.error(chalk.red(`❌ Failed to initialize quota engine: ${error instanceof Error ? error.message : String(error)}`));
        TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
            operation: 'InitializeQuotaEngine'
        });
        process.exit(1);
    }
}

// Command: validate-quota
program
    .command('validate-quota <region> <role>')
    .description('Validate if a region has enough quota for a specific role')
    .option('-a, --amount <number>', 'Amount of quota needed', '1')
    .action(async (region, role, options) => {
        try {
            TelemetryService.trackEvent('CLI:ValidateQuota', {
                region,
                role,
                amount: options.amount
            });

            quotaEngine = await initializeQuotaEngine();

            const isValid = await quotaEngine.validateQuota(
                region,
                role,
                parseInt(options.amount, 10)
            );

            if (isValid) {
                console.log(chalk.green(`✅ Region ${region} has enough quota for role ${role}`));
            } else {
                console.log(chalk.red(`❌ Region ${region} does not have enough quota for role ${role}`));
            }

            process.exit(isValid ? 0 : 1);
        } catch (error) {
            console.error(chalk.red(`❌ Error validating quota: ${error instanceof Error ? error.message : String(error)}`));
            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'ValidateQuota',
                region,
                role
            });
            process.exit(1);
        }
    });

// Command: suggest-region
program
    .command('suggest-region <role>')
    .description('Suggest regions that have available quota for a specific role')
    .option('-m, --min-quota <number>', 'Minimum quota required', '1')
    .option('-p, --preferred <regions>', 'Comma-separated list of preferred regions')
    .action(async (role, options) => {
        try {
            TelemetryService.trackEvent('CLI:SuggestRegion', {
                role,
                minQuota: options.minQuota,
                preferredRegions: options.preferred || 'any'
            });

            quotaEngine = await initializeQuotaEngine();

            // Set up recommendation request
            const request = {
                role,
                minimumQuota: parseInt(options.minQuota, 10),
                preferredRegions: options.preferred ? options.preferred.split(',') : undefined
            };

            // Get recommendations
            const recommendations = await quotaEngine.getResourceRecommendations(request);

            if (recommendations.length === 0) {
                console.log(chalk.yellow(`⚠️ No regions found with available quota for role ${role}`));
                process.exit(1);
            } else {
                console.log(chalk.green(`✅ Found ${recommendations.length} regions with available quota for role ${role}:`));

                // Format and display recommendations
                recommendations.forEach((rec, index) => {
                    console.log(chalk.blue(`\n${index + 1}. Region: ${rec.region}`));
                    console.log(`   SKU: ${rec.sku}`);
                    console.log(`   Available Quota: ${rec.availableQuota}`);
                    console.log(`   Confidence: ${rec.confidence}%`);
                    console.log(`   Reasons:`);
                    rec.reasons.forEach(reason => {
                        console.log(`   - ${reason}`);
                    });
                });

                process.exit(0);
            }
        } catch (error) {
            console.error(chalk.red(`❌ Error suggesting region: ${error instanceof Error ? error.message : String(error)}`));
            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'SuggestRegion',
                role
            });
            process.exit(1);
        }
    });

// Command: summarize-availability
program
    .command('summarize-availability <role>')
    .description('Summarize quota availability for a specific role across all regions')
    .action(async (role) => {
        try {
            TelemetryService.trackEvent('CLI:SummarizeAvailability', {
                role
            });

            quotaEngine = await initializeQuotaEngine();

            // Get all regions
            const regions = quotaEngine.getAvailableRegions();

            // Track quota information across regions
            const summary: Record<string, { total: number; used: number; available: number; usage_percent: string }> = {};

            // Check each region for the specified role
            for (const region of regions) {
                const regionData = quotaEngine.getRegionData(region);

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

            if (Object.keys(summary).length === 0) {
                console.log(chalk.yellow(`⚠️ No regions found with quota assigned to role ${role}`));
                process.exit(1);
            } else {
                console.log(chalk.green(`✅ Quota summary for role ${role}:`));

                console.log(JSON.stringify(summary, null, 2));
                process.exit(0);
            }
        } catch (error) {
            console.error(chalk.red(`❌ Error summarizing availability: ${error instanceof Error ? error.message : String(error)}`));
            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'SummarizeAvailability',
                role
            });
            process.exit(1);
        }
    });

// Command: list-regions
program
    .command('list-regions')
    .description('List all available regions')
    .action(async () => {
        try {
            TelemetryService.trackEvent('CLI:ListRegions');

            quotaEngine = await initializeQuotaEngine();

            const regions = quotaEngine.getAvailableRegions();

            if (regions.length === 0) {
                console.log(chalk.yellow('⚠️ No regions found in quota data'));
                process.exit(1);
            } else {
                console.log(chalk.green(`✅ Available regions (${regions.length}):`));
                regions.forEach(region => {
                    console.log(`- ${region}`);
                });
                process.exit(0);
            }
        } catch (error) {
            console.error(chalk.red(`❌ Error listing regions: ${error instanceof Error ? error.message : String(error)}`));
            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'ListRegions'
            });
            process.exit(1);
        }
    });

// Command: list-roles
program
    .command('list-roles')
    .description('List all available roles')
    .action(async () => {
        try {
            TelemetryService.trackEvent('CLI:ListRoles');

            quotaEngine = await initializeQuotaEngine();

            const roles = quotaEngine.getAllRoles();

            if (roles.size === 0) {
                console.log(chalk.yellow('⚠️ No roles found in quota data'));
                process.exit(1);
            } else {
                console.log(chalk.green(`✅ Available roles (${roles.size}):`));
                roles.forEach(role => {
                    console.log(`- ${role}`);
                });
                process.exit(0);
            }
        } catch (error) {
            console.error(chalk.red(`❌ Error listing roles: ${error instanceof Error ? error.message : String(error)}`));
            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'ListRoles'
            });
            process.exit(1);
        }
    });

// Command: refresh-quota
program
    .command('refresh-quota')
    .description('Refresh quota data from Azure API')
    .action(async () => {
        try {
            TelemetryService.trackEvent('CLI:RefreshQuota');

            quotaEngine = await initializeQuotaEngine();

            console.log(chalk.blue('🔄 Refreshing quota data...'));

            const success = await quotaEngine.refreshQuotaData();

            if (success) {
                console.log(chalk.green('✅ Quota data refreshed successfully'));
                process.exit(0);
            } else {
                console.log(chalk.yellow('⚠️ Failed to refresh quota data. Using cached data.'));
                process.exit(1);
            }
        } catch (error) {
            console.error(chalk.red(`❌ Error refreshing quota data: ${error instanceof Error ? error.message : String(error)}`));
            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'RefreshQuota'
            });
            process.exit(1);
        }
    });

// Parse command line arguments
program.parse(process.argv);

// Display help if no command is specified
if (!process.argv.slice(2).length) {
    program.outputHelp();
}