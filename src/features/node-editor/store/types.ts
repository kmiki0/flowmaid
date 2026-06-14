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

/** スプレッドシートのシートに相当するページ。各ページが独立したノード/エッジを持つ */
export interface NodeEditorPage {
  id: string;
  name: string;
  nodes: NodeEditorNode[];
  edges: NodeEditorEdge[];
  nextIdCounter: number;
}

export interface NodeEditorState {
  /** アクティブページの編集中ノード（pages内の内容はページ切替/保存時に同期） */
  nodes: NodeEditorNode[];
  edges: NodeEditorEdge[];
  subMode: NodeEditorSubMode;
  nextIdCounter: number;
  pages: NodeEditorPage[];
  activePageId: string;

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

  // Page actions
  addPage: () => void;
  importAsNewPage: (name: string, nodes: NodeEditorNode[], edges: NodeEditorEdge[], nextIdCounter: number) => void;
  removePage: (id: string) => void;
  renamePage: (id: string, name: string) => void;
  setActivePage: (id: string) => void;

  // State management
  loadState: (state: {
    nodes: NodeEditorNode[];
    edges: NodeEditorEdge[];
    subMode?: NodeEditorSubMode;
    nextIdCounter?: number;
    pages?: NodeEditorPage[];
    activePageId?: string;
  }) => void;
  /** 開いているページの内容だけを差し替える（単一ページインポート用） */
  loadIntoActivePage: (loaded: {
    nodes: NodeEditorNode[];
    edges: NodeEditorEdge[];
    nextIdCounter: number;
  }) => void;
  clearAll: () => void;
}
