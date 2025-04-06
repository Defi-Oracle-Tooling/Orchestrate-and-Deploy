#!/usr/bin/env ts-node

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";

const OUTPUT_ZIP = path.join(__dirname, "../full-solution.zip");

try {
    console.log(chalk.blue("🔍 Starting full build, test, and package pipeline..."));

    // Step 1: Install dependencies
    console.log(chalk.blue("📦 Installing dependencies..."));
    execSync("pnpm install", { stdio: "inherit" });

    // Step 2: Build all packages
    console.log(chalk.blue("🏗️ Building all packages..."));
    execSync("pnpm build", { stdio: "inherit" });

    // Step 3: Run all tests
    console.log(chalk.blue("🧪 Running all tests..."));
    execSync("pnpm test", { stdio: "inherit" });

    // Step 4: Generate documentation
    console.log(chalk.blue("📚 Generating documentation..."));
    execSync("pnpm doc", { stdio: "inherit" });

    // Step 5: Package the solution
    console.log(chalk.blue("📦 Packaging the solution..."));
    if (fs.existsSync(OUTPUT_ZIP)) {
        fs.unlinkSync(OUTPUT_ZIP);
    }
    execSync(`zip -r ${OUTPUT_ZIP} . -x "node_modules/*" -x "**/node_modules/*"`, { stdio: "inherit" });

    console.log(chalk.green(`✅ Full solution packaged successfully at: ${OUTPUT_ZIP}`));
} catch (error) {
    console.error(chalk.red(`❌ Pipeline failed: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
}