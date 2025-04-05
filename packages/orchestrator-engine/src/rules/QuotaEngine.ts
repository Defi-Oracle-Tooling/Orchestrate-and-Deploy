import * as fs from "fs";
import * as yaml from "yaml";
import * as path from "path";

export class QuotaEngine {
    private data: any = {};

    constructor(
        private quotaFile = path.join(__dirname, "../../data/quotas/live-quotas.yaml")
    ) {
        if (!fs.existsSync(this.quotaFile)) {
            throw new Error(`Quota file not found: ${this.quotaFile}`);
        }
        this.loadData();
    }

    private loadData(): void {
        const fileContent = fs.readFileSync(this.quotaFile, "utf-8");
        this.data = yaml.parse(fileContent);
    }

    public validateQuota(region: string, role: string): boolean {
        const regionData = this.data[region];
        if (!regionData) {
            return false;
        }
        for (const sku of Object.keys(regionData)) {
            const details = regionData[sku];
            if (details.assigned_to.includes(role) && details.available > 0) {
                return true;
            }
        }
        return false;
    }

    public suggestRegion(role: string): string {
        for (const region of Object.keys(this.data)) {
            const regionData = this.data[region];
            for (const sku of Object.keys(regionData)) {
                const details = regionData[sku];
                if (details.assigned_to.includes(role) && details.available > 0) {
                    return region;
                }
            }
        }
        return `No region found with available quota for role '${role}'.`;
    }

    public summarizeAvailability(role: string): Record<string, any> {
        const summary: Record<string, any> = {};
        for (const region of Object.keys(this.data)) {
            let total = 0;
            let used = 0;
            let available = 0;
            for (const sku of Object.keys(this.data[region])) {
                const details = this.data[region][sku];
                if (details.assigned_to.includes(role)) {
                    total += details.total;
                    used += details.used;
                    available += details.available;
                }
            }
            if (total > 0) {
                summary[region] = {
                    total,
                    used,
                    available,
                    usage_percent: ((used / total) * 100).toFixed(2)
                };
            }
        }
        return summary;
    }
}