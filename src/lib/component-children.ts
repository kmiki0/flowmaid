import type { FlowNode, FlowEdge } from "@/store/types";
import type { NodeShape, EdgeType, ComponentDefinition, ComponentInternalEdge } from "@/types/flow";
import { MarkerType } from "@xyflow/react";

export const COMPONENT_HEADER_HEIGHT = 36;
export const COMPONENT_PADDING = 20;
const CHILD_NODE_W = 150;
const CHILD_NODE_H = 50;
const CHILD_SCALE = 0.75;
const MIN_CHILD_W = 40;
const MIN_CHILD_H = 20;

function markerStyleToMarker(style?: string, color?: string) {
  switch (style) {
    case "arrow":
      return color ? { type: MarkerType.Arrow, color } : { type: MarkerType.Arrow };
    case "arrowclosed":
      return color ? { type: MarkerType.ArrowClosed, color } : { type: MarkerType.ArrowClosed };
    case "none":
      return undefined;
    default:
      return undefined;
  }
}

interface GenerateChildrenOptions {
  parentId: string;
  def: ComponentDefinition;
  hidden?: boolean;
  direction?: "TD" | "LR";
}

interface GenerateChildrenResult {
  childNodes: FlowNode[];
  childEdges: FlowEdge[];
}

export function generateComponentChildren(opts: GenerateChildrenOptions): GenerateChildrenResult {
  const { parentId, def, hidden = false, direction } = opts;
  const effectiveDirection = direction ?? def.direction ?? "TD";

  // Exclude entry/exit nodes
  const excludeIds = new Set<string>();
  if (def.entryNodeId) excludeIds.add(def.entryNodeId);
  if (def.exitNodeId) excludeIds.add(def.exitNodeId);

  // Find min position to normalize origin
  const visibleNodes = def.nodes.filter((n) => !excludeIds.has(n.id));
  const minX = visibleNodes.length > 0 ? Math.min(...visibleNodes.map((n) => n.position.x)) : 0;
  const minY = visibleNodes.length > 0 ? Math.min(...visibleNodes.map((n) => n.position.y)) : 0;

  const childNodes: FlowNode[] = visibleNodes
    .map((n) => {
      const origW = n.style?.width ?? CHILD_NODE_W;
      const origH = n.style?.height ?? CHILD_NODE_H;
      return {
        id: `${parentId}_${n.id}`,
        type: n.shape,
        position: {
          x: (n.position.x - minX) * CHILD_SCALE + COMPONENT_PADDING,
          y: (n.position.y - minY) * CHILD_SCALE + COMPONENT_HEADER_HEIGHT + COMPONENT_PADDING,
        },
        parentId,
        selectable: false,
        draggable: false,
        data: {
          label: n.label,
          shape: n.shape as NodeShape,
          componentParentId: parentId,
          componentInternalId: n.id,
          ...(n.fillColor ? { fillColor: n.fillColor } : {}),
          ...(n.fillOpacity !== undefined ? { fillOpacity: n.fillOpacity } : {}),
          ...(n.fillLightness !== undefined ? { fillLightness: n.fillLightness } : {}),
          ...(n.borderColor ? { borderColor: n.borderColor } : {}),
          ...(n.borderOpacity !== undefined ? { borderOpacity: n.borderOpacity } : {}),
          ...(n.borderLightness !== undefined ? { borderLightness: n.borderLightness } : {}),
          ...(n.borderWidth ? { borderWidth: n.borderWidth } : {}),
          ...(n.borderStyle ? { borderStyle: n.borderStyle } : {}),
          ...(n.fontSize ? { fontSize: n.fontSize } : {}),
          ...(n.textColor ? { textColor: n.textColor } : {}),
          ...(n.textOpacity !== undefined ? { textOpacity: n.textOpacity } : {}),
          ...(n.textLightness !== undefined ? { textLightness: n.textLightness } : {}),
          ...(n.textAlign ? { textAlign: n.textAlign } : {}),
          ...(n.bold ? { bold: n.bold } : {}),
          ...(n.italic ? { italic: n.italic } : {}),
          ...(n.underline ? { underline: n.underline } : {}),
        },
        style: {
          width: Math.round(origW * CHILD_SCALE),
          height: Math.round(origH * CHILD_SCALE),
        },
        hidden,
      };
    });

  // Exclude edges connected to entry/exit nodes
  // Default handles for child edges: direction-aware
  const defaultSourceHandle = effectiveDirection === "LR" ? "right-source" : "bottom-source";
  const defaultTargetHandle = effectiveDirection === "LR" ? "left-target" : "top-target";

  const childEdges: FlowEdge[] = def.edges
    .filter((e) => !excludeIds.has(e.source) && !excludeIds.has(e.target))
    .map((e) => ({
      id: `${parentId}_${e.id}`,
      source: `${parentId}_${e.source}`,
      target: `${parentId}_${e.target}`,
      sourceHandle: e.sourceHandle ?? defaultSourceHandle,
      targetHandle: e.targetHandle ?? defaultTargetHandle,
      type: "labeled",
      selectable: false,
      markerEnd: markerStyleToMarker(e.markerEnd ?? "arrowclosed", e.strokeColor) ?? { type: MarkerType.ArrowClosed },
      markerStart: markerStyleToMarker(e.markerStart, e.strokeColor),
      data: {
        label: e.label ?? "",
        edgeType: (e.edgeType ?? "bezier") as EdgeType,
        markerStart: e.markerStart,
        markerEnd: e.markerEnd ?? ("arrowclosed" as const),
        ...(e.strokeWidth ? { strokeWidth: e.strokeWidth } : {}),
        ...(e.strokeColor ? { strokeColor: e.strokeColor } : {}),
        ...(e.strokeOpacity !== undefined ? { strokeOpacity: e.strokeOpacity } : {}),
        ...(e.strokeLightness !== undefined ? { strokeLightness: e.strokeLightness } : {}),
        ...(e.strokeStyle ? { strokeStyle: e.strokeStyle } : {}),
      },
      hidden,
    }));

  return { childNodes, childEdges };
}

