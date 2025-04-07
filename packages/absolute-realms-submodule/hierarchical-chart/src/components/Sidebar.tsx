import React from 'react';
import { SidebarProps, NodeType } from '../types';

/**
 * Component that displays information about the selected node
 */
const Sidebar: React.FC<SidebarProps> = ({ selectedNode, onEdit }) => {
    // Helper method to get a human-readable label for node types
    const getNodeTypeLabel = (type: string): string => {
        switch (type) {
            case NodeType.SE:
                return 'Supreme Entity';
            case NodeType.SB:
                return 'Sovereign Branch';
            case NodeType.SD:
                return 'Subordinate Division';
            case NodeType.IGO:
                return 'Inter-Governmental Organization';
            case NodeType.EIC:
                return 'Enterprise Integration Class';
            case NodeType.CG:
                return 'Cooperative Group';
            case NodeType.ENTITY:
                return 'Individual Entity';
            default:
                return type;
        }
    };

    // If no node is selected, show a placeholder
    if (!selectedNode) {
        return (
            <div className="sidebar">
                <h2>Node Details</h2>
                <p>Select a node to view its details</p>
            </div>
        );
    }

    // Get GitHub Enterprise entity type based on node type
    const getGitHubEntityType = (type: string): string => {
        switch (type) {
            case NodeType.SE:
                return 'GitHub Enterprise Instance';
            case NodeType.SB:
                return 'GitHub Organization';
            case NodeType.SD:
                return 'Parent Team';
            case NodeType.CG:
                return 'Team';
            case NodeType.ENTITY:
                return 'Repository';
            default:
                return 'Custom Entity';
        }
    };

    return (
        <div className="sidebar">
            <h2>Node Details</h2>

            <div className="node-details">
                <div className="detail-item">
                    <span className="detail-label">Name:</span>
                    <span className="detail-value">{selectedNode.Name}</span>
                </div>

                <div className="detail-item">
                    <span className="detail-label">ID:</span>
                    <span className="detail-value">{selectedNode.ID}</span>
                </div>

                <div className="detail-item">
                    <span className="detail-label">Type:</span>
                    <span className="detail-value">{getNodeTypeLabel(selectedNode.Type)}</span>
                </div>

                <div className="detail-item">
                    <span className="detail-label">Parent:</span>
                    <span className="detail-value">{selectedNode.Parent}</span>
                </div>

                <div className="detail-item">
                    <span className="detail-label">Children:</span>
                    <span className="detail-value">{selectedNode.Children.length}</span>
                </div>

                <div className="detail-item">
                    <span className="detail-label">GitHub Entity Type:</span>
                    <span className="detail-value">{getGitHubEntityType(selectedNode.Type)}</span>
                </div>
            </div>

            <div className="node-actions">
                <button
                    className="edit-button"
                    onClick={() => onEdit(selectedNode)}
                >
                    Edit Node
                </button>

                {/* Additional action buttons can be added here */}
                {selectedNode.Type === NodeType.SB && (
                    <button className="action-button">
                        Create Organization
                    </button>
                )}

                {selectedNode.Type === NodeType.SD && (
                    <button className="action-button">
                        Create Team
                    </button>
                )}

                {selectedNode.Type === NodeType.ENTITY && (
                    <button className="action-button">
                        Create Repository
                    </button>
                )}
            </div>

            {selectedNode.Children.length > 0 && (
                <div className="child-list">
                    <h3>Children</h3>
                    <ul>
                        {selectedNode.Children.map(child => (
                            <li key={child.ID}>
                                {child.Name} ({getNodeTypeLabel(child.Type)})
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default Sidebar;