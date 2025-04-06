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

interface QuotaRowProps {
    region: string;
    sku: string;
    details: QuotaData[string][string];
}

// Component to display a single row with usage indicators
const QuotaRow: React.FC<QuotaRowProps> = ({ region, sku, details }) => {
    const usagePercent = (details.used / details.total) * 100;
    let usageClass = "usage-low"; // Green

    if (usagePercent >= 80) {
        usageClass = "usage-high"; // Red
    } else if (usagePercent >= 60) {
        usageClass = "usage-medium"; // Yellow
    }

    return (
        <tr key={`${region}-${sku}`}>
            <td>{region}</td>
            <td>{sku}</td>
            <td>{details.total}</td>
            <td>{details.used}</td>
            <td className={usageClass}>
                {details.available}
                <div className="usage-bar">
                    <div
                        className={`usage-fill ${usageClass}`}
                        style={{ width: `${usagePercent}%` }}
                    />
                </div>
            </td>
            <td>{details.assigned_to.join(", ")}</td>
        </tr>
    );
};

const QuotaMatrix: React.FC = () => {
    const [quotaData, setQuotaData] = useState<QuotaData>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [regionFilter, setRegionFilter] = useState("");
    const [roleFilter, setRoleFilter] = useState("");
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchQuotaData = async () => {
        try {
            setIsRefreshing(true);
            const response = await axios.get("/api/quotas");
            setQuotaData(response.data);
            setError(null);
        } catch (err) {
            console.error("Error fetching quota data:", err);
            setError(
                err instanceof Error
                    ? `Failed to fetch quota data: ${err.message}`
                    : "Failed to fetch quota data. Please check your connection."
            );
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchQuotaData();
    }, []);

    // Get unique regions and roles for filter dropdowns
    const allRegions = Object.keys(quotaData).sort();

    const allRoles = new Set<string>();
    Object.values(quotaData).forEach(regionData => {
        Object.values(regionData).forEach(skuData => {
            skuData.assigned_to.forEach(role => allRoles.add(role));
        });
    });

    const filteredData = Object.entries(quotaData)
        .filter(([region]) =>
            region.toLowerCase().includes(regionFilter.toLowerCase())
        )
        .reduce((acc, [region, skus]) => {
            const filteredSkus = Object.entries(skus)
                .filter(([_, details]) =>
                    roleFilter === "" || details.assigned_to.some(role =>
                        role.toLowerCase().includes(roleFilter.toLowerCase())
                    )
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

    // Get count of filtered entries for display
    const filteredCount = Object.values(filteredData)
        .reduce((count, skus) => count + Object.keys(skus).length, 0);

    const handleRefresh = () => {
        setLoading(true);
        fetchQuotaData();
    };

    const handleClearFilters = () => {
        setRegionFilter("");
        setRoleFilter("");
    };

    if (loading && !isRefreshing) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading quota data...</p>
            </div>
        );
    }

    return (
        <div className="quota-matrix">
            <div className="matrix-header">
                <h2>Azure Quota Matrix</h2>
                <button
                    className="refresh-button"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                >
                    {isRefreshing ? "Refreshing..." : "Refresh Data"}
                </button>
            </div>

            {error && (
                <div className="error-message">
                    <p>{error}</p>
                    <button onClick={handleRefresh}>Try Again</button>
                </div>
            )}

            <div className="filters">
                <div className="filter-group">
                    <label htmlFor="region-filter">Region:</label>
                    <div className="filter-input-group">
                        <input
                            id="region-filter"
                            type="text"
                            placeholder="Filter by Region"
                            value={regionFilter}
                            onChange={(e) => setRegionFilter(e.target.value)}
                        />
                        {regionFilter && (
                            <button
                                className="clear-filter"
                                onClick={() => setRegionFilter("")}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                <div className="filter-group">
                    <label htmlFor="role-filter">Role:</label>
                    <div className="filter-input-group">
                        <input
                            id="role-filter"
                            type="text"
                            placeholder="Filter by Role"
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                        />
                        {roleFilter && (
                            <button
                                className="clear-filter"
                                onClick={() => setRoleFilter("")}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {(regionFilter || roleFilter) && (
                    <button
                        className="clear-all-filters"
                        onClick={handleClearFilters}
                    >
                        Clear All Filters
                    </button>
                )}
            </div>

            <div className="filter-status">
                {filteredCount > 0 ? (
                    <p>Showing {filteredCount} results {(regionFilter || roleFilter) && "with current filters"}</p>
                ) : (
                    <p>No results match your filter criteria</p>
                )}
            </div>

            {filteredCount > 0 ? (
                <div className="table-container">
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
                                    <QuotaRow
                                        key={`${region}-${sku}`}
                                        region={region}
                                        sku={sku}
                                        details={details}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="no-results">
                    <p>No quota data available with the current filters.</p>
                    <button onClick={handleClearFilters}>Clear Filters</button>
                </div>
            )}

            <div className="quota-legend">
                <h4>Quota Usage Legend</h4>
                <div className="legend-item">
                    <div className="legend-color usage-low"></div>
                    <span>Low Usage (0-60%)</span>
                </div>
                <div className="legend-item">
                    <div className="legend-color usage-medium"></div>
                    <span>Medium Usage (60-80%)</span>
                </div>
                <div className="legend-item">
                    <div className="legend-color usage-high"></div>
                    <span>High Usage (80-100%)</span>
                </div>
            </div>
        </div>
    );
};

export default QuotaMatrix;