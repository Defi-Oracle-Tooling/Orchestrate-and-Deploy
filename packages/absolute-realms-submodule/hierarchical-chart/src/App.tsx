import React, { useState, useEffect } from 'react';
import Chart from './components/Chart';
import Sidebar from './components/Sidebar';
import EditNode from './components/EditNode';
import { HierarchyNode } from './types';
import { GitHubApiService } from './services/api';

// Import mock data for initial development
import mockHierarchyData from './data/mock-hierarchy.json';

import './styles.css';

const App: React.FC = () => {
    // State for the hierarchy data
    const [hierarchyData, setHierarchyData] = useState<HierarchyNode>(mockHierarchyData as HierarchyNode);

    // State for the selected node
    const [selectedNode, setSelectedNode] = useState<HierarchyNode | null>(null);

    // State for the node being edited
    const [editingNode, setEditingNode] = useState<HierarchyNode | null>(null);

    // State for API status/errors
    const [apiStatus, setApiStatus] = useState<{ loading: boolean; error: string | null }>({
        loading: false,
        error: null,
    });

    // Initialize API service
    const apiService = new GitHubApiService({
        baseUrl: process.env.REACT_APP_GITHUB_API_URL || 'https://api.github.com',
        token: process.env.REACT_APP_GITHUB_TOKEN,
    });

    // Handle node selection
    const handleNodeClick = (node: HierarchyNode) => {
        setSelectedNode(node);
    };

    // Handle node editing
    const handleNodeEdit = (node: HierarchyNode) => {
        setEditingNode(node);
    };

    // Handle saving node edits
    const handleSaveEdit = (updatedNode: HierarchyNode) => {
        // Update the node in the hierarchy
        const updatedHierarchy = updateNodeInHierarchy(hierarchyData, updatedNode);
        setHierarchyData(updatedHierarchy);

        // Update selected node if it's the one that was edited
        if (selectedNode && selectedNode.ID === updatedNode.ID) {
            setSelectedNode(updatedNode);
        }

        // Clear editing state
        setEditingNode(null);
    };

    // Handle canceling node edits
    const handleCancelEdit = () => {
        setEditingNode(null);
    };

    // Function to fetch hierarchy data from GitHub Enterprise
    const fetchHierarchyData = async () => {
        setApiStatus({ loading: true, error: null });

        try {
            const response = await apiService.importHierarchy();

            if (response.success && response.data) {
                setHierarchyData(response.data);
            } else {
                setApiStatus({ loading: false, error: response.error || 'Failed to fetch hierarchy data' });
            }
        } catch (error) {
            setApiStatus({
                loading: false,
                error: error instanceof Error ? error.message : 'An unknown error occurred'
            });
        } finally {
            setApiStatus(prev => ({ ...prev, loading: false }));
        }
    };

    // Helper function to update a node in the hierarchy
    const updateNodeInHierarchy = (root: HierarchyNode, updatedNode: HierarchyNode): HierarchyNode => {
        if (root.ID === updatedNode.ID) {
            // Preserve children when updating a node
            return {
                ...updatedNode,
                Children: root.Children,
            };
        }

        // Recursively update children
        return {
            ...root,
            Children: root.Children.map(child => updateNodeInHierarchy(child, updatedNode)),
        };
    };

    // Export the hierarchy to GitHub Enterprise
    const exportHierarchy = async () => {
        setApiStatus({ loading: true, error: null });

        try {
            const response = await apiService.exportHierarchy(hierarchyData);

            if (!response.success) {
                setApiStatus({ loading: false, error: response.error || 'Failed to export hierarchy' });
            }
        } catch (error) {
            setApiStatus({
                loading: false,
                error: error instanceof Error ? error.message : 'An unknown error occurred'
            });
        } finally {
            setApiStatus(prev => ({ ...prev, loading: false }));
        }
    };

    return (
        <div className="app">
            <header className="app-header">
                <h1>Absolute Realms Hierarchy Visualization</h1>
                <div className="header-actions">
                    <button onClick={fetchHierarchyData} disabled={apiStatus.loading}>
                        {apiStatus.loading ? 'Loading...' : 'Import from GitHub'}
                    </button>
                    <button onClick={exportHierarchy} disabled={apiStatus.loading}>
                        Export to GitHub
                    </button>
                </div>
            </header>

            {apiStatus.error && (
                <div className="error-message">
                    Error: {apiStatus.error}
                </div>
            )}

            <div className="app-content">
                <div className="chart-area">
                    <Chart
                        data={hierarchyData}
                        onNodeClick={handleNodeClick}
                        onNodeEdit={handleNodeEdit}
                    />
                </div>

                <div className="sidebar-area">
                    <Sidebar
                        selectedNode={selectedNode}
                        onEdit={handleNodeEdit}
                    />
                </div>
            </div>

            {editingNode && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <EditNode
                            node={editingNode}
                            onSave={handleSaveEdit}
                            onCancel={handleCancelEdit}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;