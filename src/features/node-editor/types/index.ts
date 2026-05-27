// Port direction
export type PortDirection = "input" | "output" | "bidirectional";

// Port data type (display label)
export type PortDataType = string; // "string" | "number" | "boolean" | "object" | custom

// Single port definition
export interface NodeEditorPort {
  id: string;
  name: string;
  logicalName?: string;
  direction: PortDirection;
  dataType?: PortDataType;
  // ER diagram fields
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  isNotNull?: boolean;
  isUnique?: boolean;
}

// Node kind
export type NodeEditorNodeKind = "generic" | "service" | "table";

// Node editor node data (stored in React Flow node.data)
export interface NodeEditorNodeData extends Record<string, unknown> {
  label: string;
  logicalName?: string;
  kind: NodeEditorNodeKind;
  ports: NodeEditorPort[];
  // Style (reuses flowchart color palette)
  fillColor?: string;
  fillOpacity?: number;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: "solid" | "dashed" | "dotted";
  fontSize?: number;
  textColor?: string;
  // Service node metadata
  serviceUrl?: string;
  description?: string;
  // Animation flags
  isDeleting?: boolean;
  isNew?: boolean;
}

// Edge cardinality (ER diagram)
export type Cardinality = "1:1" | "1:N" | "N:M" | "0:1" | "0:N";

// Node editor edge data
export interface NodeEditorEdgeData extends Record<string, unknown> {
  label?: string;
  sourcePortId?: string;
  targetPortId?: string;
  // Style
  strokeColor?: string;
  strokeWidth?: number;
  strokeStyle?: "solid" | "dashed" | "dotted";
  // API diagram
  httpMethod?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  // ER diagram
  cardinality?: Cardinality;
  relationLabel?: string;
}

// Sub-mode for node editor
export type NodeEditorSubMode = "generic" | "api-diagram" | "er-diagram";

// Editor mode (top-level)
export type EditorMode = "flowchart" | "node-editor";
