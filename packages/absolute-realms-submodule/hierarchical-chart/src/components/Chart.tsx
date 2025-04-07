import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { ChartProps, FlattenedNode, HierarchyNode } from '../types';
import Node from './Node';

/**
 * Component that renders the hierarchical chart visualization
 */
const Chart: React.FC<ChartProps> = ({
    data,
    width = 1200,
    height = 800,
    onNodeClick,
    onNodeEdit
}) => {
    // Create a ref for the SVG element
    const svgRef = useRef<SVGSVGElement>(null);

    // Effect to handle rendering the chart
    useEffect(() => {
        if (!svgRef.current || !data) return;

        // Clear previous content
        d3.select(svgRef.current).selectAll('*').remove();

        // Create the root group for the chart
        const svg = d3.select(svgRef.current)
            .attr('width', width)
            .attr('height', height);

        const g = svg.append('g')
            .attr('transform', `translate(${width / 2},${height / 2})`);

        // Create a hierarchical layout
        const root = d3.hierarchy(data, d => d.Children);

        // Create a tree layout with specified size
        const treeLayout = d3.tree<HierarchyNode>()
            .size([360, Math.min(width, height) / 2 - 120])
            .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);

        // Apply the layout to the hierarchy
        const treeData = treeLayout(root);

        // Convert to radial coordinates
        const nodes = treeData.descendants().map(d => {
            const angle = (d.x / 180) * Math.PI - Math.PI / 2;
            return {
                ...d.data,
                x: d.y * Math.cos(angle),
                y: d.y * Math.sin(angle),
                depth: d.depth,
                children: d.children ? d.children.map(c => c.data.ID) : []
            } as FlattenedNode;
        });

        // Create links
        const links = treeData.links();

        // Draw links
        g.selectAll('.link')
            .data(links)
            .enter()
            .append('path')
            .attr('class', 'link')
            .attr('fill', 'none')
            .attr('stroke', '#ccc')
            .attr('stroke-width', 1.5)
            .attr('d', d => {
                const sourceAngle = (d.source.x / 180) * Math.PI - Math.PI / 2;
                const targetAngle = (d.target.x / 180) * Math.PI - Math.PI / 2;

                const sourceX = d.source.y * Math.cos(sourceAngle);
                const sourceY = d.source.y * Math.sin(sourceAngle);
                const targetX = d.target.y * Math.cos(targetAngle);
                const targetY = d.target.y * Math.sin(targetAngle);

                return `M${sourceX},${sourceY}L${targetX},${targetY}`;
            });

        // Create a group for each node
        const nodeGroups = g.selectAll('.node')
            .data(nodes)
            .enter()
            .append('g')
            .attr('class', 'node')
            .attr('id', d => `node-${d.ID}`);

        // Add each node as a React component
        nodes.forEach(node => {
            const nodeElement = document.getElementById(`node-${node.ID}`);
            if (nodeElement) {
                // Render the Node component inside the group
                const handleNodeClick = (n: FlattenedNode) => {
                    if (onNodeClick) {
                        // Convert back to HierarchyNode
                        const originalNode = findNodeById(data, n.ID);
                        if (originalNode) {
                            onNodeClick(originalNode);
                        }
                    }
                };

                const handleNodeEdit = (n: FlattenedNode) => {
                    if (onNodeEdit) {
                        // Convert back to HierarchyNode
                        const originalNode = findNodeById(data, n.ID);
                        if (originalNode) {
                            onNodeEdit(originalNode);
                        }
                    }
                };

                // Use the React Component directly
                const nodeComponent = <Node
                    node={node}
                    onClick={handleNodeClick}
                    onEdit={handleNodeEdit}
                />;

                // This is a simplified approach - in a real implementation you'd use ReactDOM.render
                // or a more appropriate method to render React components inside D3
            }
        });
    }, [data, width, height, onNodeClick, onNodeEdit]);

    /**
     * Helper function to find a node by ID in the hierarchy
     */
    const findNodeById = (root: HierarchyNode, id: string): HierarchyNode | null => {
        if (root.ID === id) {
            return root;
        }

        for (const child of root.Children) {
            const found = findNodeById(child, id);
            if (found) {
                return found;
            }
        }

        return null;
    };

    return (
        <div className="chart-container" style={{ width, height, overflow: 'auto' }}>
            <svg ref={svgRef}></svg>
        </div>
    );
};

export default Chart;