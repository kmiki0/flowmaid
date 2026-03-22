import type { FlowNodeData, FlowEdgeData, NodeShape } from "@/types/flow";
import type { FlowNode, FlowEdge, PredictiveCandidate, PredictiveDirection } from "@/store/types";
import { DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT, DEFAULT_DIAMOND_SIZE, PREDICTIVE_GAP_PX } from "@/lib/constants";

export const DIRECTION_HANDLES: Record<PredictiveDirection, { sourceHandle: string; targetHandle: string }> = {
  bottom: { sourceHandle: "bottom-source", targetHandle: "top-target" },
  top:    { sourceHandle: "top-source",    targetHandle: "bottom-target" },
  right:  { sourceHandle: "right-source",  targetHandle: "left-target" },
  left:   { sourceHandle: "left-source",   targetHandle: "right-target" },
};

export function getDefaultSize(shape: string): { width: number; height: number } {
  if (shape === "diamond") return { width: DEFAULT_DIAMOND_SIZE, height: DEFAULT_DIAMOND_SIZE };
  if (shape === "circle") return { width: DEFAULT_NODE_HEIGHT * 2, height: DEFAULT_NODE_HEIGHT * 2 };
  if (shape === "hexagon") return { width: DEFAULT_NODE_WIDTH + 20, height: DEFAULT_NODE_HEIGHT + 10 };
  if (shape === "cylinder") return { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT + 20 };
  if (shape === "document") return { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT + 10 };
  if (shape === "predefinedProcess" || shape === "display") return { width: DEFAULT_NODE_WIDTH + 20, height: DEFAULT_NODE_HEIGHT };
  return { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT };
}

export function computeGhostPosition(
  sourceNode: FlowNode,
  direction: PredictiveDirection,
  ghostShape: string,
): { x: number; y: number; gw: number; gh: number } {
  const w = sourceNode.measured?.width ?? (sourceNode.style as Record<string, number>)?.width ?? DEFAULT_NODE_WIDTH;
  const h = sourceNode.measured?.height ?? (sourceNode.style as Record<string, number>)?.height ?? DEFAULT_NODE_HEIGHT;
  const ghostSize = getDefaultSize(ghostShape);
  const gw = ghostSize.width;
  const gh = ghostSize.height;

  switch (direction) {
    case "bottom":
      return { x: sourceNode.position.x + (w - gw) / 2, y: sourceNode.position.y + h + PREDICTIVE_GAP_PX, gw, gh };
    case "top":
      return { x: sourceNode.position.x + (w - gw) / 2, y: sourceNode.position.y - gh - PREDICTIVE_GAP_PX, gw, gh };
    case "right":
      return { x: sourceNode.position.x + w + PREDICTIVE_GAP_PX, y: sourceNode.position.y + (h - gh) / 2, gw, gh };
    case "left":
      return { x: sourceNode.position.x - gw - PREDICTIVE_GAP_PX, y: sourceNode.position.y + (h - gh) / 2, gw, gh };
  }
}

/**
 * Compute predictive input candidates for a source node.
 * Returns up to 4 candidates (duplicates by shape removed).
 */
