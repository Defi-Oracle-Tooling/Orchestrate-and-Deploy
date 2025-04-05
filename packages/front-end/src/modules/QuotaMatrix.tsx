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

interface RecommendationDetails {
    region: string;
    sku: string;
    availableQuota: number;
    confidence: number;
    reasons: string[];
}

interface RecommendationRequest {
    role: string;
    minimumQuota: number;
    preferredRegions?: string[];
}

const QuotaMatrix: React.FC = () => {
    const [data, setData] = useState<QuotaData>({});
    const [filterRegion, setFilterRegion] = useState<string>("");
    const [filterRole, setFilterRole] = useState<string>("");
    const [recommendations, setRecommendations] = useState<RecommendationDetails[]>([]);
    const [showRecommendations, setShowRecommendations] = useState(false);
    const [recommendationRole, setRecommendationRole] = useState("");
    const [minimumQuota, setMinimumQuota] = useState(1);
    const [preferredRegions, setPreferredRegions] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const fetchData = async () => {
        try {
            const response = await axios.get("/api/quotas", {
                params: {
                    region: filterRegion,
                    role: filterRole
                }
            });
            setData(response.data.data || {});
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

    const handleGetRecommendations = async () => {
        if (!recommendationRole) {
            alert("Please select a role for recommendations");
            return;
        }

        setIsLoading(true);
        try {
            const request: RecommendationRequest = {
                role: recommendationRole,
                minimumQuota: minimumQuota,
                preferredRegions: preferredRegions ? preferredRegions.split(",").map(r => r.trim()) : undefined
            };

            const response = await axios.post("/api/quotas/recommendations", request);
            setRecommendations(response.data.recommendations || []);
            setShowRecommendations(true);
        } catch (err) {
            console.error("Error fetching recommendations:", err);
            alert("Failed to get recommendations. See console for details.");
        } finally {
            setIsLoading(false);
        }
    };

    const renderRecommendations = () => {
        if (!showRecommendations) return null;

        return (
            <div style={{ marginTop: '20px', border: '1px solid #ccc', padding: '15px', borderRadius: '5px' }}>
                <h3>Resource Allocation Recommendations</h3>
                {recommendations.length === 0 ? (
                    <p>No recommendations found for the selected criteria.</p>
                ) : (
                    <div>
                        <p>Found {recommendations.length} recommendations for role <strong>{recommendationRole}</strong></p>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'left' }}>Region</th>
                                    <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'left' }}>SKU</th>
                                    <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'left' }}>Available Quota</th>
                                    <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'left' }}>Confidence</th>
                                    <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'left' }}>Reasons</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recommendations.map((rec, index) => (
                                    <tr key={index} style={{ backgroundColor: index === 0 ? '#e6f7ff' : 'transparent' }}>
                                        <td style={{ border: '1px solid #ccc', padding: '8px' }}>{rec.region}</td>
                                        <td style={{ border: '1px solid #ccc', padding: '8px' }}>{rec.sku}</td>
                                        <td style={{ border: '1px solid #ccc', padding: '8px' }}>{rec.availableQuota}</td>
                                        <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                                            <div style={{
                                                width: `${rec.confidence}%`,
                                                backgroundColor: rec.confidence > 80 ? 'green' : rec.confidence > 60 ? 'lightgreen' : 'orange',
                                                height: '20px',
                                                borderRadius: '3px',
                                                color: 'white',
                                                textAlign: 'center',
                                                lineHeight: '20px'
                                            }}>
                                                {rec.confidence}%
                                            </div>
                                        </td>
                                        <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                                            <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                                {rec.reasons.map((reason, i) => (
                                                    <li key={i}>{reason}</li>
                                                ))}
                                            </ul>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

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
                <button
                    onClick={fetchData}
                    style={{ marginLeft: '10px', padding: '5px 10px' }}
                >
                    Refresh Data
                </button>
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
                                let bgColor = usagePercent > 80 ? "#ffcccc" : usagePercent > 50 ? "#ffffcc" : "#ccffcc";
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
                                            ? `${available}/${total} (${(100 - usagePercent).toFixed(0)}% free)`
                                            : "N/A"}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>

            <div style={{ marginTop: '30px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
                <h3>Get Deployment Recommendations</h3>
                <div style={{ marginBottom: '10px' }}>
                    <label>
                        Role:&nbsp;
                        <select
                            value={recommendationRole}
                            onChange={(e) => setRecommendationRole(e.target.value)}
                            style={{ padding: '5px', width: '150px' }}
                        >
                            <option value="">Select a role</option>
                            {roles.map(role => (
                                <option key={role} value={role}>{role}</option>
                            ))}
                        </select>
                    </label>
                </div>
                <div style={{ marginBottom: '10px' }}>
                    <label>
                        Minimum Quota Required:&nbsp;
                        <input
                            type="number"
                            min="1"
                            value={minimumQuota}
                            onChange={(e) => setMinimumQuota(parseInt(e.target.value) || 1)}
                            style={{ padding: '5px', width: '60px' }}
                        />
                    </label>
                </div>
                <div style={{ marginBottom: '10px' }}>
                    <label>
                        Preferred Regions (comma-separated):&nbsp;
                        <input
                            type="text"
                            value={preferredRegions}
                            onChange={(e) => setPreferredRegions(e.target.value)}
                            placeholder="e.g., eastus, westeurope"
                            style={{ padding: '5px', width: '250px' }}
                        />
                    </label>
                </div>
                <button
                    onClick={handleGetRecommendations}
                    disabled={isLoading}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: '#0078d4',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isLoading ? 'wait' : 'pointer'
                    }}
                >
                    {isLoading ? 'Loading...' : 'Get Recommendations'}
                </button>
            </div>

            {renderRecommendations()}
        </div>
    );
};

export default QuotaMatrix;