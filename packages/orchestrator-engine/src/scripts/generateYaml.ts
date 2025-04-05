#!/usr/bin/env ts-node

import * as fs from "fs";
import * as path from "path";
import * as csv from "csv-parse/sync";
import { stringify as stringifyYaml } from "yaml";
import chalk from "chalk";

const INPUT_CSV = path.join(__dirname, "../../data/quotas/QuotaUsage_2025-04-04T14_42_52.csv");
const OUTPUT_YAML = path.join(__dirname, "../../data/quotas/live-quotas.yaml");

// Check for Azure credentials at startup
const azureSubscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
const azureTenantId = process.env.AZURE_TENANT_ID;
const azureConnected = !!(azureSubscriptionId && azureTenantId);

console.log(chalk.blue("🔍 Checking environment..."));

if (!azureConnected) {
    console.log(chalk.yellow("⚠️ Azure credentials missing. Using local CSV data only."));
    console.log(chalk.yellow("ℹ️ Set AZURE_SUBSCRIPTION_ID and AZURE_TENANT_ID environment variables for live data."));
} else {
    console.log(chalk.green("✅ Azure credentials found."));
    // In a real implementation, we would fetch the latest quota data from Azure here
}

(async function generateYaml() {
    try {
        // Check if input CSV exists
        if (!fs.existsSync(INPUT_CSV)) {
            console.error(chalk.red(`❌ Input CSV file not found: ${INPUT_CSV}`));
            console.log(chalk.yellow("Please ensure the CSV file exists or update the path."));
            process.exit(1);
        }

        const rawCsv = fs.readFileSync(INPUT_CSV, "utf-8");
        const records = csv.parse(rawCsv, {
            columns: true,
            skip_empty_lines: true
        });

        const quotaData: any = {};

        for (const row of records) {
            const region = row["region"];
            const sku = row["sku"];
            const total = parseInt(row["total"], 10);
            const used = parseInt(row["used"], 10);
            const assignedString = row["assigned_to"] || "";
            const assignedRoles = assignedString.split(";").map((r: string) => r.trim()).filter(Boolean);

            if (!quotaData[region]) {
                quotaData[region] = {};
            }
            quotaData[region][sku] = {
                total,
                used,
                available: total - used,
                assigned_to: assignedRoles
            };
        }

        // Create output directory if it doesn't exist
        const outputDir = path.dirname(OUTPUT_YAML);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const yamlOutput = stringifyYaml(quotaData);
        fs.writeFileSync(OUTPUT_YAML, yamlOutput, "utf8");
        console.log(chalk.green(`✅ YAML mapping file generated at: ${OUTPUT_YAML}`));

        // Note about data source
        if (!azureConnected) {
            console.log(chalk.yellow("⚠️ Note: Data is from local CSV only. Set Azure credentials for live data."));
        }

    } catch (err) {
        console.error(chalk.red(`❌ Error generating YAML: ${err}`));
        process.exit(1);
    }
})();