import type { FlowmaidLayout, FlowmaidNodeLayout } from "@/lib/flowmaid/schema";
import type { DiffKind } from "./types";
import type { FlowNode, FlowEdge } from "@/store/types";

/** Colors for diff highlights */
export const DIFF_COLORS: Record<DiffKind, string> = {
  added: "#22c55e",
  deleted: "#ef4444",
  modified: "#f59e0b",
  unchanged: "transparent",
};

/** Build a FlowNode from a layout entry, optionally applying extra CSS styles */
export function buildNodeFromLayout(
  id: string,
  n: FlowmaidNodeLayout,
  extraStyle?: React.CSSProperties,
): FlowNode {
  return {
    id,
    type: n.componentDefinitionId ? "componentInstance" : n.shape,
    position: n.position,
    data: {
      label: n.label,
      shape: n.shape as FlowNode["data"]["shape"],
      fillColor: n.fillColor,
      fillOpacity: n.fillOpacity,
      fillLightness: n.fillLightness,
      borderColor: n.borderColor,
      borderOpacity: n.borderOpacity,
      borderLightness: n.borderLightness,
      borderWidth: n.borderWidth,
      borderStyle: n.borderStyle,
      fontSize: n.fontSize,
      textColor: n.textColor,
      textOpacity: n.textOpacity,
      textLightness: n.textLightness,
      textAlign: n.textAlign,
      textVerticalAlign: n.textVerticalAlign,
      bold: n.bold,
      italic: n.italic,
      underline: n.underline,
    },
    zIndex: n.zIndex,
    style: {
      ...(n.size ? { width: n.size.width, height: n.size.height } : {}),
      ...extraStyle,
    },
  } as FlowNode;
}

/** Build plain FlowNodes and FlowEdges from a FlowmaidLayout (no diff styling) */
export function buildPlainNodesEdges(layout: FlowmaidLayout): {
  displayNodes: FlowNode[];
  displayEdges: FlowEdge[];
} {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  for (const [id, n] of Object.entries(layout.nodes)) {
    nodes.push(buildNodeFromLayout(id, n));
  }

  for (const [id, e] of Object.entries(layout.edges)) {
    edges.push({
      id,
      source: e.source,
      target: e.target,
      type: "labeled",
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      data: {
        label: e.label ?? "",
        edgeType: e.edgeType ?? "bezier",
        markerEnd: e.markerEnd ?? "arrowclosed",
        markerStart: e.markerStart,
        strokeWidth: e.strokeWidth,
        strokeColor: e.strokeColor,
        strokeOpacity: e.strokeOpacity,
        strokeLightness: e.strokeLightness,
        strokeStyle: e.strokeStyle,
        waypoints: e.waypoints,
      },
    } as FlowEdge);
  }

  return { displayNodes: nodes, displayEdges: edges };
}