export function calculateComponentSize(def: ComponentDefinition): { width: number; height: number } {
  // Exclude entry/exit nodes from size calculation
  const excludeIds = new Set<string>();
  if (def.entryNodeId) excludeIds.add(def.entryNodeId);
  if (def.exitNodeId) excludeIds.add(def.exitNodeId);

  const sizeNodes = def.nodes.filter((n) => !excludeIds.has(n.id));
  const sMinX = sizeNodes.length > 0 ? Math.min(...sizeNodes.map((n) => n.position.x)) : 0;
  const sMinY = sizeNodes.length > 0 ? Math.min(...sizeNodes.map((n) => n.position.y)) : 0;

  let maxX = 0;
  let maxY = 0;
  for (const n of sizeNodes) {
    const right = (n.position.x - sMinX + (n.style?.width ?? CHILD_NODE_W)) * CHILD_SCALE;
    const bottom = (n.position.y - sMinY + (n.style?.height ?? CHILD_NODE_H)) * CHILD_SCALE;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  }
  return {
    width: Math.max(200, Math.round(maxX) + COMPONENT_PADDING * 2),
    height: Math.max(120, Math.round(maxY) + COMPONENT_HEADER_HEIGHT + COMPONENT_PADDING * 2),
  };
}

/**
 * Recompute child node positions from the definition's base layout,
 * scaled to fit the current parent content area. Child node sizes are kept fixed.
 */
