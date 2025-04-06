import React, { useState, useEffect } from "react";
import axios from "axios";
import "./QuotaMatrix.css"; // Assuming a CSS file for styling

interface QuotaData {
    [region: string]: {
        [sku: string]: {
            total: number;
            used: number;
            available: number;
            assigned_to: string[];
        };
    };
}

const QuotaMatrix: React.FC = () => {
    const [quotaData, setQuotaData] = useState<QuotaData>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [regionFilter, setRegionFilter] = useState("");
    const [roleFilter, setRoleFilter] = useState("");

    useEffect(() => {
        const fetchQuotaData = async () => {
            try {
                const response = await axios.get("/api/quotas");
                setQuotaData(response.data);
            } catch (err) {
                setError("Failed to fetch quota data.");
            } finally {
                setLoading(false);
            }
        };

        fetchQuotaData();
    }, []);

    const filteredData = Object.entries(quotaData)
        .filter(([region]) => region.toLowerCase().includes(regionFilter.toLowerCase()))
        .reduce((acc, [region, skus]) => {
            const filteredSkus = Object.entries(skus)
                .filter(([_, details]) =>
                    details.assigned_to.some(role => role.toLowerCase().includes(roleFilter.toLowerCase()))
                )
                .reduce((skuAcc, [sku, details]) => {
                    skuAcc[sku] = details;
                    return skuAcc;
                }, {} as QuotaData[string]);

            if (Object.keys(filteredSkus).length > 0) {
                acc[region] = filteredSkus;
            }

            return acc;
        }, {} as QuotaData);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
        <div className="quota-matrix">
            <div className="filters">
                <input
                    type="text"
                    placeholder="Filter by Region"
                    value={regionFilter}
                    onChange={(e) => setRegionFilter(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="Filter by Role"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                />
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Region</th>
                        <th>SKU</th>
                        <th>Total</th>
                        <th>Used</th>
                        <th>Available</th>
                        <th>Assigned To</th>
                    </tr>
                </thead>
                <tbody>
                    {Object.entries(filteredData).map(([region, skus]) =>
                        Object.entries(skus).map(([sku, details]) => (
                            <tr key={`${region}-${sku}`}>
                                <td>{region}</td>
                                <td>{sku}</td>
                                <td>{details.total}</td>
                                <td>{details.used}</td>
                                <td>{details.available}</td>
                                <td>{details.assigned_to.join(", ")}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default QuotaMatrix;