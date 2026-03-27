import type { FlowmaidLayout } from "@/lib/flowmaid/schema";
import type { ComponentDefinition } from "@/types/flow";
import type { DiffResult, NodeDiff, EdgeDiff, ComponentDefDiff } from "./types";

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;
  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }
  return true;
}

function computeNodeDiffs(base: FlowmaidLayout, compare: FlowmaidLayout): NodeDiff[] {
  const diffs: NodeDiff[] = [];
  const baseNodes = base.nodes;
  const compareNodes = compare.nodes;

  const allIds = new Set([...Object.keys(baseNodes), ...Object.keys(compareNodes)]);

  for (const id of allIds) {
    const baseNode = baseNodes[id];
    const compareNode = compareNodes[id];

    if (!baseNode) {
      diffs.push({ kind: "added", nodeId: id, compareNode, changedFields: [] });
      continue;
    }
    if (!compareNode) {
      diffs.push({ kind: "deleted", nodeId: id, baseNode, changedFields: [] });
      continue;
    }

    // Detect all field changes
    const changedFields: string[] = [];
    if (baseNode.label !== compareNode.label) changedFields.push("label");
    if (baseNode.shape !== compareNode.shape) changedFields.push("shape");
    if (baseNode.fillColor !== compareNode.fillColor) changedFields.push("fillColor");
    if (baseNode.borderColor !== compareNode.borderColor) changedFields.push("borderColor");
    if (baseNode.borderWidth !== compareNode.borderWidth) changedFields.push("borderWidth");
    if (baseNode.borderStyle !== compareNode.borderStyle) changedFields.push("borderStyle");
    if (baseNode.fontSize !== compareNode.fontSize) changedFields.push("fontSize");
    if (baseNode.textColor !== compareNode.textColor) changedFields.push("textColor");
    if (baseNode.textAlign !== compareNode.textAlign) changedFields.push("textAlign");
    if (baseNode.bold !== compareNode.bold) changedFields.push("bold");
    if (baseNode.italic !== compareNode.italic) changedFields.push("italic");
    if (baseNode.underline !== compareNode.underline) changedFields.push("underline");
    if (baseNode.fillOpacity !== compareNode.fillOpacity) changedFields.push("fillOpacity");
    if (baseNode.fillLightness !== compareNode.fillLightness) changedFields.push("fillLightness");
    if (baseNode.borderOpacity !== compareNode.borderOpacity) changedFields.push("borderOpacity");
    if (baseNode.borderLightness !== compareNode.borderLightness) changedFields.push("borderLightness");
    if (baseNode.textOpacity !== compareNode.textOpacity) changedFields.push("textOpacity");
    if (baseNode.textLightness !== compareNode.textLightness) changedFields.push("textLightness");
    if (!deepEqual(baseNode.position, compareNode.position)) changedFields.push("position");
    if (!deepEqual(baseNode.size, compareNode.size)) changedFields.push("size");
    if (baseNode.zIndex !== compareNode.zIndex) changedFields.push("zIndex");

    if (changedFields.length === 0) {
      diffs.push({ kind: "unchanged", nodeId: id, baseNode, compareNode, changedFields: [] });
    } else {
      diffs.push({ kind: "modified", nodeId: id, baseNode, compareNode, changedFields });
    }
  }

  return diffs;
}

function computeEdgeDiffs(base: FlowmaidLayout, compare: FlowmaidLayout): EdgeDiff[] {
  const diffs: EdgeDiff[] = [];
  const baseEdges = base.edges;
  const compareEdges = compare.edges;

  const allKeys = new Set([...Object.keys(baseEdges), ...Object.keys(compareEdges)]);

  for (const key of allKeys) {
    const baseEdge = baseEdges[key];
    const compareEdge = compareEdges[key];

    if (!baseEdge) {
      diffs.push({ kind: "added", edgeKey: key, compareEdge, changedFields: [] });
      continue;
    }
    if (!compareEdge) {
      diffs.push({ kind: "deleted", edgeKey: key, baseEdge, changedFields: [] });
      continue;
    }

    // Edges: detect added/deleted only, no modification detection
    diffs.push({ kind: "unchanged", edgeKey: key, baseEdge, compareEdge, changedFields: [] });
  }

  return diffs;
}

function computeComponentDefDiffs(
  baseDefs: ComponentDefinition[],
  compareDefs: ComponentDefinition[]
): ComponentDefDiff[] {
  const diffs: ComponentDefDiff[] = [];
  const baseMap = new Map(baseDefs.map((d) => [d.id, d]));
  const compareMap = new Map(compareDefs.map((d) => [d.id, d]));

  const allIds = new Set([...baseMap.keys(), ...compareMap.keys()]);

  for (const id of allIds) {
    const baseDef = baseMap.get(id);
    const compareDef = compareMap.get(id);

    if (!baseDef) {
      diffs.push({ kind: "added", defId: id, compareDef, changedFields: [] });
      continue;
    }
    if (!compareDef) {
      diffs.push({ kind: "deleted", defId: id, baseDef, changedFields: [] });
      continue;
    }

    const changedFields: string[] = [];
    if (baseDef.name !== compareDef.name) changedFields.push("name");
    if (baseDef.entryNodeId !== compareDef.entryNodeId) changedFields.push("entryNodeId");
    if (baseDef.exitNodeId !== compareDef.exitNodeId) changedFields.push("exitNodeId");
    if (!deepEqual(baseDef.nodes, compareDef.nodes)) changedFields.push("nodes");
    if (!deepEqual(baseDef.edges, compareDef.edges)) changedFields.push("edges");
    if (baseDef.direction !== compareDef.direction) changedFields.push("direction");

    if (changedFields.length === 0) {
      diffs.push({ kind: "unchanged", defId: id, baseDef, compareDef, changedFields: [] });
    } else {
      diffs.push({ kind: "modified", defId: id, baseDef, compareDef, changedFields });
    }
  }

  return diffs;
}

/**
 * Compute differences between two .flowmaid layouts.
 * Pure function — no side effects or external state dependencies.
 */
export function computeDiff(base: FlowmaidLayout, compare: FlowmaidLayout): DiffResult {
  return {
    nodeDiffs: computeNodeDiffs(base, compare),
    edgeDiffs: computeEdgeDiffs(base, compare),
    componentDefDiffs: computeComponentDefDiffs(
      base.componentDefinitions ?? [],
      compare.componentDefinitions ?? []
    ),
  };
}
