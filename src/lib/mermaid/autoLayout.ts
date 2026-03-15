import type { FlowDirection } from "@/types/flow";

const LAYER_SPACING = 80; // gap between node edges
const NODE_GAP = 200;     // gap between nodes in the same layer

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>;
  backEdges: Set<string>; // edge keys "source->target" that are back-edges
}

export function autoLayout(
  nodes: { id: string }[],
  edges: { source: string; target: string }[],
  direction: FlowDirection,
  sizes?: Map<string, { width: number; height: number }>
): LayoutResult {
  const ids = nodes.map((n) => n.id);
  const idSet = new Set(ids);

  // Build adjacency list and in-degree
  const adj = new Map<string, string[]>();
  const inDeg = new Map<string, number>();
  for (const id of ids) {
    adj.set(id, []);
    inDeg.set(id, 0);
  }
  for (const e of edges) {
    if (!idSet.has(e.source) || !idSet.has(e.target)) continue;
    adj.get(e.source)!.push(e.target);
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
  }

  // Kahn's algorithm with cycle-breaking
  const sorted: string[] = [];
  const visited = new Set<string>();
  const queue: string[] = [];

  for (const id of ids) {
    if (inDeg.get(id) === 0) queue.push(id);
  }

  while (sorted.length < ids.length) {
    if (queue.length === 0) {
      // Break cycle: pick unvisited node with smallest in-degree
      let best: string | null = null;
      let bestDeg = Infinity;
      for (const id of ids) {
        if (!visited.has(id) && (inDeg.get(id) ?? 0) < bestDeg) {
          best = id;
          bestDeg = inDeg.get(id) ?? 0;
        }
      }
      if (best) queue.push(best);
      else break;
    }

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visited.has(node)) continue;
      visited.add(node);
      sorted.push(node);
      for (const next of adj.get(node) ?? []) {
        if (visited.has(next)) continue;
        inDeg.set(next, (inDeg.get(next) ?? 0) - 1);
        if (inDeg.get(next) === 0) queue.push(next);
      }
    }
  }

  // Detect back-edges: edges where target comes before source in topo order
  const topoIndex = new Map<string, number>();
  for (let i = 0; i < sorted.length; i++) {
    topoIndex.set(sorted[i], i);
  }
  const backEdges = new Set<string>();
  for (const e of edges) {
    if (!idSet.has(e.source) || !idSet.has(e.target)) continue;
    if ((topoIndex.get(e.source) ?? 0) >= (topoIndex.get(e.target) ?? 0)) {
      backEdges.add(`${e.source}->${e.target}`);
    }
  }

  // Assign layers using only forward edges
  const layer = new Map<string, number>();
  for (const id of sorted) {
    layer.set(id, 0);
  }
  for (const id of sorted) {
    for (const next of adj.get(id) ?? []) {
      if (backEdges.has(`${id}->${next}`)) continue;
      const current = layer.get(next) ?? 0;
      const candidate = (layer.get(id) ?? 0) + 1;
      if (candidate > current) {
        layer.set(next, candidate);
      }
    }
  }

  // Group nodes by layer
  const layers = new Map<number, string[]>();
  for (const id of sorted) {
    const l = layer.get(id) ?? 0;
    if (!layers.has(l)) layers.set(l, []);
    layers.get(l)!.push(id);
  }

  // Helper to get node size along the main axis
  const defaultSize = { width: 150, height: 50 };
  function getSize(id: string) {
    return sizes?.get(id) ?? defaultSize;
  }

  // Compute max size in each layer along the main axis
  const maxLayer = Math.max(...layers.keys(), 0);
  const layerMaxMain = new Map<number, number>();
  for (let l = 0; l <= maxLayer; l++) {
    const nodesInLayer = layers.get(l) ?? [];
    let maxMain = 0;
    for (const id of nodesInLayer) {
      const s = getSize(id);
      const main = direction === "LR" ? s.width : s.height;
      if (main > maxMain) maxMain = main;
    }
    layerMaxMain.set(l, maxMain);
  }

  // Compute cumulative offset for each layer (position = sum of previous layers' sizes + gaps)
  const layerOffset = new Map<number, number>();
  let cumulative = 0;
  for (let l = 0; l <= maxLayer; l++) {
    layerOffset.set(l, cumulative);
    cumulative += (layerMaxMain.get(l) ?? 0) + LAYER_SPACING;
  }

  // Compute positions (center-aligned, then convert to top-left for React Flow)
  const positions = new Map<string, { x: number; y: number }>();

  for (let l = 0; l <= maxLayer; l++) {
    const nodesInLayer = layers.get(l) ?? [];
    const count = nodesInLayer.length;
    const layerCenter = layerOffset.get(l)! + (layerMaxMain.get(l) ?? 0) / 2;
    for (let i = 0; i < count; i++) {
      const crossCenter = (i - (count - 1) / 2) * NODE_GAP;
      const s = getSize(nodesInLayer[i]);
      if (direction === "LR") {
        positions.set(nodesInLayer[i], {
          x: layerCenter - s.width / 2,
          y: crossCenter - s.height / 2,
        });
      } else {
        positions.set(nodesInLayer[i], {
          x: crossCenter - s.width / 2,
          y: layerCenter - s.height / 2,
        });
      }
    }
  }

  return { positions, backEdges };
}
