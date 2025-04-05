import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { ParsedQs } from "qs";
import { QuotaEngine, RecommendationRequest, RecommendationDetails } from "./rules/QuotaEngine";
import { ConnectivityService, ConnectionState } from "./utils/ConnectivityService";
import { TelemetryService } from "./utils/TelemetryService";
import { executeWithRetry } from "./utils/RetryUtils";
import chalk from "chalk";

// Initialize telemetry first for proper tracking
const telemetryInitialized = TelemetryService.initialize();
TelemetryService.trackEvent("ServerStarting");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Add interface for our local connection state (matching ConnectivityService's ConnectionState)
let connectionState: ConnectionState;
let quotaEngine: QuotaEngine;

// Express error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(chalk.red(`❌ Express error: ${err.message}`));
    TelemetryService.trackException(err, {
        path: req.path,
        method: req.method
    });
    res.status(500).json({ error: "Internal server error", message: err.message });
});

// Initialize server asynchronously
async function initializeServer() {
    try {
        // Perform startup checks with retry for transient issues
        connectionState = await executeWithRetry(
            () => ConnectivityService.checkConnections(),
            {
                maxRetries: 3,
                initialDelayMs: 2000,
                operationName: "InitializeServerConnections"
            }
        );

        // Display connectivity status
        ConnectivityService.logConnectionStatus(connectionState);

        // Initialize the quota engine
        quotaEngine = new QuotaEngine();
        await quotaEngine.initialize();

        // Start the server after initialization
        const port = process.env.ORCHESTRATOR_PORT || 3000;
        app.listen(port, () => {
            console.log(chalk.green(`✅ Orchestrator engine listening on port ${port}`));
            console.log(chalk.blue(`🌐 Server status:`));
            console.log(`   - Azure API access: ${connectionState.azureConnected ? chalk.green('Available') : chalk.yellow('Limited')}`);
            console.log(`   - Besu integration: ${connectionState.besuAvailable ? chalk.green('Available') : chalk.yellow('Disabled')}`);
            console.log(`   - Telemetry: ${telemetryInitialized ? chalk.green('Enabled') : chalk.yellow('Disabled')}`);

            TelemetryService.trackEvent("ServerStarted", {
                port: port.toString(),
                azureConnected: connectionState.azureConnected.toString(),
                besuAvailable: connectionState.besuAvailable.toString()
            });
        });
    } catch (error: unknown) {
        console.error(chalk.red(`❌ Failed to initialize server: ${error instanceof Error ? error.message : String(error)}`));
        TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), { operation: "ServerInitialization" });
        process.exit(1);
    }
}

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
    TelemetryService.trackEvent("HealthCheckRequested", {
        clientIp: req.ip || "unknown",
        userAgent: req.get("User-Agent") || "unknown"
    });

    res.json({
        status: "ok",
        azure: connectionState?.azureConnected ? "connected" : "offline",
        besu: connectionState?.besuAvailable ? "available" : "offline",
        telemetry: telemetryInitialized ? "enabled" : "disabled",
        version: "1.1.0"
    });
});

// RESTful endpoints
app.get("/api/quotas", async (req: Request, res: Response) => {
    try {
        const { region, role } = req.query;

        TelemetryService.trackEvent("QuotasRequested", {
            region: typeof region === 'string' ? region : "all",
            role: typeof role === 'string' ? role : "all"
        });

        // Make sure quota engine is initialized
        if (!quotaEngine) {
            quotaEngine = new QuotaEngine();
            await quotaEngine.initialize();
        }

        // Filter regions if requested
        let filteredData = { ...quotaEngine["data"] }; // direct access for demonstration

        if (region) {
            filteredData = Object.keys(filteredData)
                .filter((r) => r.toLowerCase() === (typeof region === 'string' ? region.toLowerCase() : ''))
                .reduce((acc: any, key) => {
                    acc[key] = filteredData[key];
                    return acc;
                }, {});
        }

        // Filter roles if requested
        if (role) {
            for (const r of Object.keys(filteredData)) {
                const filteredQuotas: any = {};
                for (const sku of Object.keys(filteredData[r])) {
                    const details = filteredData[r][sku];
                    if (details.assigned_to.includes(typeof role === 'string' ? role : '')) {
                        filteredQuotas[sku] = details;
                    }
                }
                filteredData[r] = filteredQuotas;
            }
        }

        res.json({
            data: filteredData,
            meta: {
                timestamp: new Date().toISOString(),
                usingCachedData: !connectionState?.azureConnected,
                azureConnected: connectionState?.azureConnected,
                besuAvailable: connectionState?.besuAvailable,
                regionsCount: Object.keys(filteredData).length
            }
        });
    } catch (error: unknown) {
        console.error(chalk.red(`❌ Error handling quota request: ${error instanceof Error ? error.message : String(error)}`));
        TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
            operation: "GetQuotas",
            region: typeof req.query.region === 'string' ? req.query.region : "undefined",
            role: typeof req.query.role === 'string' ? req.query.role : "undefined"
        });

        res.status(500).json({
            error: "Failed to retrieve quota data",
            message: error instanceof Error ? error.message : String(error)
        });
    }
});

