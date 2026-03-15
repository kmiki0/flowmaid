import type { FlowEdge } from "@/store/types";
import { escapeMermaid } from "./nodeToMermaid";

/**
 * Convert an edge to Mermaid syntax
 */
export function edgeToMermaid(edge: FlowEdge): string {
  const { source, target } = edge;
  const label = edge.data?.label?.trim();

  if (label) {
    return `    ${source} -->|${escapeMermaid(label)}| ${target}`;
  }
  return `    ${source} --> ${target}`;
}