export function rescaleComponentChildren(
  childNodes: FlowNode[],
  parentId: string,
  def: ComponentDefinition,
  parentW: number,
  parentH: number,
): FlowNode[] {
  const baseSize = calculateComponentSize(def);
  const baseContentW = baseSize.width - COMPONENT_PADDING * 2;
  const baseContentH = baseSize.height - COMPONENT_HEADER_HEIGHT - COMPONENT_PADDING * 2;
  const currentContentW = parentW - COMPONENT_PADDING * 2;
  const currentContentH = parentH - COMPONENT_HEADER_HEIGHT - COMPONENT_PADDING * 2;
  if (baseContentW <= 0 || baseContentH <= 0 || currentContentW <= 0 || currentContentH <= 0) return childNodes;

  const scale = Math.min(currentContentW / baseContentW, currentContentH / baseContentH);

  // Exclude entry/exit nodes from the definition (same logic as generateComponentChildren)
  const excludeIds = new Set<string>();
  if (def.entryNodeId) excludeIds.add(def.entryNodeId);
  if (def.exitNodeId) excludeIds.add(def.exitNodeId);
  const visibleNodes = def.nodes.filter((n) => !excludeIds.has(n.id));
  const minX = visibleNodes.length > 0 ? Math.min(...visibleNodes.map((n) => n.position.x)) : 0;
  const minY = visibleNodes.length > 0 ? Math.min(...visibleNodes.map((n) => n.position.y)) : 0;

  // Build a map from definition node id → base position
  const baseMap = new Map<string, { x: number; y: number }>();
  for (const n of visibleNodes) {
    baseMap.set(n.id, {
      x: (n.position.x - minX) * CHILD_SCALE,
      y: (n.position.y - minY) * CHILD_SCALE,
    });
  }

  return childNodes.map((child) => {
    if (child.data.componentParentId !== parentId) return child;
    const internalId = child.data.componentInternalId as string | undefined;
    if (!internalId) return child;
    const base = baseMap.get(internalId);
    if (!base) return child;

    return {
      ...child,
      position: {
        x: COMPONENT_PADDING + base.x * scale,
        y: COMPONENT_HEADER_HEIGHT + COMPONENT_PADDING + base.y * scale,
      },
      // Child node sizes are NOT scaled — keep original size from definition
    };
  });
}

/**
 * Calculate minimum parent size that prevents child nodes from overflowing.
 * Used as minWidth/minHeight for NodeResizer.
 */
export function calculateMinComponentSize(def: ComponentDefinition): { minWidth: number; minHeight: number } {
  const excludeIds = new Set<string>();
  if (def.entryNodeId) excludeIds.add(def.entryNodeId);
  if (def.exitNodeId) excludeIds.add(def.exitNodeId);

  const visibleNodes = def.nodes.filter((n) => !excludeIds.has(n.id));
  if (visibleNodes.length === 0) return { minWidth: 180, minHeight: 80 };

  // Find the maximum right/bottom extent of child nodes at scale=1 (base CHILD_SCALE)
  const minX = Math.min(...visibleNodes.map((n) => n.position.x));
  const minY = Math.min(...visibleNodes.map((n) => n.position.y));

  let maxRight = 0;
  let maxBottom = 0;
  for (const n of visibleNodes) {
    const w = (n.style?.width ?? CHILD_NODE_W) * CHILD_SCALE;
    const h = (n.style?.height ?? CHILD_NODE_H) * CHILD_SCALE;
    const right = (n.position.x - minX) * CHILD_SCALE + w;
    const bottom = (n.position.y - minY) * CHILD_SCALE + h;
    if (right > maxRight) maxRight = right;
    if (bottom > maxBottom) maxBottom = bottom;
  }

  return {
    minWidth: Math.max(180, Math.round(maxRight) + COMPONENT_PADDING * 2),
    minHeight: Math.max(80, Math.round(maxBottom) + COMPONENT_HEADER_HEIGHT + COMPONENT_PADDING * 2),
  };
}

