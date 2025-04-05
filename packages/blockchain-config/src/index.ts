#!/usr/bin/env ts-node

import { Command } from "commander";
import chalk from "chalk";
import { BesuConfigurator } from "./services/BesuConfigurator";
import { ConnectivityService } from "./utils/ConnectivityService";
import { TelemetryService } from "./utils/TelemetryService";

const program = new Command();

program
    .name("blockchain-config")
    .description("Hyperledger Besu (and beyond) configuration & deployment tool")
    .version("1.0.0");

program
    .command("deploy-besu")
    .description("Deploy or update Hyperledger Besu blockchain nodes with custom configs")
    .option("--config <path>", "Path to JSON or XML config file", "./config/besu-config.json")
    .action(async (opts) => {
        const configurator = new BesuConfigurator();
        await configurator.deploy(opts.config);
        console.log(chalk.green("✅ Besu deployment completed"));
    });

program
    .command("rollback")
    .description("Rollback to a previous version of blockchain configuration")
    .option("--version <label>", "Version or tag to rollback to", "")
    .action(async (opts) => {
        const configurator = new BesuConfigurator();
        await configurator.rollbackToVersion(opts.version);
    });

program
    .command("health-check")
    .description("Check connectivity status to Azure and Besu")
    .action(async () => {
        const configurator = new BesuConfigurator();
        await configurator.initialize(); // This will perform connectivity checks

        // Get the connection state from the configurator
        const connectionState = await ConnectivityService.checkConnections();

        console.log(chalk.blue("🔍 System Health Check"));
        console.log("----------------------------------------");
        console.log(`Azure API: ${connectionState.azureConnected ? chalk.green('Connected ✅') : chalk.yellow('Disconnected ⚠️')}`);
        console.log(`Besu Network: ${connectionState.besuAvailable ? chalk.green('Available ✅') : chalk.yellow('Unavailable ⚠️')}`);

        if (connectionState.messages.length > 0) {
            console.log(chalk.yellow("\n⚠️ Warnings:"));
            connectionState.messages.forEach(msg => console.log(`- ${msg}`));
        }

        // Track health check execution
        TelemetryService.trackEvent('HealthCheckExecuted', {
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
        const configurator = new BesuConfigurator();
        await configurator.initialize();

        const result = await configurator.validateConfiguration(opts.config);

        if (result.valid) {
            console.log(chalk.green("\n✅ Configuration is valid"));
        } else {
            console.log(chalk.red("\n❌ Configuration is invalid"));
        }

        if (result.warnings.length > 0) {
            console.log(chalk.yellow("\nWarnings:"));
            result.warnings.forEach(warning => {
                console.log(chalk.yellow(`  - ${warning}`));
            });
        }
    });

program.parse(process.argv);