import React, { useState, useEffect, useMemo } from "react";
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

// New interface for historical trend data
interface TrendData {
    [region: string]: {
        [sku: string]: {
            history: {
                date: string;
                used: number;
                total: number;
            }[];
        };
    };
}

// New interface for geographic grouping
interface GeoGroup {
    name: string;
    regions: string[];
}

interface RegionSummary {
    region: string;
    totalQuota: number;
    usedQuota: number;
    availableQuota: number;
    usagePercent: number;
    skuCount: number;
    geoGroup?: string; // Add geographic group info
    trend?: number; // Add trend indicator (positive means increasing usage)
}

interface QuotaRowProps {
    region: string;
    sku: string;
    details: QuotaData[string][string];
    expanded: boolean;
    trendData?: TrendData[string][string]; // Add optional trend data
}

// Component to display a single row with enhanced usage indicators
const QuotaRow: React.FC<QuotaRowProps> = ({ region, sku, details, expanded, trendData }) => {
    const usagePercent = (details.used / details.total) * 100;
    let usageClass = "usage-low"; // Green

    if (usagePercent >= 80) {
        usageClass = "usage-high"; // Red
    } else if (usagePercent >= 60) {
        usageClass = "usage-medium"; // Yellow
    }

    return (
        <tr key={`${region}-${sku}`} className={expanded ? "expanded-row" : ""}>
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
                <div className="usage-percent">{usagePercent.toFixed(1)}%</div>
                {trendData && trendData.history && trendData.history.length > 1 && (
                    <div className="trend-indicator">
                        {trendData.history[trendData.history.length - 1].used >
                            trendData.history[trendData.history.length - 2].used ?
                            <span className="trend-up">↑</span> :
                            <span className="trend-down">↓</span>
                        }
                    </div>
                )}
            </td>
            <td>{details.assigned_to.join(", ")}</td>
            <td>
                {expanded && (
                    <div className="sku-details">
                        <p><strong>Capacity Provider:</strong> Microsoft.Compute</p>
                        <p><strong>Role Support:</strong> {details.assigned_to.length} roles</p>
                        <p><strong>Free Capacity:</strong> {details.available} units</p>
                        {trendData && trendData.history && trendData.history.length > 0 && (
                            <div className="trend-chart">
                                <h4>Usage Trend (Last 7 Days)</h4>
                                <div className="mini-chart">
                                    {trendData.history.slice(-7).map((point, index) => {
                                        const height = Math.max(5, (point.used / point.total) * 40);
                                        return (
                                            <div key={index} className="chart-bar" title={`${new Date(point.date).toLocaleDateString()}: ${(point.used / point.total * 100).toFixed(1)}%`}>
                                                <div
                                                    className={`chart-fill ${(point.used / point.total) >= 0.8 ? 'usage-high' :
                                                        (point.used / point.total) >= 0.6 ? 'usage-medium' : 'usage-low'}`}
                                                    style={{ height: `${height}px` }}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="chart-dates">
                                    <span>{trendData.history.length > 6 ? new Date(trendData.history[trendData.history.length - 7].date).toLocaleDateString() : ''}</span>
                                    <span>{trendData.history.length > 0 ? new Date(trendData.history[trendData.history.length - 1].date).toLocaleDateString() : ''}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </td>
        </tr>
    );
};

// Region summary card component
const RegionSummaryCard: React.FC<{ summary: RegionSummary, onClick: () => void }> = ({ summary, onClick }) => {
    let statusClass = "status-good";
    if (summary.usagePercent >= 80) {
        statusClass = "status-critical";
    } else if (summary.usagePercent >= 60) {
        statusClass = "status-warning";
    }

    return (
        <div className={`region-summary-card ${statusClass}`} onClick={onClick}>
            <h3>{summary.region}</h3>
            <div className="summary-metrics">
                <div className="metric">
                    <span className="metric-value">{summary.availableQuota}</span>
                    <span className="metric-label">Available</span>
                </div>
                <div className="metric">
                    <span className="metric-value">{summary.totalQuota}</span>
                    <span className="metric-label">Total</span>
                </div>
                <div className="metric">
                    <span className="metric-value">{summary.usagePercent.toFixed(1)}%</span>
                    <span className="metric-label">Used</span>
                </div>
            </div>
            <div className="summary-bar">
                <div
                    className={`summary-fill ${statusClass}`}
                    style={{ width: `${summary.usagePercent}%` }}
                ></div>
            </div>
            <div className="sku-count">{summary.skuCount} SKUs</div>
        </div>
    );
};

const QuotaMatrix: React.FC = () => {
    const [quotaData, setQuotaData] = useState<QuotaData>({});
    const [trendData, setTrendData] = useState<TrendData>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [regionFilter, setRegionFilter] = useState("");
    const [roleFilter, setRoleFilter] = useState("");
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [viewMode, setViewMode] = useState<"table" | "cards" | "heatmap">("table");
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
    const [highlightCritical, setHighlightCritical] = useState(false);
    const [geoGroupFilter, setGeoGroupFilter] = useState<string>("");
    const [showAlertsOnly, setShowAlertsOnly] = useState(false);
    const [alertThreshold, setAlertThreshold] = useState(90); // Alert when usage is above 90%

    // Define geographic groups
    const geoGroups: GeoGroup[] = [
        { name: "North America", regions: ["eastus", "eastus2", "centralus", "northcentralus", "southcentralus", "westcentralus", "westus", "westus2", "westus3", "canadacentral", "canadaeast"] },
        { name: "Europe", regions: ["northeurope", "westeurope", "francecentral", "francesouth", "uksouth", "ukwest", "germanynorth", "germanywestcentral", "norwayeast", "norwaywest", "switzerlandnorth", "switzerlandwest"] },
        { name: "Asia Pacific", regions: ["eastasia", "southeastasia", "australiaeast", "australiasoutheast", "japaneast", "japanwest", "koreacentral", "koreasouth", "southindia", "centralindia", "westindia"] },
        { name: "South America", regions: ["brazilsouth", "brazilsoutheast"] },
        { name: "Middle East & Africa", regions: ["southafricanorth", "southafricawest", "uaenorth", "uaecentral"] }
    ];

    const fetchQuotaData = async () => {
        try {
            setIsRefreshing(true);
            const response = await axios.get("/api/quotas");
            setQuotaData(response.data);

            // Fetch trend data (mock for now - would be a real endpoint in production)
            const trendResponse = await axios.get("/api/quotas/trends").catch(() => {
                // Mock trend data if the endpoint doesn't exist
                console.log("Using mock trend data since endpoint doesn't exist");
                const mockTrend: TrendData = {};

                Object.keys(response.data).forEach(region => {
                    mockTrend[region] = {};
                    Object.keys(response.data[region]).forEach(sku => {
                        const currentUsed = response.data[region][sku].used;
                        const currentTotal = response.data[region][sku].total;

                        // Generate 14 days of mock history
                        const history = Array.from({ length: 14 }, (_, i) => {
                            const date = new Date();
                            date.setDate(date.getDate() - (13 - i));

                            // Random fluctuation within 20% of current usage
                            const fluctuation = Math.random() * 0.2 - 0.1; // -10% to +10%
                            const usedRatio = currentUsed / currentTotal;
                            const adjustedRatio = Math.max(0, Math.min(1, usedRatio * (1 + fluctuation)));
                            const used = Math.round(adjustedRatio * currentTotal);

                            return {
                                date: date.toISOString(),
                                used,
                                total: currentTotal
                            };
                        });

                        mockTrend[region][sku] = { history };
                    });
                });

                return { data: mockTrend };
            });

            setTrendData(trendResponse.data);
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
        // Set up auto-refresh every 5 minutes
        const refreshInterval = setInterval(() => {
            fetchQuotaData();
        }, 5 * 60 * 1000);

        return () => clearInterval(refreshInterval);
    }, []);

    // Get unique regions and roles for filter dropdowns
    const allRegions = Object.keys(quotaData).sort();

    const allRoles = useMemo(() => {
        const roles = new Set<string>();
        Object.values(quotaData).forEach(regionData => {
            Object.values(regionData).forEach(skuData => {
                // Apply type assertion since we know the structure
                const typedSkuData = skuData as QuotaData[string][string];
                typedSkuData.assigned_to.forEach(role => roles.add(role));
            });
        });
        return Array.from(roles).sort();
    }, [quotaData]);

    // Calculate region summaries for card view
    const regionSummaries = useMemo(() => {
        return allRegions.map(region => {
            const skus = quotaData[region] || {};
            const skuCount = Object.keys(skus).length;
            let totalQuota = 0;
            let usedQuota = 0;

            Object.values(skus).forEach(details => {
                // Type assertion for details object
                const typedDetails = details as QuotaData[string][string];
                totalQuota += typedDetails.total;
                usedQuota += typedDetails.used;
            });

            const availableQuota = totalQuota - usedQuota;
            const usagePercent = totalQuota > 0 ? (usedQuota / totalQuota) * 100 : 0;

            return {
                region,
                totalQuota,
                usedQuota,
                availableQuota,
                usagePercent,
                skuCount
            };
        }).filter(summary =>
            summary.region.toLowerCase().includes(regionFilter.toLowerCase()) &&
            (!highlightCritical || summary.usagePercent >= 80)
        );
    }, [quotaData, regionFilter, highlightCritical, allRegions]);

    const filteredData = useMemo(() => {
        return Object.entries(quotaData)
            .filter(([region]) =>
                (selectedRegion ? region === selectedRegion : true) &&
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
    }, [quotaData, regionFilter, roleFilter, selectedRegion]);

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
        setSelectedRegion(null);
        setHighlightCritical(false);
    };

    const toggleRowExpand = (key: string) => {
        const newExpandedRows = new Set(expandedRows);
        if (newExpandedRows.has(key)) {
            newExpandedRows.delete(key);
        } else {
            newExpandedRows.add(key);
        }
        setExpandedRows(newExpandedRows);
    };

    const selectRegion = (region: string) => {
        setSelectedRegion(region);
        setViewMode("table");
    };

    const exportToCsv = () => {
        // Generate CSV content
        let csvContent = "Region,SKU,Total Quota,Used Quota,Available Quota,Usage Percent,Assigned To\n";

        Object.entries(filteredData).forEach(([region, skus]) => {
            Object.entries(skus).forEach(([sku, details]) => {
                const usagePercent = (details.used / details.total * 100).toFixed(1);
                const row = [
                    region,
                    sku,
                    details.total,
                    details.used,
                    details.available,
                    usagePercent + "%",
                    '"' + details.assigned_to.join(", ") + '"'
                ].join(",");
                csvContent += row + "\n";
            });
        });

        // Create a download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `quota-report-${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
                <div className="header-controls">
                    <div className="view-toggle">
                        <button
                            className={viewMode === "table" ? "active" : ""}
                            onClick={() => setViewMode("table")}
                        >
                            Table View
                        </button>
                        <button
                            className={viewMode === "cards" ? "active" : ""}
                            onClick={() => setViewMode("cards")}
                        >
                            Region Cards
                        </button>
                    </div>
                    <button
                        className="refresh-button"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                    >
                        {isRefreshing ? "Refreshing..." : "Refresh Data"}
                    </button>
                    <button className="export-button" onClick={exportToCsv}>
                        Export to CSV
                    </button>
                </div>
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
                    <div className="filter-select-group">
                        <select
                            id="role-filter"
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                        >
                            <option value="">All Roles</option>
                            {allRoles.map(role => (
                                <option key={role} value={role}>{role}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="filter-group checkbox">
                    <label htmlFor="critical-filter">
                        <input
                            id="critical-filter"
                            type="checkbox"
                            checked={highlightCritical}
                            onChange={(e) => setHighlightCritical(e.target.checked)}
                        />
                        Show Critical Only
                    </label>
                </div>

                {(regionFilter || roleFilter || selectedRegion || highlightCritical) && (
                    <button
                        className="clear-all-filters"
                        onClick={handleClearFilters}
                    >
                        Clear All Filters
                    </button>
                )}
            </div>

            <div className="filter-status">
                {selectedRegion && (
                    <div className="selected-region-badge">
                        Selected Region: {selectedRegion}
                        <button className="clear-selection" onClick={() => setSelectedRegion(null)}>✕</button>
                    </div>
                )}
                {filteredCount > 0 ? (
                    <p>Showing {filteredCount} results {(regionFilter || roleFilter || selectedRegion || highlightCritical) && "with current filters"}</p>
                ) : (
                    <p>No results match your filter criteria</p>
                )}
            </div>

            {viewMode === "cards" && (
                <div className="region-cards">
                    {regionSummaries.map(summary => (
                        <RegionSummaryCard
                            key={summary.region}
                            summary={summary}
                            onClick={() => selectRegion(summary.region)}
                        />
                    ))}
                    {regionSummaries.length === 0 && (
                        <div className="no-results">
                            <p>No regions available with the current filters.</p>
                            <button onClick={handleClearFilters}>Clear Filters</button>
                        </div>
                    )}
                </div>
            )}

            {viewMode === "table" && filteredCount > 0 ? (
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
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(filteredData).map(([region, skus]) =>
                                Object.entries(skus).map(([sku, details]) => {
                                    const rowKey = `${region}-${sku}`;
                                    return (
                                        <React.Fragment key={rowKey}>
                                            <QuotaRow
                                                region={region}
                                                sku={sku}
                                                details={details}
                                                expanded={expandedRows.has(rowKey)}
                                                trendData={trendData[region]?.[sku]}
                                            />
                                            <tr className="row-actions">
                                                <td colSpan={7}>
                                                    <button
                                                        className="expand-button"
                                                        onClick={() => toggleRowExpand(rowKey)}
                                                    >
                                                        {expandedRows.has(rowKey) ? "Hide Details" : "Show Details"}
                                                    </button>
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            ) : viewMode === "table" && (
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

            <div className="update-info">
                <p>Last Updated: {new Date().toLocaleString()}</p>
                <p>Auto-refreshes every 5 minutes</p>
            </div>
            [{
	"resource": "/workspaces/Orchestrate-and-Deploy/front-end/src/modules/QuotaMatrix.tsx",
	"owner": "typescript",
	"code": "18046",
	"severity": 8,
	"message": "'details' is of type 'unknown'.",
	"source": "ts",
	"startLineNumber": 367,
	"startColumn": 54,
	"endLineNumber": 367,
	"endColumn": 61
}]
        </div>
    );
};

export default QuotaMatrix;