import React, { useState } from "react";

/**
 * ConfigManager is a minimal visual design tool to manage
 * XML/JSON configuration files with version tracking.
 * It doesn't implement a real backend for versioning, but
 * can be easily extended to do so.
 */
const ConfigManager: React.FC = () => {
    const [configText, setConfigText] = useState<string>("{}");
    const [format, setFormat] = useState<"json" | "xml">("json");

    const handleSave = () => {
        // Placeholder for saving config to backend with versioning
        alert(`Config saved in ${format} format:\n${configText}`);
    };

    return (
        <div>
            <h2>Visual Configuration Tool</h2>
            <div style={{ marginBottom: "8px" }}>
                <label>
                    Format:&nbsp;
                    <select value={format} onChange={(e) => setFormat(e.target.value as "json" | "xml")}>
                        <option value="json">JSON</option>
                        <option value="xml">XML</option>
                    </select>
                </label>
            </div>
            <textarea
                rows={8}
                cols={60}
                value={configText}
                onChange={(e) => setConfigText(e.target.value)}
            />
            <br />
            <button onClick={handleSave}>Save Config</button>
            <p style={{ fontStyle: "italic" }}>
                (Future improvement: integrate real version control & rollback)
            </p>
        </div>
    );
};

export default ConfigManager;