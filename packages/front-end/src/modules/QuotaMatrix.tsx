import React, { useEffect, useState } from "react";
import axios from "axios";

interface Quota {
    total: number;
    used: number;
    available: number;
    assigned_to: string[];
}

interface QuotaData {
    [region: string]: {
        [sku: string]: Quota;
    };
}

const QuotaMatrix: React.FC = () => {
    const [data, setData] = useState<QuotaData>({});
    const [filterRegion, setFilterRegion] = useState<string>("");
    const [filterRole, setFilterRole] = useState<string>("");

    const fetchData = async () => {
        try {
            const response = await axios.get("/api/quotas", {
                params: {
                    region: filterRegion,
                    role: filterRole
                }
            });
            setData(response.data);
        } catch (err) {
            console.error("Error fetching quota data:", err);
        }
    };

    useEffect(() => {
        fetchData();
    }, [filterRegion, filterRole]);

    const regions = Object.keys(data);
    const allRoles = new Set<string>();

    regions.forEach((region) => {
        const regionData = data[region];
        Object.values(regionData).forEach((quota) => {
            quota.assigned_to.forEach((role) => allRoles.add(role));
        });
    });
    const roles = Array.from(allRoles);

    return (
        <div>
            <h2>Available Quota Matrix</h2>
            <div style={{ marginBottom: "1rem" }}>
                <label>Filter by Region: &nbsp;
                    <input
                        value={filterRegion}
                        onChange={(e) => setFilterRegion(e.target.value)}
                        placeholder="e.g., eastus"
                    />
                </label>
                &nbsp;&nbsp;
                <label>Filter by Role: &nbsp;
                    <input
                        value={filterRole}
                        onChange={(e) => setFilterRole(e.target.value)}
                        placeholder="e.g., validator"
                    />
                </label>
            </div>
            <table style={{ borderCollapse: "collapse" }}>
                <thead>
                    <tr>
                        <th style={{ border: "1px solid #ccc", padding: "4px" }}>Node Role</th>
                        {regions.map((region) => (
                            <th key={region} style={{ border: "1px solid #ccc", padding: "4px" }}>
                                {region}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {roles.map((role) => (
                        <tr key={role}>
                            <td style={{ border: "1px solid #ccc", padding: "4px" }}>{role}</td>
                            {regions.map((region) => {
                                let total = 0;
                                let used = 0;
                                let available = 0;
                                const regionData = data[region];
                                Object.values(regionData).forEach((quota) => {
                                    if (quota.assigned_to.includes(role)) {
                                        total += quota.total;
                                        used += quota.used;
                                        available += quota.available;
                                    }
                                });
                                const usagePercent = total > 0 ? (used / total) * 100 : 0;
                                let bgColor = usagePercent > 80 ? "red" : usagePercent > 50 ? "yellow" : "green";
                                return (
                                    <td
                                        key={`${region}-${role}`}
                                        style={{
                                            border: "1px solid #ccc",
                                            padding: "4px",
                                            backgroundColor: bgColor
                                        }}
                                    >
                                        {total > 0
                                            ? `${used}/${total} (${usagePercent.toFixed(0)}%)`
                                            : "N/A"}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default QuotaMatrix;