export function getEntryExitConnections(def: ComponentDefinition): {
  entryTargets: { nodeId: string; edgeProps: ComponentInternalEdge }[];
  exitSources: { nodeId: string; edgeProps: ComponentInternalEdge }[];
} {
  const entryTargets: { nodeId: string; edgeProps: ComponentInternalEdge }[] = [];
  const exitSources: { nodeId: string; edgeProps: ComponentInternalEdge }[] = [];

  for (const e of def.edges) {
    if (def.entryNodeId && e.source === def.entryNodeId) {
      entryTargets.push({ nodeId: e.target, edgeProps: e });
    }
    if (def.exitNodeId && e.target === def.exitNodeId) {
      exitSources.push({ nodeId: e.source, edgeProps: e });
    }
  }

  return { entryTargets, exitSources };
}

function makeBridgeEdge(
  id: string,
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string | undefined,
): FlowEdge {
  return {
    id,
    source,
    sourceHandle,
    target,
    targetHandle,
    type: "labeled",
    selectable: false,
    markerEnd: { type: MarkerType.ArrowClosed },
    data: {
      label: "",
      edgeType: "straight",
      markerEnd: "arrowclosed",
      isBridgeEdge: true,
    },
  };
}

export function generateBridgeEdges(opts: {
  parentId: string;
  def: ComponentDefinition;
  allEdges: FlowEdge[];
  direction?: "TD" | "LR";
}): FlowEdge[] {
  const { parentId, def, allEdges, direction = "TD" } = opts;
  const { entryTargets, exitSources } = getEntryExitConnections(def);
  const bridgeEdges: FlowEdge[] = [];

  // Direction-aware position names for entry/exit
  const entryPosition = direction === "LR" ? "left" : "top";
  const exitPosition = direction === "LR" ? "right" : "bottom";

  function getHandlePosition(handleId: string | null | undefined): string | null {
    if (!handleId) return null;
    return handleId.split("-")[0];
  }

  // 2 bridge patterns (natural flow direction only):
  // 1. Entry incoming: External → parent entry → bridge → entryTarget children
  // 2. Exit outgoing: exitSource children → bridge → parent exit → External

  for (const extEdge of allEdges) {
    if (extEdge.data?.isBridgeEdge) continue;

    const connectsAsTarget = extEdge.target === parentId;
    const connectsAsSource = extEdge.source === parentId;
    if (!connectsAsTarget && !connectsAsSource) continue;

    const targetPos = connectsAsTarget ? getHandlePosition(extEdge.targetHandle) : null;
    const sourcePos = connectsAsSource ? getHandlePosition(extEdge.sourceHandle) : null;

    // Determine which position on the parent this edge connects to
    // Require explicit handle position — skip edges with unknown handles
    const atEntry =
      (connectsAsTarget && targetPos === entryPosition) ||
      (connectsAsSource && sourcePos === entryPosition);
    const atExit =
      (connectsAsSource && sourcePos === exitPosition) ||
      (connectsAsTarget && targetPos === exitPosition);

    // Bridge only for natural flow directions:
    // Entry incoming: External → parent entry → bridge → entryTarget children
    // Exit outgoing: exitSource children → bridge → parent exit → External
    if (atEntry && connectsAsTarget) {
      for (const { nodeId } of entryTargets) {
        const childId = `${parentId}_${nodeId}`;
        bridgeEdges.push(makeBridgeEdge(
          `bridge_${parentId}_${extEdge.id}_entry_${nodeId}`,
          parentId, "bridge-entry-source", childId, `${entryPosition}-target`,
        ));
      }
    }

    if (atExit && connectsAsSource) {
      for (const { nodeId } of exitSources) {
        const childId = `${parentId}_${nodeId}`;
        bridgeEdges.push(makeBridgeEdge(
          `bridge_${parentId}_${extEdge.id}_exit_${nodeId}`,
          childId, `${exitPosition}-source`, parentId, "bridge-exit-target",
        ));
      }
    }
  }

  return bridgeEdges;
}
