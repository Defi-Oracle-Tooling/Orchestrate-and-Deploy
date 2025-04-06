import React, { useState } from "react";
import "./ConfigManager.css"; // Assuming a CSS file for styling

const ConfigManager: React.FC = () => {
    const [config, setConfig] = useState("{
\"network\": \"prod\",
\"consensus\": \"ibft2\"
}");
const [format, setFormat] = useState("json");
const [message, setMessage] = useState<string | null>(null);

const handleSave = () => {
    try {
        if (format === "json") {
            JSON.parse(config); // Validate JSON
        } else {
            // Validate XML (basic check)
            if (!config.startsWith("<") || !config.endsWith(">")) {
                throw new Error("Invalid XML format");
            }
        }

        // Simulate saving the configuration
        setMessage("Configuration saved successfully!");
    } catch (error) {
        setMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
};

return (
    <div className="config-manager">
        <h2>Visual Configuration Tool</h2>
        <div className="format-selector">
            <label>
                Format:
                <select value={format} onChange={(e) => setFormat(e.target.value)}>
                    <option value="json">JSON</option>
                    <option value="xml">XML</option>
                </select>
            </label>
        </div>
        <textarea
            value={config}
            onChange={(e) => setConfig(e.target.value)}
            rows={10}
            cols={50}
        />
        <button onClick={handleSave}>Save Config</button>
        {message && <div className="message">{message}</div>}
    </div>
);
};

export default ConfigManager;