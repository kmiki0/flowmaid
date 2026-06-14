import { useMemo } from "react";
import { useFlowStore } from "@/store/useFlowStore";
import { GLOBAL_SEARCH_MAX_RESULTS, GHOST_NODE_ID } from "@/lib/constants";
import type { FlowNode, FlowEdge } from "@/store/types";

export interface SearchResult {
  kind: "node" | "edge";
  id: string;
  displayLabel: string;
  subLabel?: string;
  isComponent?: boolean;
  nodeData?: FlowNode["data"];
  edgeData?: FlowEdge["data"];
}

function matchesAnyField(fields: string[], lowerTerms: string[]): boolean {
  // AND条件: 全語がいずれかのフィールドに含まれる
  return lowerTerms.every((term) =>
    fields.some((f) => f.toLowerCase().includes(term))
  );
}

export function useGlobalSearch(query: string): { results: SearchResult[]; total: number } {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);

  return useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return { results: [], total: 0 };

    const terms = trimmed.toLowerCase().split(/\s+/);
    const all: SearchResult[] = [];

    // Search nodes
    for (const node of nodes) {
      // Exclude ghosts, component children, locked nodes
      if (node.id.startsWith(GHOST_NODE_ID)) continue;
      if (node.data.componentParentId) continue;
      if (node.data.isLocked) continue;

      const label = node.data.componentInstanceName || node.data.label || "";
      const fields = [node.id, label];
      if (node.data.componentInstanceName && node.data.label) {
        fields.push(node.data.label);
      }

      if (matchesAnyField(fields, terms)) {
        all.push({
          kind: "node",
          id: node.id,
          displayLabel: label,
          isComponent: node.type === "componentInstance",
          nodeData: node.data,
        });
      }
    }

    // Search edges
    for (const edge of edges) {
      if (edge.data?.isBridgeEdge) continue;
      if (edge.source.startsWith(GHOST_NODE_ID)) continue;

      const label = edge.data?.label || "";
      const route = `${edge.source}→${edge.target}`;
      const fields = [label, route, edge.id];

      if (matchesAnyField(fields, terms)) {
        all.push({
          kind: "edge",
          id: edge.id,
          displayLabel: label || route,
          subLabel: label ? route : undefined,
          edgeData: edge.data,
        });
      }
    }

    return {
      results: all.slice(0, GLOBAL_SEARCH_MAX_RESULTS),
      total: all.length,
    };
  }, [query, nodes, edges]);
}