export function computeCandidates(
  sourceNode: FlowNode,
  allEdges: FlowEdge[],
  allNodes: FlowNode[],
): PredictiveCandidate[] {
  const candidates: PredictiveCandidate[] = [];
  const seenShapes = new Set<NodeShape>();

  const srcData = sourceNode.data;

  // Find an existing edge from this source to derive edge style
  const outEdge = allEdges.find(
    (e) => e.source === sourceNode.id && !e.data?.isBridgeEdge,
  );
  const outEdgeData: Partial<FlowEdgeData> = outEdge?.data
    ? {
        edgeType: outEdge.data.edgeType,
        markerStart: outEdge.data.markerStart,
        markerEnd: outEdge.data.markerEnd,
        strokeWidth: outEdge.data.strokeWidth,
        strokeColor: outEdge.data.strokeColor,
        strokeStyle: outEdge.data.strokeStyle,
      }
    : {};

  // 1. Full copy (style + label)
  const fullCopyData: FlowNodeData = {
    label: "",  // will be replaced with new ID
    shape: srcData.shape,
    ...(srcData.fillColor && { fillColor: srcData.fillColor }),
    ...(srcData.fillOpacity !== undefined && { fillOpacity: srcData.fillOpacity }),
    ...(srcData.fillLightness !== undefined && { fillLightness: srcData.fillLightness }),
    ...(srcData.borderColor && { borderColor: srcData.borderColor }),
    ...(srcData.borderOpacity !== undefined && { borderOpacity: srcData.borderOpacity }),
    ...(srcData.borderLightness !== undefined && { borderLightness: srcData.borderLightness }),
    ...(srcData.borderWidth && { borderWidth: srcData.borderWidth }),
    ...(srcData.borderStyle && { borderStyle: srcData.borderStyle }),
    ...(srcData.fontSize && { fontSize: srcData.fontSize }),
    ...(srcData.textColor && { textColor: srcData.textColor }),
    ...(srcData.textOpacity !== undefined && { textOpacity: srcData.textOpacity }),
    ...(srcData.textLightness !== undefined && { textLightness: srcData.textLightness }),
    ...(srcData.textAlign && { textAlign: srcData.textAlign }),
    ...(srcData.textVerticalAlign && { textVerticalAlign: srcData.textVerticalAlign }),
    ...(srcData.bold && { bold: srcData.bold }),
    ...(srcData.italic && { italic: srcData.italic }),
    ...(srcData.underline && { underline: srcData.underline }),
  };
  candidates.push({ kind: "fullCopy", nodeData: fullCopyData, edgeData: outEdgeData });
  seenShapes.add(srcData.shape);

  // 2. Shape only copy (skip if source has no custom style — would be identical to fullCopy)
  const hasCustomStyle = !!(
    srcData.fillColor || srcData.fillOpacity !== undefined || srcData.fillLightness !== undefined ||
    srcData.borderColor || srcData.borderOpacity !== undefined || srcData.borderLightness !== undefined ||
    srcData.borderWidth || srcData.borderStyle ||
    srcData.fontSize || srcData.textColor || srcData.textOpacity !== undefined || srcData.textLightness !== undefined ||
    srcData.textAlign || srcData.textVerticalAlign || srcData.bold || srcData.italic || srcData.underline
  );
  if (hasCustomStyle) {
    const shapeCopyData: FlowNodeData = {
      label: "",
      shape: srcData.shape,
    };
    candidates.push({ kind: "shapeCopy", nodeData: shapeCopyData, edgeData: {} });
  }

  // 3-4. Pair frequency candidates
  const pairShapes = computePairFrequencies(srcData.shape, allEdges, allNodes);
  for (let i = 0; i < pairShapes.length && candidates.length < 4; i++) {
    const shape = pairShapes[i];
    if (seenShapes.has(shape)) continue;
    seenShapes.add(shape);
    const kind = candidates.length === 2 ? "pairFreq1" as const : "pairFreq2" as const;
    candidates.push({
      kind,
      nodeData: { label: "", shape },
      edgeData: {},
    });
  }

  // Fill with rectangle (処理) if not yet at 4 candidates
  if (candidates.length < 4 && !seenShapes.has("rectangle")) {
    candidates.push({ kind: "pairFreq1", nodeData: { label: "", shape: "rectangle" }, edgeData: {} });
    seenShapes.add("rectangle");
  }

  // Fill with diamond (条件分岐) if not yet at 4 candidates
  if (candidates.length < 4 && !seenShapes.has("diamond")) {
    candidates.push({ kind: "pairFreq2", nodeData: { label: "", shape: "diamond" }, edgeData: {} });
  }

  return candidates;
}

/**
 * Count edge pairs where source shape matches, return target shapes sorted by frequency.
 * Excludes "text" shape from results.
 */
function computePairFrequencies(
  sourceShape: NodeShape,
  allEdges: FlowEdge[],
  allNodes: FlowNode[],
): NodeShape[] {
  const nodeMap = new Map<string, FlowNode>();
  for (const n of allNodes) nodeMap.set(n.id, n);

  const freq = new Map<NodeShape, number>();
  for (const edge of allEdges) {
    if (edge.data?.isBridgeEdge) continue;
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (!src || !tgt) continue;
    if (src.data.shape !== sourceShape) continue;
    if (tgt.data.shape === "text") continue;
    freq.set(tgt.data.shape, (freq.get(tgt.data.shape) ?? 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([shape]) => shape);
}
