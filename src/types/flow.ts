export const NodeShape = {
  Rectangle: "rectangle",
  Diamond: "diamond",
  RoundedRect: "roundedRect",
  Circle: "circle",
  Parallelogram: "parallelogram",
  Cylinder: "cylinder",
  Hexagon: "hexagon",
  Stadium: "stadium",
  Trapezoid: "trapezoid",
  Document: "document",
  PredefinedProcess: "predefinedProcess",
  ManualInput: "manualInput",
  InternalStorage: "internalStorage",
  Display: "display",
  Text: "text",
} as const;

export type NodeShape = (typeof NodeShape)[keyof typeof NodeShape];

export const FlowDirection = {
  TopDown: "TD",
  LeftRight: "LR",
} as const;

export type FlowDirection =
  (typeof FlowDirection)[keyof typeof FlowDirection];

export const EdgeType = {
  Bezier: "bezier",
  Straight: "straight",
  Step: "step",
} as const;

export type EdgeType = (typeof EdgeType)[keyof typeof EdgeType];

export const MarkerStyle = {
  Arrow: "arrow",
  ArrowClosed: "arrowclosed",
  None: "none",
} as const;

export type MarkerStyle = (typeof MarkerStyle)[keyof typeof MarkerStyle];

export type BorderStyle = "solid" | "dashed" | "dotted";
export type StrokeStyle = "solid" | "dashed" | "dotted";

export type TextAlign = "left" | "center" | "right";

// Component definition types
export interface ComponentInternalNode {
  id: string;
  label: string;
  shape: NodeShape;
  position: { x: number; y: number };
  style?: { width: number; height: number };
  fillColor?: string;
  fillOpacity?: number;
  fillLightness?: number;
  borderColor?: string;
  borderOpacity?: number;
  borderLightness?: number;
  borderWidth?: number;
  borderStyle?: BorderStyle;
  fontSize?: number;
  textColor?: string;
  textOpacity?: number;
  textLightness?: number;
  textAlign?: TextAlign;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface ComponentInternalEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  sourceHandle?: string;
  targetHandle?: string;
  edgeType?: EdgeType;
  markerStart?: MarkerStyle;
  markerEnd?: MarkerStyle;
  strokeWidth?: number;
  strokeColor?: string;
  strokeOpacity?: number;
  strokeLightness?: number;
  strokeStyle?: StrokeStyle;
}

export interface ComponentDefinition {
  id: string;
  name: string;
  version: number;
  direction?: FlowDirection;
  nodes: ComponentInternalNode[];
  edges: ComponentInternalEdge[];
  entryNodeId: string | null;
  exitNodeId: string | null;
}

export interface FlowNodeData extends Record<string, unknown> {
  label: string;
  shape: NodeShape;
  fillColor?: string;
  fillOpacity?: number;
  fillLightness?: number;
  borderColor?: string;
  borderOpacity?: number;
  borderLightness?: number;
  borderWidth?: number;
  borderStyle?: BorderStyle;
  fontSize?: number;
  textColor?: string;
  textOpacity?: number;
  textLightness?: number;
  textAlign?: TextAlign;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  // Locked node (entry/exit in component editing mode)
  isLocked?: boolean;
  // Component instance fields
  componentDefinitionId?: string;
  componentDefinitionDirection?: FlowDirection;
  componentInstanceName?: string;
  componentSyncVersion?: number;
  collapsed?: boolean;
  expandedSize?: { width: number; height: number };
  collapsedSize?: { width: number; height: number };
  preExpandZIndex?: number;
  // Component child node (internal node belonging to an instance)
  componentParentId?: string;
  componentInternalId?: string;
}

export interface Waypoint {
  x: number;
  y: number;
}

export interface FlowEdgeData extends Record<string, unknown> {
  label?: string;
  edgeType?: EdgeType;
  markerStart?: MarkerStyle;
  markerEnd?: MarkerStyle;
  strokeWidth?: number;
  strokeColor?: string;
  strokeOpacity?: number;
  strokeLightness?: number;
  strokeStyle?: StrokeStyle;
  waypoints?: Waypoint[];
  isBridgeEdge?: boolean;
}
