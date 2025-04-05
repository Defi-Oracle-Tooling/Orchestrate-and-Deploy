import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { QuotaEngine } from "./rules/QuotaEngine";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const port = process.env.ORCHESTRATOR_PORT || 3000;
const quotaEngine = new QuotaEngine();

// RESTful endpoints
app.get("/api/quotas", (req, res) => {
    const { region, role } = req.query;

    // Load fresh data for each request
    const engine = new QuotaEngine();
    let data = engine["data"]; // direct access for demonstration

    if (region) {
        data = Object.keys(data)
            .filter((r) => r.toLowerCase() === (region as string).toLowerCase())
            .reduce((acc: any, key) => {
                acc[key] = data[key];
                return acc;
            }, {});
    }

    if (role) {
        for (const r of Object.keys(data)) {
            const filteredQuotas: any = {};
            for (const sku of Object.keys(data[r])) {
                if (data[r][sku].assigned_to.includes(role)) {
                    filteredQuotas[sku] = data[r][sku];
                }
            }
            data[r] = filteredQuotas;
        }
        // remove any region with no SKUs left
        for (const regionKey of Object.keys(data)) {
            if (Object.keys(data[regionKey]).length === 0) {
                delete data[regionKey];
            }
        }
    }

    return res.json(data);
});

// Additional endpoint for capacity expansion or suggestions
app.get("/api/quotas/suggestions/:role", (req, res) => {
    const { role } = req.params;
    const suggestion = quotaEngine.suggestRegion(role);
    return res.json({ suggestion });
});

// Start server
app.listen(port, () => {
    console.log(`Orchestrator Engine listening at http://localhost:${port}`);
});