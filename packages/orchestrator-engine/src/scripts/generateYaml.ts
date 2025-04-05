#!/usr/bin/env ts-node

import * as fs from "fs";
import * as path from "path";
import * as csv from "csv-parse/sync";
import { stringify as stringifyYaml } from "yaml";

const INPUT_CSV = path.join(__dirname, "../../data/quotas/QuotaUsage_2025-04-04T14_42_52.csv");
const OUTPUT_YAML = path.join(__dirname, "../../data/quotas/live-quotas.yaml");

(async function generateYaml() {
    try {
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

        const yamlOutput = stringifyYaml(quotaData);
        fs.writeFileSync(OUTPUT_YAML, yamlOutput, "utf8");
        console.log(`✅ YAML mapping file generated at: ${OUTPUT_YAML}`);
    } catch (err) {
        console.error("❌ Error generating YAML:", err);
        process.exit(1);
    }
})();