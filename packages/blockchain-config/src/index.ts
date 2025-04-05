#!/usr/bin/env ts-node

import { Command } from "commander";
import chalk from "chalk";
import { BesuConfigurator } from "./services/BesuConfigurator";

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

program.parse(process.argv);