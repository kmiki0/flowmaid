import { stringify, parse } from "yaml";
import { generateMermaid } from "@/lib/mermaid/generate";
import type { FlowNode, FlowEdge } from "@/store/types";
import type { FlowDirection, ComponentDefinition } from "@/types/flow";
import type { FlowmaidLayout, FlowmaidNodeLayout, FlowmaidEdgeLayout } from "./schema";

export function serialize(
  nodes: FlowNode[],
  edges: FlowEdge[],
  direction: FlowDirection,
  componentDefinitions?: ComponentDefinition[]
): string {
  const mermaidSection = generateMermaid(nodes, edges, direction, componentDefinitions);

  const nodesLayout: Record<string, FlowmaidNodeLayout> = {};
  for (const node of nodes) {
    // Skip component child nodes (they're regenerated from definition)
    if (node.data.componentParentId) continue;
    const styleW = (node.style as Record<string, unknown>)?.width as number | undefined;
    const styleH = (node.style as Record<string, unknown>)?.height as number | undefined;
    const w = node.width ?? styleW;
    const h = node.height ?? styleH;

    const entry: FlowmaidNodeLayout = {
      position: { x: node.position.x, y: node.position.y },
      size: w && h ? { width: w, height: h } : undefined,
      shape: node.data.shape,
      label: node.data.label,
    };
    if (node.data.fillColor) entry.fillColor = node.data.fillColor;
    if (node.data.fillOpacity !== undefined && node.data.fillOpacity !== 10) entry.fillOpacity = node.data.fillOpacity;
    if (node.data.fillLightness !== undefined && node.data.fillLightness !== 5) entry.fillLightness = node.data.fillLightness;
    if (node.data.borderColor) entry.borderColor = node.data.borderColor;
    if (node.data.borderOpacity !== undefined && node.data.borderOpacity !== 10) entry.borderOpacity = node.data.borderOpacity;
    if (node.data.borderLightness !== undefined && node.data.borderLightness !== 5) entry.borderLightness = node.data.borderLightness;
    if (node.data.borderWidth) entry.borderWidth = node.data.borderWidth;
    if (node.data.borderStyle) entry.borderStyle = node.data.borderStyle;
    if (node.zIndex !== undefined && node.zIndex !== 0) entry.zIndex = node.zIndex;
    if (node.data.fontSize) entry.fontSize = node.data.fontSize;
    if (node.data.textColor) entry.textColor = node.data.textColor;
    if (node.data.textOpacity !== undefined && node.data.textOpacity !== 10) entry.textOpacity = node.data.textOpacity;
    if (node.data.textLightness !== undefined && node.data.textLightness !== 5) entry.textLightness = node.data.textLightness;
    if (node.data.textAlign && node.data.textAlign !== "center") entry.textAlign = node.data.textAlign;
    if (node.data.bold) entry.bold = node.data.bold;
    if (node.data.italic) entry.italic = node.data.italic;
    if (node.data.underline) entry.underline = node.data.underline;
    if (node.data.componentDefinitionId) entry.componentDefinitionId = node.data.componentDefinitionId as string;
    if (node.data.componentInstanceName) entry.componentInstanceName = node.data.componentInstanceName as string;
    if (node.data.componentSyncVersion !== undefined) entry.componentSyncVersion = node.data.componentSyncVersion as number;
    if (node.data.collapsed) entry.collapsed = true;
    if (node.data.expandedSize) entry.expandedSize = node.data.expandedSize as { width: number; height: number };

    nodesLayout[node.id] = entry;
  }

  // Build set of component child node IDs to filter internal edges
  const componentChildIds = new Set(nodes.filter((n) => n.data.componentParentId).map((n) => n.id));

  const edgesLayout: Record<string, FlowmaidEdgeLayout> = {};
  for (const edge of edges) {
    // Skip bridge edges
    if (edge.data?.isBridgeEdge) continue;
    // Skip internal edges between component children
    if (componentChildIds.has(edge.source) && componentChildIds.has(edge.target)) continue;
    const entry: FlowmaidEdgeLayout = {
      source: edge.source,
      target: edge.target,
    };
    if (edge.data?.label) entry.label = edge.data.label;
    if (edge.sourceHandle) entry.sourceHandle = edge.sourceHandle;
    if (edge.targetHandle) entry.targetHandle = edge.targetHandle;
    if (edge.data?.edgeType && edge.data.edgeType !== "bezier") entry.edgeType = edge.data.edgeType;
    if (edge.data?.markerStart) entry.markerStart = edge.data.markerStart;
    if (edge.data?.markerEnd && edge.data.markerEnd !== "arrowclosed") entry.markerEnd = edge.data.markerEnd;
    if (edge.data?.strokeWidth && edge.data.strokeWidth !== 2) entry.strokeWidth = edge.data.strokeWidth;
    if (edge.data?.strokeColor) entry.strokeColor = edge.data.strokeColor;
    if (edge.data?.strokeOpacity !== undefined && edge.data.strokeOpacity !== 10) entry.strokeOpacity = edge.data.strokeOpacity;
    if (edge.data?.strokeLightness !== undefined && edge.data.strokeLightness !== 5) entry.strokeLightness = edge.data.strokeLightness;
    if (edge.data?.strokeStyle && edge.data.strokeStyle !== "solid") entry.strokeStyle = edge.data.strokeStyle;
    if (edge.data?.waypoints && edge.data.waypoints.length > 0) entry.waypoints = edge.data.waypoints;

    edgesLayout[edge.id] = entry;
  }

  const layout: FlowmaidLayout = {
    direction,
    nodes: nodesLayout,
    edges: edgesLayout,
    ...(componentDefinitions && componentDefinitions.length > 0 && { componentDefinitions }),
  };

  const layoutSection = stringify(layout);

  return `--- mermaid ---\n${mermaidSection}\n\n--- layout ---\n${layoutSection}`;
}

/**
 * Serialize only the selected nodes/edges (+ related edges) for filtered preview.
 * Returns the same format as serialize() but with only the relevant layout entries.
 * Mermaid section is always included in full.
 */
export function serializeFiltered(
  nodes: FlowNode[],
  edges: FlowEdge[],
  direction: FlowDirection,
  componentDefinitions: ComponentDefinition[] | undefined,
  selectedNodeIds: string[],
  selectedEdgeIds: string[]
): string {
  const full = serialize(nodes, edges, direction, componentDefinitions);
  if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) return full;

  const parts = full.split("--- layout ---\n");
  if (parts.length < 2) return full;

  const mermaidPart = parts[0];
  const layoutYaml = parts[1];

  const layout = parse(layoutYaml) as FlowmaidLayout | null;
  if (!layout) return full;

  const nodeIdSet = new Set(selectedNodeIds);
  const edgeIdSet = new Set(selectedEdgeIds);

  const filteredLayout: FlowmaidLayout = {
    direction: layout.direction,
    nodes: {},
    edges: {},
  };

  if (layout.nodes) {
    for (const [id, node] of Object.entries(layout.nodes)) {
      if (nodeIdSet.has(id)) filteredLayout.nodes[id] = node;
    }
  }
  if (layout.edges) {
    for (const [id, edge] of Object.entries(layout.edges)) {
      if (edgeIdSet.has(id)) filteredLayout.edges[id] = edge;
    }
  }
  if (layout.componentDefinitions) {
    filteredLayout.componentDefinitions = layout.componentDefinitions;
  }

  const filteredSection = stringify(filteredLayout);

  return `${mermaidPart}--- layout ---\n${filteredSection}`;
}
