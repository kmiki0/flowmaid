import type { FlowNode, FlowEdge } from "@/store/types";
import type { FlowDirection, NodeShape } from "@/types/flow";
import { MarkerType } from "@xyflow/react";
import {
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_HEIGHT,
  DEFAULT_DIAMOND_SIZE,
} from "@/lib/constants";
import { idToCounter } from "@/lib/id";
import { autoLayout } from "./autoLayout";
import type { MermaidLayoutResult } from "./renderLayout";

/**
 * Reverse of escapeMermaid: convert Mermaid escape sequences back to original characters.
 */
export function unescapeMermaid(text: string): string {
  let result = text
    .replace(/#amp;/g, "&")
    .replace(/#quot;/g, '"')
    .replace(/#lt;/g, "<")
    .replace(/#gt;/g, ">")
    .replace(/#lbrace;/g, "{")
    .replace(/#rbrace;/g, "}")
    .replace(/#lpar;/g, "(")
    .replace(/#rpar;/g, ")")
    .replace(/#lbrack;/g, "[")
    .replace(/#rbrack;/g, "]");
  // Strip surrounding double quotes (Mermaid quoted labels), but only if length > 2
  if (result.length > 2 && result.startsWith('"') && result.endsWith('"')) {
    result = result.slice(1, -1);
  }
  // Convert <br/> and <br> to newline
  result = result.replace(/<br\s*\/?>/gi, "\n");
  return result;
}

// Shape patterns ordered from most specific (longest delimiters) to least specific
const SHAPE_PATTERNS: { open: string; close: string; shape: NodeShape }[] = [
  { open: "((", close: "))", shape: "circle" },
  { open: "([", close: "])", shape: "stadium" },
  { open: "[(", close: ")]", shape: "cylinder" },
  { open: "[[", close: "]]", shape: "predefinedProcess" },
  { open: "{{", close: "}}", shape: "hexagon" },
  { open: "[/", close: "\\]", shape: "document" },
  { open: "[\\", close: "/]", shape: "manualInput" },
  { open: "[/", close: "/]", shape: "parallelogram" },
  { open: "[\\", close: "\\]", shape: "trapezoid" },
  { open: "{", close: "}", shape: "diamond" },
  { open: "(", close: ")", shape: "roundedRect" },
  { open: "[", close: "]", shape: "rectangle" },
];

function parseNodeDef(raw: string): { id: string; label: string; shape: NodeShape } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  for (const { open, close, shape } of SHAPE_PATTERNS) {
    const openIdx = trimmed.indexOf(open);
    if (openIdx < 1) continue;

    const id = trimmed.slice(0, openIdx);
    // Verify the rest ends with close
    const rest = trimmed.slice(openIdx + open.length);
    if (!rest.endsWith(close)) continue;

    const label = unescapeMermaid(rest.slice(0, rest.length - close.length));
    return { id, label, shape };
  }

  // No shape delimiters: just an ID reference
  return null;
}

function getNodeSize(shape: NodeShape): { width: number; height: number } {
  switch (shape) {
    case "diamond":
      return { width: DEFAULT_DIAMOND_SIZE, height: DEFAULT_DIAMOND_SIZE };
    case "circle":
      return { width: DEFAULT_NODE_HEIGHT * 2, height: DEFAULT_NODE_HEIGHT * 2 };
    case "hexagon":
      return { width: DEFAULT_NODE_WIDTH + 20, height: DEFAULT_NODE_HEIGHT + 10 };
    case "cylinder":
      return { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT + 20 };
    case "document":
      return { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT + 10 };
    case "predefinedProcess":
      return { width: DEFAULT_NODE_WIDTH + 20, height: DEFAULT_NODE_HEIGHT };
    case "display":
      return { width: DEFAULT_NODE_WIDTH + 20, height: DEFAULT_NODE_HEIGHT };
    default:
      return { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT };
  }
}

// Split an edge line by arrow patterns, returning segments and labels
// Supports: -->, -.->, ===>, ~~>, -->, etc.
const ARROW_RE = /\s*(?:-+\.?-*>|={2,}>|~{2,}>)\s*(?:\|([^|]*)\|)?\s*/;

function splitEdgeLine(line: string): { segments: string[]; labels: string[] } | null {
  const segments: string[] = [];
  const labels: string[] = [];
  let remaining = line;

  while (true) {
    const match = ARROW_RE.exec(remaining);
    if (!match) {
      segments.push(remaining.trim());
      break;
    }
    segments.push(remaining.slice(0, match.index).trim());
    labels.push(match[1] ?? "");
    remaining = remaining.slice(match.index + match[0].length);
  }

  if (segments.length < 2) return null;
  return { segments, labels };
}

/**
 * Sort nodes so that parent nodes come before their children.
 * React Flow requires this ordering for parentId relationships to work correctly.
 */
function sortNodesParentFirst(nodes: FlowNode[]): void {
  nodes.sort((a, b) => {
    // Nodes without parentId come first
    if (!a.parentId && b.parentId) return -1;
    if (a.parentId && !b.parentId) return 1;
    // If b is a child of a, a comes first
    if (b.parentId === a.id) return -1;
    if (a.parentId === b.id) return 1;
    return 0;
  });
}

// Subgraph padding constants for bounding box calculation
const SUBGRAPH_PADDING_X = 40;
const SUBGRAPH_PADDING_Y_TOP = 40;
const SUBGRAPH_PADDING_Y_BOTTOM = 20;

export function parseMermaid(text: string, edgeType?: import("@/types/flow").EdgeType, layout?: MermaidLayoutResult): {
  nodes: FlowNode[];
  edges: FlowEdge[];
  direction: FlowDirection;
  nextIdCounter: number;
  componentDefinitions: import("@/types/flow").ComponentDefinition[];
} {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) throw new Error("Empty input");

  // Parse direction from first line
  const headerMatch = lines[0].match(/^(?:graph|flowchart)\s+(TD|LR|TB|BT)$/i);
  if (!headerMatch) throw new Error("Invalid header: expected 'graph TD|LR' or 'flowchart TD|LR'");

  let direction: FlowDirection = "TD";
  const dirStr = headerMatch[1].toUpperCase();
  if (dirStr === "LR") direction = "LR";
  // TB and BT both map to TD

  // Collect node definitions and edges
  const nodeDefs = new Map<string, { label: string; shape: NodeShape }>();
  const edgeList: { source: string; target: string; label: string }[] = [];

  function registerNode(id: string, label: string, shape: NodeShape) {
    // First definition wins for shape/label
    if (!nodeDefs.has(id)) {
      nodeDefs.set(id, { label, shape });
    }
  }

  function ensureNode(id: string) {
    if (!nodeDefs.has(id)) {
      nodeDefs.set(id, { label: id, shape: "rectangle" });
    }
  }

  function resolveNodeRef(segment: string): string {
    const parsed = parseNodeDef(segment);
    if (parsed) {
      registerNode(parsed.id, parsed.label, parsed.shape);
      return parsed.id;
    }
    // Plain ID reference
    const id = segment.trim();
    ensureNode(id);
    return id;
  }

  // Track subgraph contexts for subgraphGroup creation
  const subgraphStack: { id: string; label: string }[] = [];
  const subgraphLabels = new Map<string, string>();
  const nodeToSubgraph = new Map<string, string>();
  // Track parent subgraph for nested subgraphs
  const subgraphParentMap = new Map<string, string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Check for subgraph start
    const subgraphMatch = line.match(/^subgraph\s+(\S+?)(?:\[([^\]]*)\])?\s*$/);
    if (subgraphMatch) {
      const sgId = subgraphMatch[1];
      const rawLabel = subgraphMatch[2] ?? sgId;
      const sgLabel = unescapeMermaid(rawLabel);
      // Track parent subgraph for nesting
      if (subgraphStack.length > 0) {
        subgraphParentMap.set(sgId, subgraphStack[subgraphStack.length - 1].id);
      }
      subgraphStack.push({ id: sgId, label: sgLabel });
      subgraphLabels.set(sgId, sgLabel);
      continue;
    }

    // Check for end
    if (line === "end" && subgraphStack.length > 0) {
      subgraphStack.pop();
      continue;
    }

    const currentSubgraph = subgraphStack.length > 0 ? subgraphStack[subgraphStack.length - 1].id : null;

    // Try to parse as edge line (contains -->)
    const edgeParts = splitEdgeLine(line);
    if (edgeParts && edgeParts.segments.length >= 2) {
      const { segments, labels } = edgeParts;
      const resolvedIds = segments.map((s) => resolveNodeRef(s));

      for (const rid of resolvedIds) {
        if (currentSubgraph && !nodeToSubgraph.has(rid)) {
          nodeToSubgraph.set(rid, currentSubgraph);
        }
      }

      for (let j = 0; j < resolvedIds.length - 1; j++) {
        edgeList.push({
          source: resolvedIds[j],
          target: resolvedIds[j + 1],
          label: labels[j] ?? "",
        });
      }
      continue;
    }

    // Try to parse as standalone node definition
    const parsed = parseNodeDef(line);
    if (parsed) {
      registerNode(parsed.id, parsed.label, parsed.shape);
      if (currentSubgraph && !nodeToSubgraph.has(parsed.id)) {
        nodeToSubgraph.set(parsed.id, currentSubgraph);
      }
    }
  }

  // Remove nodeDefs entries that conflict with subgraph IDs
  // (When a subgraph ID is used as an edge endpoint, ensureNode creates a regular node entry,
  //  but the subgraph should be represented as a subgraphGroup node instead)
  for (const sgId of subgraphLabels.keys()) {
    nodeDefs.delete(sgId);
  }

  // Layout: use mermaid.js layout if provided, otherwise fall back to autoLayout
  let positions: Map<string, { x: number; y: number }>;
  let backEdges: Set<string> = new Set<string>();
  const sizeMap = new Map<string, { width: number; height: number }>();

  if (layout) {
    // Use mermaid.js layout result
    positions = new Map<string, { x: number; y: number }>();
    backEdges = new Set<string>();

    for (const [id, def] of nodeDefs) {
      const mNode = layout.nodes.get(id);
      if (mNode) {
        // mermaid.js returns center coordinates; convert to top-left
        positions.set(id, {
          x: mNode.x - mNode.width / 2,
          y: mNode.y - mNode.height / 2,
        });
        sizeMap.set(id, { width: mNode.width, height: mNode.height });
      } else {
        const size = getNodeSize(def.shape);
        positions.set(id, { x: 0, y: 0 });
        sizeMap.set(id, size);
      }
    }
  } else {
    // Fall back to autoLayout
    const nodeIds = [...nodeDefs.keys()].map((id) => ({ id }));
    for (const [id, def] of nodeDefs) {
      sizeMap.set(id, getNodeSize(def.shape));
    }
    const layoutResult = autoLayout(nodeIds, edgeList, direction, sizeMap);
    positions = layoutResult.positions;
    backEdges = layoutResult.backEdges;
  }

  // Build FlowNode[]
  const nodes: FlowNode[] = [];
  let maxCounter = 0;

  for (const [id, def] of nodeDefs) {
    const pos = positions.get(id) ?? { x: 0, y: 0 };
    const size = sizeMap.get(id) ?? getNodeSize(def.shape);

    // Track highest alphabetic ID counter
    if (/^[A-Z]+$/.test(id)) {
      const counter = idToCounter(id);
      if (counter + 1 > maxCounter) maxCounter = counter + 1;
    }

    nodes.push({
      id,
      type: def.shape,
      position: pos,
      data: { label: def.label, shape: def.shape },
      style: { width: size.width, height: size.height },
    });
  }

  // Handle directions: forward edges follow main axis, back-edges loop via cross axis
  const fwdSourceHandle = direction === "LR" ? "right-source" : "bottom-source";
  const fwdTargetHandle = direction === "LR" ? "left-target" : "top-target";
  const backSourceHandle = direction === "LR" ? "bottom-source" : "right-source";
  const backTargetHandle = direction === "LR" ? "bottom-target" : "right-target";

  // Build FlowEdge[]
  const edges: FlowEdge[] = [];
  for (const e of edgeList) {
    const isBack = backEdges.has(`${e.source}->${e.target}`);
    const sh = isBack ? backSourceHandle : fwdSourceHandle;
    const th = isBack ? backTargetHandle : fwdTargetHandle;
    const edgeId = `${e.source}-${e.target}-${sh}-${th}`;
    edges.push({
      id: edgeId,
      source: e.source,
      target: e.target,
      sourceHandle: sh,
      targetHandle: th,
      type: "labeled",
      markerEnd: { type: MarkerType.ArrowClosed },
      data: {
        label: e.label,
        edgeType: edgeType ?? "bezier",
        markerEnd: "arrowclosed",
      },
    });
  }

  // Convert subgraphs to subgraphGroup nodes with child parentId relationships
  // Two-pass approach:
  //   Pass 1 (innermost first): Create subgraphGroup nodes with absolute positions, record sizes
  //   Pass 2 (outermost first): Convert positions to relative coordinates

  // Store absolute positions and sizes of each subgraph
  const sgAbsPositions = new Map<string, { x: number; y: number }>();
  const sgSizes = new Map<string, { width: number; height: number }>();

  // Build processing order: innermost first (post-order DFS)
  // Post-order ensures children are pushed before parents → innermost first without reversing
  const sgProcessOrder: string[] = [];
  const sgProcessed = new Set<string>();
  const enqueueSg = (sgId: string) => {
    if (sgProcessed.has(sgId)) return;
    sgProcessed.add(sgId);
    // Recurse into children first
    for (const [nestedSgId, parentSgId] of subgraphParentMap) {
      if (parentSgId === sgId) enqueueSg(nestedSgId);
    }
    // Push self after children (post-order: innermost first)
    sgProcessOrder.push(sgId);
  };
  // Start from root subgraphs (those without parents)
  for (const sgId of subgraphLabels.keys()) {
    if (!subgraphParentMap.has(sgId)) enqueueSg(sgId);
  }
  // Also process any orphan subgraphs
  for (const sgId of subgraphLabels.keys()) enqueueSg(sgId);

  // Pass 1: Create subgraphGroup nodes with absolute positions (innermost first)
  for (const sgId of sgProcessOrder) {
    const sgLabel = subgraphLabels.get(sgId)!;

    // Collect direct child node IDs for this subgraph
    const childNodeIds = new Set<string>();
    for (const [nodeId, parentSgId] of nodeToSubgraph) {
      if (parentSgId === sgId) childNodeIds.add(nodeId);
    }

    // Get direct child nodes (regular nodes only)
    const childNodes = nodes.filter((n) => childNodeIds.has(n.id));

    // Also include nested subgraph group nodes whose parent is this subgraph
    const nestedSgIds: string[] = [];
    for (const [nestedSgId, parentSgId] of subgraphParentMap) {
      if (parentSgId === sgId) nestedSgIds.push(nestedSgId);
    }

    // Compute absolute position and size of this subgraph
    let sgAbsPos: { x: number; y: number };
    let sgSize: { width: number; height: number };

    const sgLayout = layout?.subgraphs.get(sgId);
    if (sgLayout) {
      sgAbsPos = { x: sgLayout.x, y: sgLayout.y };
      sgSize = { width: sgLayout.width, height: sgLayout.height };
    } else {
      // Compute bounding box from child positions (all absolute at this point)
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      // Include regular child nodes
      for (const child of childNodes) {
        const w = (child.style as Record<string, number>)?.width ?? DEFAULT_NODE_WIDTH;
        const h = (child.style as Record<string, number>)?.height ?? DEFAULT_NODE_HEIGHT;
        if (child.position.x < minX) minX = child.position.x;
        if (child.position.y < minY) minY = child.position.y;
        if (child.position.x + w > maxX) maxX = child.position.x + w;
        if (child.position.y + h > maxY) maxY = child.position.y + h;
      }
      // Include nested subgraph groups (already created in nodes by innermost-first order)
      for (const nestedSgId of nestedSgIds) {
        const nestedAbsPos = sgAbsPositions.get(nestedSgId);
        const nestedSize = sgSizes.get(nestedSgId);
        if (nestedAbsPos && nestedSize) {
          if (nestedAbsPos.x < minX) minX = nestedAbsPos.x;
          if (nestedAbsPos.y < minY) minY = nestedAbsPos.y;
          if (nestedAbsPos.x + nestedSize.width > maxX) maxX = nestedAbsPos.x + nestedSize.width;
          if (nestedAbsPos.y + nestedSize.height > maxY) maxY = nestedAbsPos.y + nestedSize.height;
        }
      }

      if (minX === Infinity) {
        sgAbsPos = { x: 0, y: 0 };
        sgSize = { width: 200, height: 100 };
      } else {
        sgAbsPos = {
          x: minX - SUBGRAPH_PADDING_X,
          y: minY - SUBGRAPH_PADDING_Y_TOP,
        };
        sgSize = {
          width: (maxX - minX) + SUBGRAPH_PADDING_X * 2,
          height: (maxY - minY) + SUBGRAPH_PADDING_Y_TOP + SUBGRAPH_PADDING_Y_BOTTOM,
        };
      }
    }

    sgAbsPositions.set(sgId, sgAbsPos);
    sgSizes.set(sgId, sgSize);

    // Create subgraphGroup node with absolute position (will be converted to relative in Pass 2)
    const parentSgId = subgraphParentMap.get(sgId);
    const sgNode: FlowNode = {
      id: sgId,
      type: "subgraphGroup",
      position: { ...sgAbsPos }, // absolute; converted to relative in Pass 2
      data: { label: sgLabel, shape: "rectangle" as NodeShape, isSubgraphGroup: true },
      style: { width: sgSize.width, height: sgSize.height },
      zIndex: -1,
    };

    if (parentSgId) {
      sgNode.parentId = parentSgId;
      sgNode.data.subgraphParentId = parentSgId;
    }

    nodes.push(sgNode);

    // Set parentId and subgraphParentId on child nodes (positions stay absolute for now)
    for (const child of childNodes) {
      child.parentId = sgId;
      child.data = { ...child.data, subgraphParentId: sgId };
    }
  }

  // Pass 2: Convert all positions from absolute to relative (outermost first)
  // Process outermost first so that when we convert a child's position,
  // we subtract the parent's absolute position (not yet modified)
  const sgOutermostFirst = [...sgProcessOrder].reverse();
  for (const sgId of sgOutermostFirst) {
    const sgAbsPos = sgAbsPositions.get(sgId)!;

    // Convert this subgraphGroup node's position to relative (if nested)
    const parentSgId = subgraphParentMap.get(sgId);
    if (parentSgId) {
      const parentAbsPos = sgAbsPositions.get(parentSgId)!;
      const sgNode = nodes.find((n) => n.id === sgId);
      if (sgNode) {
        sgNode.position = {
          x: sgAbsPos.x - parentAbsPos.x,
          y: sgAbsPos.y - parentAbsPos.y,
        };
      }
    }

    // Convert direct child nodes' positions to relative to this subgraph
    for (const [nodeId, parentSg] of nodeToSubgraph) {
      if (parentSg !== sgId) continue;
      const child = nodes.find((n) => n.id === nodeId);
      if (child) {
        child.position = {
          x: child.position.x - sgAbsPos.x,
          y: child.position.y - sgAbsPos.y,
        };
      }
    }
  }

  // Sort nodes so parents come before children (React Flow requires this for parentId)
  sortNodesParentFirst(nodes);

  return {
    nodes,
    edges,
    direction,
    nextIdCounter: maxCounter,
    componentDefinitions: [],
  };
}
