import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { ConnectivityService, ConnectionState } from "../utils/ConnectivityService";
import { TelemetryService } from "../utils/TelemetryService";
import { executeWithRetry } from "../utils/RetryUtils";

/**
 * BesuConfigurator manages the lifecycle of Hyperledger Besu nodes:
 *  - Reads config from JSON/XML.
 *  - Deploys or updates nodes.
 *  - Maintains version history for rollback.
 */
export class BesuConfigurator {
    private versionHistoryDir = path.join(__dirname, "../../versions");
    private connectionState: ConnectionState;

    constructor() {
        // Initialize telemetry
        TelemetryService.initialize();

        if (!fs.existsSync(this.versionHistoryDir)) {
            fs.mkdirSync(this.versionHistoryDir, { recursive: true });
        }

        // Set empty connection state initially
        this.connectionState = {
            azureConnected: false,
            besuAvailable: false,
            messages: []
        };

        // We'll perform the actual check asynchronously later
    }

    /**
     * Initialize the connection state by performing connectivity checks
     * Should be called before any operations that require connectivity
     */
    public async initialize(): Promise<void> {
        try {
            TelemetryService.trackEvent('BesuConfiguratorInitializing');

            // Check all connectivity requirements at once using the centralized service
            this.connectionState = await ConnectivityService.checkConnections();
            ConnectivityService.logConnectionStatus(this.connectionState);

            TelemetryService.trackEvent('BesuConfiguratorInitialized', {
                azureConnected: this.connectionState.azureConnected.toString(),
                besuAvailable: this.connectionState.besuAvailable.toString()
            });
        } catch (error) {
            console.error(chalk.red(`❌ Failed to initialize BesuConfigurator: ${error instanceof Error ? error.message : String(error)}`));
            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'BesuConfiguratorInitialize'
            });
        }
    }

    public async deploy(configPath: string): Promise<void> {
        console.log(chalk.blue("Deploying Besu with config at: " + configPath));

        // Make sure we've initialized
        if (!this.connectionState.messages) {
            await this.initialize();
        }

        TelemetryService.trackEvent('BesuDeployStarted', {
            configPath
        });

        // Pre-flight checks before attempting deployment
        if (!this.connectionState.besuAvailable) {
            const errorMsg = "❌ Cannot deploy: Besu network is not available";
            console.log(chalk.red(errorMsg));
            console.log(chalk.yellow("ℹ️ Set BESU_ENDPOINT environment variable to enable deployment"));
            TelemetryService.trackEvent('BesuDeployFailed', {
                reason: 'BesuUnavailable',
                configPath
            });
            return;
        }

        // Azure-specific operations check
        if (!this.connectionState.azureConnected && process.env.DEPLOY_TO_AZURE === 'true') {
            console.log(chalk.yellow("⚠️ Azure credentials not found but DEPLOY_TO_AZURE is set"));
            console.log(chalk.yellow("ℹ️ Azure deployment steps will be skipped"));
            TelemetryService.trackEvent('BesuDeployWarning', {
                warning: 'AzureCredentialsMissing',
                configPath
            });
        }

        // Check if config file exists
        if (!ConnectivityService.verifyFileExists(configPath, `Configuration file not found: ${configPath}`)) {
            TelemetryService.trackEvent('BesuDeployFailed', {
                reason: 'ConfigFileNotFound',
                configPath
            });
            return;
        }

        try {
            // Use retry pattern for file operations as well
            await executeWithRetry(async () => {
                // 1. Load config
                const configContents = fs.readFileSync(configPath, "utf8");

                // Validate config structure (basic JSON validation)
                JSON.parse(configContents);

                // 2. Save configuration version
                const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
                const versionFilePath = path.join(this.versionHistoryDir, `besu-config-${timestamp}.json`);

                fs.writeFileSync(versionFilePath, configContents);
                console.log(chalk.green("Besu configuration saved for version tracking."));

                // 3. In a real implementation, this would deploy to Besu nodes
                // Simulate successful deployment
                await this.simulateBesuDeployment(configContents);

                return true;
            }, {
                maxRetries: 2,
                operationName: 'BesuDeploy'
            });

            console.log(chalk.green("✅ Configuration deployed to local version history"));
            TelemetryService.trackEvent('BesuDeploySucceeded', {
                configPath
            });
        } catch (error) {
            console.error(chalk.red(`❌ Failed to deploy Besu configuration: ${error instanceof Error ? error.message : String(error)}`));
            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'BesuDeploy',
                configPath
            });
        }
    }

    /**
     * Simulate a deployment to Besu network
     * @param configContents Config to deploy
     */
    private async simulateBesuDeployment(configContents: string): Promise<void> {
        // In a real implementation, this would make API calls to Besu
        console.log(chalk.blue("📡 Simulating deployment to Besu network..."));

        // Artificial delay to simulate network activity
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log(chalk.green("✅ Besu network nodes updated"));
    }

    public async rollbackToVersion(versionLabel: string): Promise<void> {
        if (!versionLabel) {
            console.log(chalk.red("No version specified for rollback."));
            TelemetryService.trackEvent('BesuRollbackFailed', {
                reason: 'NoVersionSpecified'
            });
            return;
        }

        // Make sure we've initialized
        if (!this.connectionState.messages) {
            await this.initialize();
        }

        TelemetryService.trackEvent('BesuRollbackStarted', {
            versionLabel
        });

        // Pre-flight checks before attempting rollback
        if (!this.connectionState.besuAvailable) {
            console.log(chalk.red("❌ Cannot rollback: Besu network is not available"));
            console.log(chalk.yellow("ℹ️ Set BESU_ENDPOINT environment variable to enable rollback"));
            TelemetryService.trackEvent('BesuRollbackFailed', {
                reason: 'BesuUnavailable',
                versionLabel
            });
            return;
        }

        console.log(chalk.yellow(`Rolling back to version: ${versionLabel}`));

        try {
            await executeWithRetry(async () => {
                // Find the config file that matches the label (timestamp or tag)
                const versionFiles = fs.readdirSync(this.versionHistoryDir);
                const matchingFile = versionFiles.find(file => file.includes(versionLabel));

                if (!matchingFile) {
                    throw new Error(`No version found matching: ${versionLabel}`);
                }

                // Load the old config
                const oldConfigPath = path.join(this.versionHistoryDir, matchingFile);
                const oldConfig = fs.readFileSync(oldConfigPath, 'utf8');

                console.log(chalk.green(`✅ Found version file: ${matchingFile}`));

                // In a real implementation, deployment logic would go here
                await this.simulateBesuDeployment(oldConfig);

                return true;
            }, {
                maxRetries: 2,
                operationName: 'BesuRollback'
            });

            console.log(chalk.green(`✅ Successfully rolled back to version: ${versionLabel}`));
            TelemetryService.trackEvent('BesuRollbackSucceeded', {
                versionLabel
            });
        } catch (error) {
            console.error(chalk.red(`❌ Rollback failed: ${error instanceof Error ? error.message : String(error)}`));
            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'BesuRollback',
                versionLabel
            });
        }
    }

    /**
     * ValidationResult contains the result of a configuration validation operation
     */
    public async validateConfiguration(configPath: string): Promise<ValidationResult> {
        console.log(chalk.blue(`Validating Besu configuration at: ${configPath}`));

        // Track validation operation
        TelemetryService.trackEvent('BesuConfigValidationStarted', {
            configPath
        });

        const result: ValidationResult = {
            valid: true,
            errors: [],
            warnings: [],
            timestamp: new Date().toISOString()
        };

        try {
            // Check if file exists
            if (!ConnectivityService.verifyFileExists(configPath)) {
                result.valid = false;
                result.errors.push(`Configuration file not found: ${configPath}`);
                return result;
            }

            // Use retry for file operations
            await executeWithRetry(async () => {
                // Read configuration file
                const configContents = fs.readFileSync(configPath, "utf8");

                // Determine file type from extension
                const fileExt = path.extname(configPath).toLowerCase();

                // Basic structure validation
                try {
                    if (fileExt === '.json') {
                        // Parse JSON to validate structure
                        const config = JSON.parse(configContents);

                        // Check for required fields in Besu config
                        if (!config.network) {
                            result.errors.push("Missing required 'network' field in configuration");
                        }

                        if (!config.nodes || !Array.isArray(config.nodes) || config.nodes.length === 0) {
                            result.errors.push("Configuration must contain a non-empty 'nodes' array");
                        } else {
                            // Validate each node
                            config.nodes.forEach((node: any, index: number) => {
                                if (!node.name) {
                                    result.errors.push(`Node at index ${index} is missing required 'name' field`);
                                }

                                if (!node.rpcPort) {
                                    result.warnings.push(`Node '${node.name || index}' is missing recommended 'rpcPort' field`);
                                }
                            });
                        }

                        // Check for consensus mechanism
                        if (!config.consensus) {
                            result.warnings.push("Missing recommended 'consensus' field in configuration");
                        } else if (!['ibft2', 'qbft', 'raft', 'ethash', 'clique'].includes(config.consensus)) {
                            result.warnings.push(`Consensus mechanism '${config.consensus}' may not be supported`);
                        }

                    } else if (fileExt === '.xml') {
                        // For XML, we would need a proper XML parser
                        // This is a simplified placeholder
                        if (!configContents.includes('<network>')) {
                            result.errors.push("Missing required 'network' element in configuration");
                        }

                        if (!configContents.includes('<nodes>')) {
                            result.errors.push("Configuration must contain a 'nodes' element");
                        }

                    } else {
                        result.errors.push(`Unsupported configuration file format: ${fileExt}`);
                    }
                } catch (parseError: unknown) {
                    result.valid = false;
                    result.errors.push(`Configuration parsing error: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
                }

                return true;
            }, {
                maxRetries: 2,
                operationName: 'ValidateBesuConfig'
            });

        } catch (error) {
            console.error(chalk.red(`❌ Validation error: ${error instanceof Error ? error.message : String(error)}`));
            result.valid = false;
            result.errors.push(`Validation process failed: ${error instanceof Error ? error.message : String(error)}`);

            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'ValidateBesuConfig',
                configPath
            });
        }

        // Set final validation status
        result.valid = result.errors.length === 0;

        // Log validation result
        if (result.valid) {
            console.log(chalk.green("✅ Configuration validation passed"));
            if (result.warnings.length > 0) {
                console.log(chalk.yellow(`⚠️ ${result.warnings.length} warnings found`));
                result.warnings.forEach(warn => console.log(chalk.yellow(`   - ${warn}`)));
            }
        } else {
            console.log(chalk.red(`❌ Configuration validation failed with ${result.errors.length} errors`));
            result.errors.forEach(err => console.log(chalk.red(`   - ${err}`)));
        }

        // Track validation result
        TelemetryService.trackEvent('BesuConfigValidationCompleted', {
            configPath,
            valid: result.valid.toString(),
            errorCount: result.errors.length.toString(),
            warningCount: result.warnings.length.toString()
        });

        return result;
    }
}

/**
 * ValidationResult contains the result of a configuration validation operation
 */
export interface ValidationResult {
    /** Whether the validation was successful */
    valid: boolean;
    /** Any validation errors that occurred */
    errors: string[];
    /** Any validation warnings (non-blocking issues) */
    warnings: string[];
    /** Timestamp of the validation */
    timestamp: string;
}