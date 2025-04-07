import React from 'react';
import { NodeProps, NodeType } from '../types';

/**
 * Component that renders a single node in the hierarchy chart
 */
const Node: React.FC<NodeProps> = ({ node, onClick, onEdit }) => {
    // Color mapping for different node types
    const getNodeColor = (type: string): string => {
        switch (type) {
            case NodeType.SE:
                return '#8A2BE2'; // BlueViolet
            case NodeType.SB:
                return '#4169E1'; // RoyalBlue
            case NodeType.SD:
                return '#228B22'; // ForestGreen
            case NodeType.IGO:
                return '#FF8C00'; // DarkOrange
            case NodeType.EIC:
                return '#9370DB'; // MediumPurple
            case NodeType.CG:
                return '#20B2AA'; // LightSeaGreen
            case NodeType.ENTITY:
                return '#CD5C5C'; // IndianRed
            default:
                return '#808080'; // Gray
        }
    };

    // Calculate the radius based on the node's depth (deeper nodes are smaller)
    const radius = Math.max(25 - node.depth * 3, 10);

    // Get the color based on the node type
    const color = getNodeColor(node.Type);

    return (
        <g transform={`translate(${node.x},${node.y})`}>
            {/* Circle for the node */}
            <circle
                r={radius}
                fill={color}
                stroke="#FFF"
                strokeWidth={2}
                onClick={() => onClick && onClick(node)}
            />

            {/* Label for the node */}
            <text
                textAnchor="middle"
                dy=".3em"
                fontSize={radius * 0.7}
                fill="#FFF"
                style={{ pointerEvents: 'none' }}
            >
                {node.Type}
            </text>

            {/* Node name label below the circle */}
            <text
                textAnchor="middle"
                dy={radius + 15}
                fontSize={12}
                fill="#333"
                style={{ pointerEvents: 'none' }}
            >
                {node.Name}
            </text>

            {/* Edit button */}
            <g
                transform={`translate(${radius + 5},-${radius - 5})`}
                onClick={(e) => {
                    e.stopPropagation(); // Prevent triggering the node click
                    onEdit && onEdit(node);
                }}
                style={{ cursor: 'pointer' }}
            >
                <circle r={8} fill="#f0f0f0" stroke="#999" />
                <text
                    textAnchor="middle"
                    dy=".3em"
                    fontSize={10}
                    fill="#333"
                >
                    ✏️
                </text>
            </g>
        </g>
    );
};

export default Node;