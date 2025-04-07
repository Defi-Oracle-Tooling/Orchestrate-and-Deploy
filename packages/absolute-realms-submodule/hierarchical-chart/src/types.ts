/**
 * Defines the types of nodes in the realm hierarchy
 */
export enum NodeType {
  SE = 'SE',      // Supreme Entity
  SB = 'SB',      // Sovereign Branch
  SD = 'SD',      // Subordinate Division
  IGO = 'IGO',    // Inter-Governmental Organization
  EIC = 'EIC',    // Enterprise Integration Class
  CG = 'CG',      // Cooperative Group
  ENTITY = 'ENTITY' // Individual Entity
}

/**
 * Represents a node in the hierarchy
 */
export interface HierarchyNode {
  ID: string;
  Parent: string;
  Type: string;
  Name: string;
  Children: HierarchyNode[];
}

/**
 * Configuration for GitHub API
 */
export interface GitHubApiConfig {
  baseUrl: string;
  token?: string;
  appId?: string;
  privateKey?: string;
  installationId?: string;
}

/**
 * Generic API response type
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Flattened node with position data for rendering
 */
export interface FlattenedNode extends HierarchyNode {
  x: number;
  y: number;
  depth: number;
  children: string[];
}

/**
 * Props for the Chart component
 */
export interface ChartProps {
  data: HierarchyNode;
  width?: number;
  height?: number;
  onNodeClick?: (node: HierarchyNode) => void;
  onNodeEdit?: (node: HierarchyNode) => void;
}

/**
 * Props for the Node component
 */
export interface NodeProps {
  node: FlattenedNode;
  onClick?: (node: FlattenedNode) => void;
  onEdit?: (node: FlattenedNode) => void;
}

/**
 * Props for the Sidebar component
 */
export interface SidebarProps {
  selectedNode: HierarchyNode | null;
  onEdit: (node: HierarchyNode) => void;
}

/**
 * Props for the EditNode component
 */
export interface EditNodeProps {
  node: HierarchyNode | null;
  onSave: (node: HierarchyNode) => void;
  onCancel: () => void;
}