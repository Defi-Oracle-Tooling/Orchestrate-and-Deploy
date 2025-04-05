#!/usr/bin/env ts-node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const BesuConfigurator_1 = require("./services/BesuConfigurator");
const ConnectivityService_1 = require("./utils/ConnectivityService");
const TelemetryService_1 = require("./utils/TelemetryService");
const program = new commander_1.Command();
program
    .name("blockchain-config")
    .description("Hyperledger Besu (and beyond) configuration & deployment tool")
    .version("1.0.0");
program
    .command("deploy-besu")
    .description("Deploy or update Hyperledger Besu blockchain nodes with custom configs")
    .option("--config <path>", "Path to JSON or XML config file", "./config/besu-config.json")
    .action(async (opts) => {
    const configurator = new BesuConfigurator_1.BesuConfigurator();
    await configurator.deploy(opts.config);
    console.log(chalk_1.default.green("✅ Besu deployment completed"));
});
program
    .command("rollback")
    .description("Rollback to a previous version of blockchain configuration")
    .option("--version <label>", "Version or tag to rollback to", "")
    .action(async (opts) => {
    const configurator = new BesuConfigurator_1.BesuConfigurator();
    await configurator.rollbackToVersion(opts.version);
});
program
    .command("health-check")
    .description("Check connectivity status to Azure and Besu")
    .action(async () => {
    const configurator = new BesuConfigurator_1.BesuConfigurator();
    await configurator.initialize(); // This will perform connectivity checks
    // Get the connection state from the configurator
    const connectionState = await ConnectivityService_1.ConnectivityService.checkConnections();
    console.log(chalk_1.default.blue("🔍 System Health Check"));
    console.log("----------------------------------------");
    console.log(`Azure API: ${connectionState.azureConnected ? chalk_1.default.green('Connected ✅') : chalk_1.default.yellow('Disconnected ⚠️')}`);
    console.log(`Besu Network: ${connectionState.besuAvailable ? chalk_1.default.green('Available ✅') : chalk_1.default.yellow('Unavailable ⚠️')}`);
    if (connectionState.messages.length > 0) {
        console.log(chalk_1.default.yellow("\n⚠️ Warnings:"));
        connectionState.messages.forEach(msg => console.log(`- ${msg}`));
    }
    // Track health check execution
    TelemetryService_1.TelemetryService.trackEvent('HealthCheckExecuted', {
        azureConnected: connectionState.azureConnected.toString(),
        besuAvailable: connectionState.besuAvailable.toString(),
        warningCount: connectionState.messages.length.toString()
    });
    console.log("\nTimestamp:", new Date().toISOString());
});
// Add configuration validation command
program
    .command("validate-config")
    .description("Validate a Besu configuration file")
    .option("--config <path>", "Path to JSON or XML config file", "./config/besu-config.json")
    .action(async (opts) => {
    const configurator = new BesuConfigurator_1.BesuConfigurator();
    await configurator.initialize();
    const result = await configurator.validateConfiguration(opts.config);
    if (result.valid) {
        console.log(chalk_1.default.green("\n✅ Configuration is valid"));
    }
    else {
        console.log(chalk_1.default.red("\n❌ Configuration is invalid"));
    }
    if (result.warnings.length > 0) {
        console.log(chalk_1.default.yellow("\nWarnings:"));
        result.warnings.forEach(warning => {
            console.log(chalk_1.default.yellow(`  - ${warning}`));
        });
    }
});
program.parse(process.argv);
