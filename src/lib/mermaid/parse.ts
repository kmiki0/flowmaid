import type { FlowNode, FlowEdge } from "@/store/types";
import type { FlowDirection, NodeShape, ComponentDefinition, ComponentInternalNode, ComponentInternalEdge } from "@/types/flow";
import { MarkerType } from "@xyflow/react";
import {
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_HEIGHT,
  DEFAULT_DIAMOND_SIZE,
} from "@/lib/constants";
import { autoLayout } from "./autoLayout";

/**
 * Reverse of escapeMermaid: convert Mermaid escape sequences back to original characters.
 */
export function unescapeMermaid(text: string): string {
  return text
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
const ARROW_RE = /\s*-->\s*(?:\|([^|]*)\|)?\s*/;

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

export function parseMermaid(text: string, edgeType?: import("@/types/flow").EdgeType): {
  nodes: FlowNode[];
  edges: FlowEdge[];
  direction: FlowDirection;
  nextIdCounter: number;
  componentDefinitions?: ComponentDefinition[];
} {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) throw new Error("Empty input");

  // Parse direction from first line
  const headerMatch = lines[0].match(/^graph\s+(TD|LR|TB|BT)$/i);
  if (!headerMatch) throw new Error("Invalid header: expected 'graph TD|LR|TB|BT'");

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

  // Track subgraph contexts for component definition creation
  const subgraphStack: { id: string; label: string }[] = [];
  const subgraphNodes = new Map<string, ComponentInternalNode[]>();
  const subgraphEdges = new Map<string, ComponentInternalEdge[]>();
  const subgraphLabels = new Map<string, string>();
  const nodeToSubgraph = new Map<string, string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Check for subgraph start
    const subgraphMatch = line.match(/^subgraph\s+(\S+?)(?:\[([^\]]*)\])?\s*$/);
    if (subgraphMatch) {
      const sgId = subgraphMatch[1];
      const sgLabel = subgraphMatch[2] ? unescapeMermaid(subgraphMatch[2]) : sgId;
      subgraphStack.push({ id: sgId, label: sgLabel });
      subgraphLabels.set(sgId, sgLabel);
      subgraphNodes.set(sgId, []);
      subgraphEdges.set(sgId, []);
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
        const edgeEntry = {
          source: resolvedIds[j],
          target: resolvedIds[j + 1],
          label: labels[j] ?? "",
        };
        edgeList.push(edgeEntry);

        // If both in same subgraph, also add to subgraph edges
        if (currentSubgraph) {
          const sgEdges = subgraphEdges.get(currentSubgraph);
          if (sgEdges) {
            sgEdges.push({
              id: `e${sgEdges.length}`,
              source: resolvedIds[j],
              target: resolvedIds[j + 1],
              label: labels[j] || undefined,
            });
          }
        }
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

  // Build subgraph internal node lists
  for (const [nodeId, sgId] of nodeToSubgraph) {
    const sgNodes = subgraphNodes.get(sgId);
    const def = nodeDefs.get(nodeId);
    if (sgNodes && def) {
      sgNodes.push({
        id: nodeId,
        label: def.label,
        shape: def.shape,
        position: { x: 50, y: sgNodes.length * 80 },
      });
    }
  }

  // Auto-layout
  const nodeIds = [...nodeDefs.keys()].map((id) => ({ id }));
  const sizeMap = new Map<string, { width: number; height: number }>();
  for (const [id, def] of nodeDefs) {
    sizeMap.set(id, getNodeSize(def.shape));
  }
  const { positions, backEdges } = autoLayout(nodeIds, edgeList, direction, sizeMap);

  // Build FlowNode[]
  const nodes: FlowNode[] = [];
  let maxCounter = 0;

  for (const [id, def] of nodeDefs) {
    const pos = positions.get(id) ?? { x: 0, y: 0 };
    const size = getNodeSize(def.shape);

    // Track highest alphabetic ID counter
    if (/^[A-Z]+$/.test(id)) {
      let counter = 0;
      for (let c = 0; c < id.length; c++) {
        counter = counter * 26 + (id.charCodeAt(c) - 64);
      }
      counter -= 1;
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

  // Build component definitions and replace subgraph nodes with instances
  const componentDefs: ComponentDefinition[] = [];
  for (const [sgId, sgLabel] of subgraphLabels) {
    const sgNodes = subgraphNodes.get(sgId) ?? [];
    const sgEdges = subgraphEdges.get(sgId) ?? [];
    if (sgNodes.length === 0) continue;

    const defId = `comp_parse_${sgId}`;
    componentDefs.push({
      id: defId,
      name: sgLabel,
      version: 1,
      nodes: sgNodes,
      edges: sgEdges,
      entryNodeId: sgNodes[0]?.id ?? null,
      exitNodeId: sgNodes[sgNodes.length - 1]?.id ?? null,
    });

    // Remove subgraph children from top-level nodes
    const childIds = new Set(sgNodes.map((n) => n.id));
    const remaining = nodes.filter((n) => !childIds.has(n.id));

    // Compute center position of removed nodes
    const childPositions = nodes.filter((n) => childIds.has(n.id));
    const avgX = childPositions.length > 0
      ? childPositions.reduce((sum, n) => sum + n.position.x, 0) / childPositions.length
      : 250;
    const avgY = childPositions.length > 0
      ? childPositions.reduce((sum, n) => sum + n.position.y, 0) / childPositions.length
      : 150;

    // Create instance node
    const instanceId = sgId;
    remaining.push({
      id: instanceId,
      type: "componentInstance",
      position: { x: avgX - 100, y: avgY - 50 },
      data: {
        label: sgLabel,
        shape: "rectangle" as NodeShape,
        componentDefinitionId: defId,
        componentInstanceName: sgLabel,
        componentSyncVersion: 1,
        collapsed: false,
      },
      style: { width: Math.max(200, sgNodes.length * 80), height: Math.max(100, sgNodes.length * 60) },
    });

    // Update edges: remap child node references to instance node
    nodes.length = 0;
    nodes.push(...remaining);

    // Remap edges from child nodes to instance
    for (let ei = edges.length - 1; ei >= 0; ei--) {
      const e = edges[ei];
      const srcInChild = childIds.has(e.source);
      const tgtInChild = childIds.has(e.target);
      if (srcInChild && tgtInChild) {
        // Internal edge - remove from top-level
        edges.splice(ei, 1);
      } else if (srcInChild) {
        edges[ei] = { ...e, source: instanceId, id: `${instanceId}-${e.target}-${e.sourceHandle ?? "d"}-${e.targetHandle ?? "d"}` };
      } else if (tgtInChild) {
        edges[ei] = { ...e, target: instanceId, id: `${e.source}-${instanceId}-${e.sourceHandle ?? "d"}-${e.targetHandle ?? "d"}` };
      }
    }
  }

  return {
    nodes,
    edges,
    direction,
    nextIdCounter: maxCounter,
    componentDefinitions: componentDefs.length > 0 ? componentDefs : undefined,
  };
}
