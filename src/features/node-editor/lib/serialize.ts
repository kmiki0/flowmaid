import type { NodeEditorNode, NodeEditorEdge } from "../store/types";
import type { NodeEditorSubMode } from "../types";

interface NodeEditorSaveData {
  version: number;
  subMode: NodeEditorSubMode;
  nodes: NodeEditorNode[];
  edges: NodeEditorEdge[];
}

export function serializeNodeEditor(
  nodes: NodeEditorNode[],
  edges: NodeEditorEdge[],
  subMode: NodeEditorSubMode
): string {
  const data: NodeEditorSaveData = {
    version: 1,
    subMode,
    nodes: nodes.map((n) => ({
      ...n,
      data: { ...n.data, isNew: undefined, isDeleting: undefined },
      selected: undefined,
    })),
    edges: edges.map((e) => ({
      ...e,
      selected: undefined,
    })),
  };
  return JSON.stringify(data, null, 2);
}

export function deserializeNodeEditor(content: string): {
  nodes: NodeEditorNode[];
  edges: NodeEditorEdge[];
  subMode?: NodeEditorSubMode;
  nextIdCounter?: number;
} {
  const data = JSON.parse(content) as NodeEditorSaveData;

  // Compute nextIdCounter from node IDs
  let maxCounter = 0;
  for (const n of data.nodes) {
    let counter = 0;
    for (let i = 0; i < n.id.length; i++) {
      counter = counter * 26 + (n.id.charCodeAt(i) - 64);
    }
    maxCounter = Math.max(maxCounter, counter);
  }

  return {
    nodes: data.nodes,
    edges: data.edges,
    subMode: data.subMode,
    nextIdCounter: maxCounter,
  };
}
