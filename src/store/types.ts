import type { Node, Edge, OnNodesChange, OnEdgesChange, Connection } from "@xyflow/react";
import type { FlowNodeData, FlowEdgeData, FlowDirection, EdgeType, MarkerStyle, BorderStyle, TextAlign, StrokeStyle, Waypoint, ComponentDefinition, ComponentInternalNode, ComponentInternalEdge } from "@/types/flow";

export type FlowNode = Node<FlowNodeData>;
export type FlowEdge = Edge<FlowEdgeData>;

export interface SavedMainFlow {
  nodes: FlowNode[];
  edges: FlowEdge[];
  direction: FlowDirection;
  nextIdCounter: number;
  componentSnapshot: string;
}

export type PredictiveDirection = "top" | "right" | "bottom" | "left";

export interface PredictiveCandidate {
  kind: "fullCopy" | "shapeCopy" | "pairFreq1" | "pairFreq2";
  nodeData: FlowNodeData;
  edgeData: Partial<FlowEdgeData>;
}

export interface PredictiveInputState {
  sourceNodeId: string | null;
  direction: PredictiveDirection | null;
  ghostVisible: boolean;
  candidates: PredictiveCandidate[];
  candidateIndex: number;
}

export interface FlowState {
  nodes: FlowNode[];
  edges: FlowEdge[];
  direction: FlowDirection;
  nextIdCounter: number;
  componentDefinitions: ComponentDefinition[];

  // Component editing mode
  editingComponentId: string | null;
  savedMainFlow: SavedMainFlow | null;

  // Node actions
  addNode: (shape: string, position?: { x: number; y: number }) => void;
  removeNodes: (ids: string[]) => void;
  updateNodeLabel: (id: string, label: string) => void;
  updateNodeId: (oldId: string, newId: string) => boolean;
  updateNodeColors: (id: string, fillColor?: string | null, borderColor?: string | null) => void;
  updateNodeBorder: (id: string, borderWidth?: number, borderStyle?: BorderStyle) => void;
  updateNodeTextStyle: (id: string, style: { fontSize?: number; textColor?: string; textAlign?: TextAlign; bold?: boolean; italic?: boolean; underline?: boolean }) => void;
  updateNodeColorAdjust: (id: string, target: "fill" | "border" | "text", opacity?: number, lightness?: number) => void;
  duplicateNodes: (ids: string[]) => void;

  // Edge actions
  addEdge: (
    source: string,
    target: string,
    label?: string,
    sourceHandle?: string | null,
    targetHandle?: string | null,
    edgeData?: Partial<FlowEdgeData>,
  ) => void;
  removeEdges: (ids: string[]) => void;
  updateEdgeLabel: (id: string, label: string) => void;
  updateEdgeType: (id: string, edgeType: EdgeType) => void;
  updateEdgeMarkers: (id: string, markerStart?: MarkerStyle, markerEnd?: MarkerStyle) => void;
  updateEdgeStyle: (id: string, strokeWidth?: number, strokeColor?: string, strokeStyle?: StrokeStyle) => void;
  updateEdgeColorAdjust: (id: string, opacity?: number, lightness?: number) => void;
  updateEdgeWaypoints: (id: string, waypoints: Waypoint[]) => void;
  reconnectEdge: (oldEdge: FlowEdge, newConnection: Connection) => void;

  // Component definition actions
  createComponentDefinition: (name: string, nodes?: ComponentInternalNode[], edges?: ComponentInternalEdge[]) => string;
  updateComponentDefinition: (id: string, updates: Partial<Omit<ComponentDefinition, 'id'>>) => void;
  deleteComponentDefinition: (id: string) => void;

  // Component instance actions
  placeComponentInstance: (definitionId: string, position?: { x: number; y: number }, instanceName?: string) => void;
  updateComponentInstanceName: (nodeId: string, name: string) => void;
  syncComponentInstance: (nodeId: string) => void;
  toggleComponentCollapse: (nodeId: string) => void;

  // Component editing mode actions
  enterComponentEditMode: (definitionId: string) => void;
  exitComponentEditMode: () => boolean;
  discardComponentEdit: () => void;
  createAndEditComponent: (name?: string, nodes?: ComponentInternalNode[], edges?: ComponentInternalEdge[]) => void;
  renameComponentDefinition: (id: string, name: string) => void;

  // Alignment & ordering
  alignNodes: (ids: string[], alignment: "left" | "center" | "right" | "top" | "middle" | "bottom") => void;
  distributeNodes: (ids: string[], axis: "horizontal" | "vertical") => void;
  reorderNodes: (ids: string[], action: "front" | "back" | "forward" | "backward") => void;

  // React Flow callbacks
  onNodesChange: OnNodesChange<FlowNode>;
  onEdgesChange: OnEdgesChange<FlowEdge>;

  // Direction
  setDirection: (direction: FlowDirection) => void;

  // Predictive input (undo-exempt)
  predictiveInput: PredictiveInputState;
  setPredictiveInput: (state: Partial<PredictiveInputState>) => void;
  clearPredictiveInput: () => void;
  addNodeWithData: (data: FlowNodeData, position: { x: number; y: number }, style?: { width: number; height: number }) => string;

  // State management
  loadState: (state: {
    nodes: FlowNode[];
    edges: FlowEdge[];
    direction: FlowDirection;
    nextIdCounter: number;
    componentDefinitions?: ComponentDefinition[];
  }) => void;
  clearAll: () => void;
}
