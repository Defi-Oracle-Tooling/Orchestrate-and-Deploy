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

        // Ensure Besu is available before proceeding
        if (!this.connectionState.besuAvailable) {
            console.log(chalk.red("Cannot deploy: Besu network not available"));
            TelemetryService.trackEvent('BesuDeploySkipped', {
                reason: 'BesuUnavailable'
            });
            return;
        }

        // Log a warning if Azure credentials are missing
        if (!this.connectionState.azureConnected) {
            console.log(chalk.yellow("⚠️ Azure credentials not found. Proceeding with local deployment only."));
        }

        // Ensure the configuration file exists
        if (!fs.existsSync(configPath)) {
            console.error(chalk.red(`❌ Configuration file not found: ${configPath}`));
            TelemetryService.trackEvent('BesuDeployFailed', {
                reason: 'ConfigFileNotFound',
                configPath
            });
            return;
        }

        try {
            // Load and validate the configuration file
            const configContents = fs.readFileSync(configPath, "utf8");
            const config = JSON.parse(configContents); // Basic JSON validation

            // Check for bridging settings
            if (config.bridging && config.bridging.enableCCIP) {
                console.log(chalk.blue("📡 Initializing CCIP bridging..."));
                console.log(chalk.blue(`🔗 CCIP Node URL: ${config.bridging.ccipNodeUrl}`));
            }

            // Save a versioned copy of the configuration
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const versionFilePath = path.join(this.versionHistoryDir, `besu-config-${timestamp}.json`);
            fs.writeFileSync(versionFilePath, configContents);
            console.log(chalk.green("✅ Configuration saved for version tracking."));

            // Simulate deployment
            await this.simulateBesuDeployment(configContents);

            console.log(chalk.green("✅ Besu deployment completed successfully."));
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
        if (!this.connectionState.besuAvailable) {
            console.log(chalk.red("Cannot rollback: Besu network not available"));
            TelemetryService.trackEvent('BesuRollbackSkipped', {
                reason: 'BesuUnavailable'
            });
            return;
        }

        if (!versionLabel) {
            console.log(chalk.red("No version specified for rollback."));
            TelemetryService.trackEvent('BesuRollbackFailed', {
                reason: 'NoVersionSpecified'
            });
            return;
        }

        console.log(chalk.yellow(`Rolling back to version: ${versionLabel}`));

        try {
            // Find the version file
            const versionFiles = fs.readdirSync(this.versionHistoryDir);
            const matchingFile = versionFiles.find(file => file.includes(versionLabel));

            if (!matchingFile) {
                throw new Error(`No version found matching: ${versionLabel}`);
            }

            const oldConfigPath = path.join(this.versionHistoryDir, matchingFile);
            const oldConfig = fs.readFileSync(oldConfigPath, 'utf8');

            console.log(chalk.green(`✅ Found version file: ${matchingFile}`));

            // Simulate deployment of the old configuration
            await this.simulateBesuDeployment(oldConfig);

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
     * Save configuration with versioning
     * Supports both JSON and XML configurations.
     * @param configPath Path to the configuration file
     */
    public async saveConfigWithVersioning(configPath: string): Promise<void> {
        try {
            // Check if the configuration file exists
            if (!fs.existsSync(configPath)) {
                throw new Error(`Configuration file not found: ${configPath}`);
            }

            // Read the configuration file
            const configContents = fs.readFileSync(configPath, "utf8");
            const fileExt = path.extname(configPath).toLowerCase();

            // Validate the configuration based on its format
            if (fileExt === ".json") {
                JSON.parse(configContents); // Basic JSON validation
            } else if (fileExt === ".xml") {
                if (!configContents.includes("<network>")) {
                    throw new Error("Invalid XML configuration: Missing <network> element");
                }
            } else {
                throw new Error(`Unsupported configuration file format: ${fileExt}`);
            }

            // Save a versioned copy of the configuration
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const versionFilePath = path.join(this.versionHistoryDir, `besu-config-${timestamp}${fileExt}`);
            fs.writeFileSync(versionFilePath, configContents);

            console.log(chalk.green(`✅ Configuration saved with versioning at: ${versionFilePath}`));

            TelemetryService.trackEvent("ConfigVersioningSaved", {
                configPath,
                versionFilePath
            });
        } catch (error) {
            console.error(chalk.red(`❌ Failed to save configuration with versioning: ${error instanceof Error ? error.message : String(error)}`));
            TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: "SaveConfigWithVersioning",
                configPath
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