import type { FlowDirection, EdgeType, MarkerStyle, BorderStyle, TextAlign, StrokeStyle, Waypoint, ComponentDefinition } from "@/types/flow";

export interface FlowmaidNodeLayout {
  position: { x: number; y: number };
  size?: { width: number; height: number };
  shape: string;
  label: string;
  fillColor?: string;
  fillOpacity?: number;
  fillLightness?: number;
  borderColor?: string;
  borderOpacity?: number;
  borderLightness?: number;
  borderWidth?: number;
  borderStyle?: BorderStyle;
  zIndex?: number;
  fontSize?: number;
  textColor?: string;
  textOpacity?: number;
  textLightness?: number;
  textAlign?: TextAlign;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  // Component instance fields
  componentDefinitionId?: string;
  componentInstanceName?: string;
  componentSyncVersion?: number;
  collapsed?: boolean;
  expandedSize?: { width: number; height: number };
}

export interface FlowmaidEdgeLayout {
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
  waypoints?: Waypoint[];
}

export interface FlowmaidLayout {
  direction: FlowDirection;
  nodes: Record<string, FlowmaidNodeLayout>;
  edges: Record<string, FlowmaidEdgeLayout>;
  componentDefinitions?: ComponentDefinition[];
}

export interface FlowmaidFile {
  mermaid: string;
  layout: FlowmaidLayout;
}
