import type { NodeEditorNode, NodeEditorEdge } from "../store/types";
import type { Cardinality } from "../types";

/**
 * Convert cardinality to Mermaid erDiagram relationship notation.
 * Left side = source, Right side = target
 */
function cardinalityToMermaid(cardinality?: Cardinality): string {
  switch (cardinality) {
    case "1:1":
      return "||--||";
    case "1:N":
      return "||--o{";
    case "N:M":
      return "}o--o{";
    case "0:1":
      return "|o--o|";
    case "0:N":
      return "|o--o{";
    default:
      return "||--||"; // default to 1:1
  }
}

/**
 * Generate Mermaid erDiagram text from node editor state.
 * Only includes table-kind nodes.
 */
export function generateErDiagram(
  nodes: NodeEditorNode[],
  edges: NodeEditorEdge[]
): string {
  const tableNodes = nodes.filter((n) => n.data.kind === "table");
  if (tableNodes.length === 0) return "";

  const lines: string[] = ["erDiagram"];

  // Table definitions
  for (const node of tableNodes) {
    lines.push(`    ${node.data.label} {`);

    for (const port of node.data.ports) {
      const parts: string[] = [];
      // Data type (default to "VARCHAR" if not specified)
      parts.push(port.dataType || "VARCHAR");
      // Column name
      parts.push(port.name);
      // Constraints
      if (port.isPrimaryKey) parts.push("PK");
      else if (port.isForeignKey) parts.push("FK");
      if (port.isNotNull && !port.isPrimaryKey) parts.push(`"NOT NULL"`);
      if (port.isUnique && !port.isPrimaryKey) parts.push(`"UNIQUE"`);

      lines.push(`        ${parts.join(" ")}`);
    }

    lines.push("    }");
  }

  // Relationships (only between table nodes)
  const tableIds = new Set(tableNodes.map((n) => n.id));
  for (const edge of edges) {
    if (!tableIds.has(edge.source) || !tableIds.has(edge.target)) continue;

    const sourceNode = tableNodes.find((n) => n.id === edge.source);
    const targetNode = tableNodes.find((n) => n.id === edge.target);
    if (!sourceNode || !targetNode) continue;

    const rel = cardinalityToMermaid(edge.data?.cardinality);
    const label = edge.data?.relationLabel || "";
    lines.push(`    ${sourceNode.data.label} ${rel} ${targetNode.data.label} : "${label}"`);
  }

  return lines.join("\n");
}
