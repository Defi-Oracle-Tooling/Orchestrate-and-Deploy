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
exports.BesuConfigurator = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const ConnectivityService_1 = require("../utils/ConnectivityService");
const TelemetryService_1 = require("../utils/TelemetryService");
const RetryUtils_1 = require("../utils/RetryUtils");
/**
 * BesuConfigurator manages the lifecycle of Hyperledger Besu nodes:
 *  - Reads config from JSON/XML.
 *  - Deploys or updates nodes.
 *  - Maintains version history for rollback.
 */
class BesuConfigurator {
    constructor() {
        this.versionHistoryDir = path.join(__dirname, "../../versions");
        // Initialize telemetry
        TelemetryService_1.TelemetryService.initialize();
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
    async initialize() {
        try {
            TelemetryService_1.TelemetryService.trackEvent('BesuConfiguratorInitializing');
            // Check all connectivity requirements at once using the centralized service
            this.connectionState = await ConnectivityService_1.ConnectivityService.checkConnections();
            ConnectivityService_1.ConnectivityService.logConnectionStatus(this.connectionState);
            TelemetryService_1.TelemetryService.trackEvent('BesuConfiguratorInitialized', {
                azureConnected: this.connectionState.azureConnected.toString(),
                besuAvailable: this.connectionState.besuAvailable.toString()
            });
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Failed to initialize BesuConfigurator: ${error instanceof Error ? error.message : String(error)}`));
            TelemetryService_1.TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'BesuConfiguratorInitialize'
            });
        }
    }
    async deploy(configPath) {
        console.log(chalk_1.default.blue("Deploying Besu with config at: " + configPath));
        // Make sure we've initialized
        if (!this.connectionState.messages) {
            await this.initialize();
        }
        TelemetryService_1.TelemetryService.trackEvent('BesuDeployStarted', {
            configPath
        });
        // Pre-flight checks before attempting deployment
        if (!this.connectionState.besuAvailable) {
            const errorMsg = "❌ Cannot deploy: Besu network is not available";
            console.log(chalk_1.default.red(errorMsg));
            console.log(chalk_1.default.yellow("ℹ️ Set BESU_ENDPOINT environment variable to enable deployment"));
            TelemetryService_1.TelemetryService.trackEvent('BesuDeployFailed', {
                reason: 'BesuUnavailable',
                configPath
            });
            return;
        }
        // Azure-specific operations check
        if (!this.connectionState.azureConnected && process.env.DEPLOY_TO_AZURE === 'true') {
            console.log(chalk_1.default.yellow("⚠️ Azure credentials not found but DEPLOY_TO_AZURE is set"));
            console.log(chalk_1.default.yellow("ℹ️ Azure deployment steps will be skipped"));
            TelemetryService_1.TelemetryService.trackEvent('BesuDeployWarning', {
                warning: 'AzureCredentialsMissing',
                configPath
            });
        }
        // Check if config file exists
        if (!ConnectivityService_1.ConnectivityService.verifyFileExists(configPath, `Configuration file not found: ${configPath}`)) {
            TelemetryService_1.TelemetryService.trackEvent('BesuDeployFailed', {
                reason: 'ConfigFileNotFound',
                configPath
            });
            return;
        }
        try {
            // Use retry pattern for file operations as well
            await (0, RetryUtils_1.executeWithRetry)(async () => {
                // 1. Load config
                const configContents = fs.readFileSync(configPath, "utf8");
                // Validate config structure (basic JSON validation)
                JSON.parse(configContents);
                // 2. Save configuration version
                const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
                const versionFilePath = path.join(this.versionHistoryDir, `besu-config-${timestamp}.json`);
                fs.writeFileSync(versionFilePath, configContents);
                console.log(chalk_1.default.green("Besu configuration saved for version tracking."));
                // 3. In a real implementation, this would deploy to Besu nodes
                // Simulate successful deployment
                await this.simulateBesuDeployment(configContents);
                return true;
            }, {
                maxRetries: 2,
                operationName: 'BesuDeploy'
            });
            console.log(chalk_1.default.green("✅ Configuration deployed to local version history"));
            TelemetryService_1.TelemetryService.trackEvent('BesuDeploySucceeded', {
                configPath
            });
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Failed to deploy Besu configuration: ${error instanceof Error ? error.message : String(error)}`));
            TelemetryService_1.TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'BesuDeploy',
                configPath
            });
        }
    }
    /**
     * Simulate a deployment to Besu network
     * @param configContents Config to deploy
     */
    async simulateBesuDeployment(configContents) {
        // In a real implementation, this would make API calls to Besu
        console.log(chalk_1.default.blue("📡 Simulating deployment to Besu network..."));
        // Artificial delay to simulate network activity
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log(chalk_1.default.green("✅ Besu network nodes updated"));
    }
    async rollbackToVersion(versionLabel) {
        if (!versionLabel) {
            console.log(chalk_1.default.red("No version specified for rollback."));
            TelemetryService_1.TelemetryService.trackEvent('BesuRollbackFailed', {
                reason: 'NoVersionSpecified'
            });
            return;
        }
        // Make sure we've initialized
        if (!this.connectionState.messages) {
            await this.initialize();
        }
        TelemetryService_1.TelemetryService.trackEvent('BesuRollbackStarted', {
            versionLabel
        });
        // Pre-flight checks before attempting rollback
        if (!this.connectionState.besuAvailable) {
            console.log(chalk_1.default.red("❌ Cannot rollback: Besu network is not available"));
            console.log(chalk_1.default.yellow("ℹ️ Set BESU_ENDPOINT environment variable to enable rollback"));
            TelemetryService_1.TelemetryService.trackEvent('BesuRollbackFailed', {
                reason: 'BesuUnavailable',
                versionLabel
            });
            return;
        }
        console.log(chalk_1.default.yellow(`Rolling back to version: ${versionLabel}`));
        try {
            await (0, RetryUtils_1.executeWithRetry)(async () => {
                // Find the config file that matches the label (timestamp or tag)
                const versionFiles = fs.readdirSync(this.versionHistoryDir);
                const matchingFile = versionFiles.find(file => file.includes(versionLabel));
                if (!matchingFile) {
                    throw new Error(`No version found matching: ${versionLabel}`);
                }
                // Load the old config
                const oldConfigPath = path.join(this.versionHistoryDir, matchingFile);
                const oldConfig = fs.readFileSync(oldConfigPath, 'utf8');
                console.log(chalk_1.default.green(`✅ Found version file: ${matchingFile}`));
                // In a real implementation, deployment logic would go here
                await this.simulateBesuDeployment(oldConfig);
                return true;
            }, {
                maxRetries: 2,
                operationName: 'BesuRollback'
            });
            console.log(chalk_1.default.green(`✅ Successfully rolled back to version: ${versionLabel}`));
            TelemetryService_1.TelemetryService.trackEvent('BesuRollbackSucceeded', {
                versionLabel
            });
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Rollback failed: ${error instanceof Error ? error.message : String(error)}`));
            TelemetryService_1.TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'BesuRollback',
                versionLabel
            });
        }
    }
    /**
     * ValidationResult contains the result of a configuration validation operation
     */
    async validateConfiguration(configPath) {
        console.log(chalk_1.default.blue(`Validating Besu configuration at: ${configPath}`));
        // Track validation operation
        TelemetryService_1.TelemetryService.trackEvent('BesuConfigValidationStarted', {
            configPath
        });
        const result = {
            valid: true,
            errors: [],
            warnings: [],
            timestamp: new Date().toISOString()
        };
        try {
            // Check if file exists
            if (!ConnectivityService_1.ConnectivityService.verifyFileExists(configPath)) {
                result.valid = false;
                result.errors.push(`Configuration file not found: ${configPath}`);
                return result;
            }
            // Use retry for file operations
            await (0, RetryUtils_1.executeWithRetry)(async () => {
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
                        }
                        else {
                            // Validate each node
                            config.nodes.forEach((node, index) => {
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
                        }
                        else if (!['ibft2', 'qbft', 'raft', 'ethash', 'clique'].includes(config.consensus)) {
                            result.warnings.push(`Consensus mechanism '${config.consensus}' may not be supported`);
                        }
                    }
                    else if (fileExt === '.xml') {
                        // For XML, we would need a proper XML parser
                        // This is a simplified placeholder
                        if (!configContents.includes('<network>')) {
                            result.errors.push("Missing required 'network' element in configuration");
                        }
                        if (!configContents.includes('<nodes>')) {
                            result.errors.push("Configuration must contain a 'nodes' element");
                        }
                    }
                    else {
                        result.errors.push(`Unsupported configuration file format: ${fileExt}`);
                    }
                }
                catch (parseError) {
                    result.valid = false;
                    result.errors.push(`Configuration parsing error: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
                }
                return true;
            }, {
                maxRetries: 2,
                operationName: 'ValidateBesuConfig'
            });
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Validation error: ${error instanceof Error ? error.message : String(error)}`));
            result.valid = false;
            result.errors.push(`Validation process failed: ${error instanceof Error ? error.message : String(error)}`);
            TelemetryService_1.TelemetryService.trackException(error instanceof Error ? error : new Error(String(error)), {
                operation: 'ValidateBesuConfig',
                configPath
            });
        }
        // Set final validation status
        result.valid = result.errors.length === 0;
        // Log validation result
        if (result.valid) {
            console.log(chalk_1.default.green("✅ Configuration validation passed"));
            if (result.warnings.length > 0) {
                console.log(chalk_1.default.yellow(`⚠️ ${result.warnings.length} warnings found`));
                result.warnings.forEach(warn => console.log(chalk_1.default.yellow(`   - ${warn}`)));
            }
        }
        else {
            console.log(chalk_1.default.red(`❌ Configuration validation failed with ${result.errors.length} errors`));
            result.errors.forEach(err => console.log(chalk_1.default.red(`   - ${err}`)));
        }
        // Track validation result
        TelemetryService_1.TelemetryService.trackEvent('BesuConfigValidationCompleted', {
            configPath,
            valid: result.valid.toString(),
            errorCount: result.errors.length.toString(),
            warningCount: result.warnings.length.toString()
        });
        return result;
    }
}
exports.BesuConfigurator = BesuConfigurator;
