import React from "react";
import { createRoot } from "react-dom/client";
import QuotaMatrix from "./modules/QuotaMatrix";
import ConfigManager from "./modules/ConfigManager";

const App: React.FC = () => {
    return (
        <div>
            <h1>Full Automated Orchestration - Front End</h1>
            <QuotaMatrix />
            <hr />
            <ConfigManager />
        </div>
    );
};

const container = document.getElementById("root");
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}