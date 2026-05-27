import type { Node, Edge, OnNodesChange, OnEdgesChange } from "@xyflow/react";
import type {
  NodeEditorNodeData,
  NodeEditorEdgeData,
  NodeEditorNodeKind,
  NodeEditorSubMode,
  NodeEditorPort,
  PortDirection,
} from "../types";

export type NodeEditorNode = Node<NodeEditorNodeData>;
export type NodeEditorEdge = Edge<NodeEditorEdgeData>;

export interface NodeEditorState {
  nodes: NodeEditorNode[];
  edges: NodeEditorEdge[];
  subMode: NodeEditorSubMode;
  nextIdCounter: number;

  // Node actions
  addNode: (kind: NodeEditorNodeKind, position?: { x: number; y: number }) => void;
  removeNodes: (ids: string[]) => void;
  updateNodeLabel: (id: string, label: string) => void;
  updateNodeStyle: (id: string, style: Partial<NodeEditorNodeData>) => void;
  duplicateNodes: (ids: string[]) => void;

  // Port actions
  addPort: (nodeId: string, direction: PortDirection) => void;
  removePort: (nodeId: string, portId: string) => void;
  updatePort: (nodeId: string, portId: string, updates: Partial<NodeEditorPort>) => void;

  // Edge actions
  addEdge: (
    source: string,
    target: string,
    sourceHandle?: string | null,
    targetHandle?: string | null,
  ) => void;
  removeEdges: (ids: string[]) => void;
  updateEdgeData: (id: string, updates: Partial<NodeEditorEdgeData>) => void;

  // React Flow callbacks
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;

  // Display settings
  showLogicalName: boolean;
  toggleShowLogicalName: () => void;

  // Sub-mode
  setSubMode: (mode: NodeEditorSubMode) => void;

  // State management
  loadState: (state: {
    nodes: NodeEditorNode[];
    edges: NodeEditorEdge[];
    subMode?: NodeEditorSubMode;
    nextIdCounter?: number;
  }) => void;
  clearAll: () => void;
}