// Endpoint to refresh quota data
app.post("/api/quotas/refresh", async (req: Request, res: Response) => {
    try {
        TelemetryService.trackEvent("QuotaRefreshRequested");

        // Make sure quota engine is initialized
        if (!quotaEngine) {
            quotaEngine = new QuotaEngine();
            await quotaEngine.initialize();
        }

        const result = await quotaEngine.refreshQuotaData();

        if (result) {
            res.json({
                success: true,
                message: "Quota data refreshed successfully",
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(503).json({
                success: false,
                message: "Failed to refresh quota data. Azure credentials may be missing."
            });
        }
    } catch (error: unknown) {
        console.error(chalk.red(`❌ Error refreshing quota data: ${error instanceof Error ? error.message : String(error)}`));
        TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
            operation: "RefreshQuotas"
        });

        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : String(error)
        });
    }
});

// Add Besu connection status endpoint
app.get("/api/besu/status", async (req: Request, res: Response) => {
    try {
        TelemetryService.trackEvent("BesuStatusRequested");

        // Refresh connection state to get the latest
        const latestState = await ConnectivityService.checkConnections();

        if (!latestState.besuAvailable) {
            return res.status(503).json({
                available: false,
                message: "Besu endpoint not configured. Set BESU_ENDPOINT environment variable."
            });
        }

        // Get the actual endpoint for information
        const besuEndpoint = process.env.BESU_ENDPOINT || "http://localhost:8545";

        // In a real implementation, this would check actual connectivity in more detail
        res.json({
            available: true,
            endpoint: besuEndpoint,
            message: "Besu endpoint is configured properly",
            timestamp: new Date().toISOString()
        });
    } catch (error: unknown) {
        console.error(chalk.red(`❌ Error checking Besu status: ${error instanceof Error ? error.message : String(error)}`));
        TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
            operation: "GetBesuStatus"
        });

        res.status(500).json({
            available: false,
            message: error instanceof Error ? error.message : String(error)
        });
    }
});

// Add Azure connection status endpoint
app.get("/api/azure/status", async (req: Request, res: Response) => {
    try {
        TelemetryService.trackEvent("AzureStatusRequested");

        // Refresh connection state to get the latest
        const latestState = await ConnectivityService.checkConnections();

        // Get more detailed information about Azure resources if connected
        let resourceHealth = false;
        if (latestState.azureConnected) {
            try {
                // Since checkAzureResourceHealth doesn't exist, we'll stub it with a basic check
                // In a real implementation, this would be a proper method in ConnectivityService
                resourceHealth = latestState.azureConnected && (process.env.AZURE_SUBSCRIPTION_ID !== undefined);
            } catch (error: unknown) {
                console.warn(chalk.yellow(`⚠️ Could not check Azure resource health: ${error instanceof Error ? error.message : String(error)}`));
            }
        }

        res.json({
            connected: latestState.azureConnected,
            subscriptionId: process.env.AZURE_SUBSCRIPTION_ID || "not-set",
            resourceHealth: latestState.azureConnected ? (resourceHealth ? "healthy" : "issues-detected") : "unknown",
            message: latestState.azureConnected
                ? "Azure credentials configured and validated"
                : "Azure credentials not configured or invalid",
            timestamp: new Date().toISOString()
        });
    } catch (error: unknown) {
        console.error(chalk.red(`❌ Error checking Azure status: ${error instanceof Error ? error.message : String(error)}`));
        TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
            operation: "GetAzureStatus"
        });

        res.status(500).json({
            connected: false,
            message: error instanceof Error ? error.message : String(error)
        });
    }
});

// Add recommendation API endpoint
app.post("/api/quotas/recommendations", async (req: Request, res: Response) => {
    try {
        const recommendationRequest: RecommendationRequest = req.body;

        // Validate request
        if (!recommendationRequest.role || !recommendationRequest.minimumQuota) {
            return res.status(400).json({
                error: "Invalid request",
                message: "role and minimumQuota are required fields"
            });
        }

        TelemetryService.trackEvent("QuotaRecommendationRequested", {
            role: recommendationRequest.role,
            minimumQuota: recommendationRequest.minimumQuota.toString(),
            preferredRegions: recommendationRequest.preferredRegions?.join(";") || "any"
        });

        // Make sure quota engine is initialized
        if (!quotaEngine) {
            quotaEngine = new QuotaEngine();
            await quotaEngine.initialize();
        }

        // Get recommendations - add await since it returns a Promise
        const recommendations = await quotaEngine.getResourceRecommendations(recommendationRequest);

        // Track number of recommendations for analytics
        TelemetryService.trackMetric("RecommendationCount", recommendations.length);

        res.json({
            query: recommendationRequest,
            recommendations,
            meta: {
                count: recommendations.length,
                timestamp: new Date().toISOString(),
                azureConnected: connectionState?.azureConnected || false
            }
        });
    } catch (error: unknown) {
        console.error(chalk.red(`❌ Error generating recommendations: ${error instanceof Error ? error.message : String(error)}`));
        TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
            operation: "GenerateRecommendations"
        });

        res.status(500).json({
            error: "Failed to generate recommendations",
            message: error instanceof Error ? error.message : String(error)
        });
    }
});

// Start the server initialization process
initializeServer().catch((error: unknown) => {
    console.error(chalk.red(`❌ Critical error during server initialization: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
});