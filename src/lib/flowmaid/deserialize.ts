import { parse } from "yaml";
import type { FlowNode, FlowEdge } from "@/store/types";
import type { FlowDirection, ComponentDefinition } from "@/types/flow";
import type { FlowmaidLayout } from "./schema";
import { idToCounter } from "@/lib/id";
import { generateComponentChildren, generateBridgeEdges } from "@/lib/component-children";

interface DeserializeResult {
  nodes: FlowNode[];
  edges: FlowEdge[];
  direction: FlowDirection;
  nextIdCounter: number;
  componentDefinitions?: ComponentDefinition[];
}

/**
 * Parse a .flowmaid file and return only the raw layout data (no React Flow conversion).
 * Used by diff comparison to compare layouts directly without React Flow internal state.
 */
export function parseLayoutOnly(content: string): FlowmaidLayout {
  const layoutMatch = content.indexOf("--- layout ---");
  if (layoutMatch === -1) {
    throw new Error("Invalid .flowmaid file: missing layout section");
  }
  const layoutYaml = content.slice(layoutMatch + "--- layout ---".length).trim();
  const layout = parse(layoutYaml) as FlowmaidLayout | null;
  if (!layout) {
    throw new Error("Invalid .flowmaid file: empty layout section");
  }
  return layout;
}

export function deserialize(content: string): DeserializeResult {
  const layoutMatch = content.indexOf("--- layout ---");
  if (layoutMatch === -1) {
    throw new Error("Invalid .flowmaid file: missing layout section");
  }

  const layoutYaml = content.slice(layoutMatch + "--- layout ---".length).trim();
  const layout: FlowmaidLayout = parse(layoutYaml);

  const nodes: FlowNode[] = [];
  let maxCounter = -1;

  for (const [id, n] of Object.entries(layout.nodes)) {
    const isComponentInstance = !!n.componentDefinitionId;
    const node: FlowNode = {
      id,
      type: isComponentInstance ? "componentInstance" : n.shape,
      position: n.position,
      data: {
        label: n.label,
        shape: n.shape as FlowNode["data"]["shape"],
      },
      style: n.size ? { width: n.size.width, height: n.size.height } : undefined,
    };

    // Restore component instance fields
    if (n.componentDefinitionId) node.data.componentDefinitionId = n.componentDefinitionId;
    if (n.componentInstanceName) node.data.componentInstanceName = n.componentInstanceName;
    if (n.componentSyncVersion !== undefined) node.data.componentSyncVersion = n.componentSyncVersion;
    // componentLabelOverrides is deprecated — ignored on import
    if (n.collapsed) node.data.collapsed = n.collapsed;
    if (n.expandedSize) node.data.expandedSize = n.expandedSize;

    // Restore style properties
    if (n.fillColor) node.data.fillColor = n.fillColor;
    if (n.fillOpacity !== undefined) node.data.fillOpacity = n.fillOpacity;
    if (n.fillLightness !== undefined) node.data.fillLightness = n.fillLightness;
    if (n.borderColor) node.data.borderColor = n.borderColor;
    if (n.borderOpacity !== undefined) node.data.borderOpacity = n.borderOpacity;
    if (n.borderLightness !== undefined) node.data.borderLightness = n.borderLightness;
    if (n.borderWidth) node.data.borderWidth = n.borderWidth;
    if (n.borderStyle) node.data.borderStyle = n.borderStyle;
    if (n.zIndex !== undefined) node.zIndex = n.zIndex;
    if (n.fontSize) node.data.fontSize = n.fontSize;
    if (n.textColor) node.data.textColor = n.textColor;
    if (n.textOpacity !== undefined) node.data.textOpacity = n.textOpacity;
    if (n.textLightness !== undefined) node.data.textLightness = n.textLightness;
    if (n.textAlign) node.data.textAlign = n.textAlign;
    if (n.textVerticalAlign) node.data.textVerticalAlign = n.textVerticalAlign;
    if (n.bold) node.data.bold = n.bold;
    if (n.italic) node.data.italic = n.italic;
    if (n.underline) node.data.underline = n.underline;

    nodes.push(node);

    // Track highest counter for auto-id
    if (/^[A-Z]+$/.test(id)) {
      const counter = idToCounter(id);
      if (counter > maxCounter) maxCounter = counter;
    }
  }

  const edges: FlowEdge[] = [];
  for (const [id, e] of Object.entries(layout.edges)) {
    const edge: FlowEdge = {
      id,
      source: e.source,
      target: e.target,
      type: "labeled",
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      data: {
        label: e.label ?? "",
        edgeType: e.edgeType ?? "bezier",
        markerStart: e.markerStart,
        markerEnd: e.markerEnd ?? "arrowclosed",
        strokeWidth: e.strokeWidth,
        strokeColor: e.strokeColor,
        strokeOpacity: e.strokeOpacity,
        strokeLightness: e.strokeLightness,
        strokeStyle: e.strokeStyle,
        waypoints: e.waypoints,
      },
    };

    edges.push(edge);
  }

  // Regenerate child nodes and internal edges for component instances
  const componentDefinitions = layout.componentDefinitions ?? [];

  const allChildNodes: FlowNode[] = [];
  const allChildEdges: FlowEdge[] = [];

  for (const node of nodes) {
    if (!node.data.componentDefinitionId) continue;
    const def = componentDefinitions.find((d) => d.id === node.data.componentDefinitionId);
    if (!def) continue;

    // Populate runtime-only direction field from definition
    if (def.direction) {
      node.data.componentDefinitionDirection = def.direction;
    }

    const isCollapsed = node.data.collapsed ?? false;

    const { childNodes, childEdges } = generateComponentChildren({
      parentId: node.id,
      def,
      hidden: isCollapsed,
    });

    allChildNodes.push(...childNodes);
    allChildEdges.push(...childEdges);
  }

  // Generate bridge edges for component instances
  const allNodes = [...nodes, ...allChildNodes];
  const allEdgesBeforeBridge = [...edges, ...allChildEdges];
  const bridgeEdges: FlowEdge[] = [];

  for (const node of nodes) {
    if (!node.data.componentDefinitionId) continue;
    const def = componentDefinitions.find((d) => d.id === node.data.componentDefinitionId);
    if (!def) continue;

    const bridges = generateBridgeEdges({
      parentId: node.id,
      def,
      allEdges: allEdgesBeforeBridge,
      direction: def.direction ?? layout.direction,
    });

    const isCollapsed = node.data.collapsed ?? false;
    for (const b of bridges) {
      if (isCollapsed) b.hidden = true;
      bridgeEdges.push(b);
    }
  }

  return {
    nodes: allNodes,
    edges: [...allEdgesBeforeBridge, ...bridgeEdges],
    direction: layout.direction ?? "TD",
    nextIdCounter: maxCounter + 1,
    componentDefinitions,
  };
}
