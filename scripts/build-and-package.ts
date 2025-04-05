#!/usr/bin/env ts-node

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as archiver from "archiver";

try {
    console.log("1. Installing dependencies...");
    execSync("pnpm install", { stdio: "inherit" });

    console.log("2. Building all packages in parallel...");
    execSync("pnpm build", { stdio: "inherit" });

    console.log("3. Running tests in parallel...");
    execSync("pnpm test", { stdio: "inherit" });

    console.log("4. Generating documentation...");
    execSync("pnpm doc", { stdio: "inherit" });

    console.log("5. Creating an archive of the entire repository...");
    const output = fs.createWriteStream(path.join(__dirname, "../full-solution.zip"));
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(output);
    archive.directory(path.join(__dirname, ".."), false);
    archive.finalize();

    console.log("✅ Build, test, and packaging complete. Archive created: full-solution.zip");
} catch (err) {
    console.error("❌ Error during build-and-package:", err);
    process.exit(1);
}