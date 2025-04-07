/**
 * The node types in the Absolute Realms hierarchy
 */
export enum NodeType {
    SE = 'SE', // Supreme Entity
    SB = 'SB', // Sovereign Branch
    SD = 'SD', // Subordinate Division
    IGO = 'IGO', // Inter-Governmental Organization
    EIC = 'EIC', // Enterprise Integration Class
    CG = 'CG', // Cooperative Group
    ENTITY = 'ENTITY', // Individual Entity
}

/**
 * Represents a node in the hierarchy
 */
export interface HierarchyNode {
    ID: string;
    Parent: string;
    Type: NodeType | string;
    Name: string;
    Children: HierarchyNode[];
}

/**
 * Type for flattened node data (used for d3 processing)
 */
export interface FlattenedNode extends Omit<HierarchyNode, 'Children'> {
    depth: number;
    x: number;
    y: number;
    children?: FlattenedNode[];
}

/**
 * Properties for the Chart component
 */
export interface ChartProps {
    data: HierarchyNode;
    width?: number;
    height?: number;
    onNodeClick?: (node: HierarchyNode) => void;
    onNodeEdit?: (node: HierarchyNode) => void;
}

/**
 * Properties for the Node component
 */
export interface NodeProps {
    node: FlattenedNode;
    onClick?: (node: FlattenedNode) => void;
    onEdit?: (node: FlattenedNode) => void;
}

/**
 * Properties for the EditNode component
 */
export interface EditNodeProps {
    node: HierarchyNode | null;
    onSave: (node: HierarchyNode) => void;
    onCancel: () => void;
}

/**
 * Properties for the Sidebar component
 */
export interface SidebarProps {
    selectedNode: HierarchyNode | null;
    onEdit: (node: HierarchyNode) => void;
}

/**
 * GitHub API configuration
 */
export interface GitHubApiConfig {
    baseUrl: string;
    token?: string;
    appId?: string;
    privateKey?: string;
    installationId?: string;
}

/**
 * Response from GitHub API operations
 */
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}