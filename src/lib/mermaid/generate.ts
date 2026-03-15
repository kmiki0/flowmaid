import type { FlowNode, FlowEdge } from "@/store/types";
import type { FlowDirection, ComponentDefinition } from "@/types/flow";
import { nodeToMermaid } from "./nodeToMermaid";
import { escapeMermaid } from "./nodeToMermaid";
import { edgeToMermaid } from "./edgeToMermaid";

/**
 * Generate complete Mermaid flowchart syntax from nodes, edges, and direction
 */
export function generateMermaid(
  nodes: FlowNode[],
  edges: FlowEdge[],
  direction: FlowDirection,
  definitions?: ComponentDefinition[]
): string {
  const lines: string[] = [`graph ${direction}`];

  // Build map of component instance IDs to their child nodes
  const instanceChildMap = new Map<string, FlowNode[]>();
  const childNodeIds = new Set<string>();
  for (const node of nodes) {
    if (node.data.componentParentId) {
      const parentId = node.data.componentParentId as string;
      if (!instanceChildMap.has(parentId)) instanceChildMap.set(parentId, []);
      instanceChildMap.get(parentId)!.push(node);
      childNodeIds.add(node.id);
    }
  }

  for (const node of nodes) {
    if (node.data.shape === "text") continue;
    // Skip component children (they're handled within their parent's subgraph)
    if (node.data.componentParentId) continue;

    // Component instance: expand as subgraph using definition (including Start/End)
    if (node.type === "componentInstance" && node.data.componentDefinitionId) {
      const instanceLabel = escapeMermaid(node.data.componentInstanceName as string ?? node.data.label);
      lines.push(`    subgraph ${node.id}[${instanceLabel}]`);

      // Get definition to include all nodes (including entry/exit which are excluded from canvas)
      const def = definitions?.find((d) => d.id === node.data.componentDefinitionId);
      if (def) {
        // Output all nodes from definition (including Start/End)
        for (const defNode of def.nodes) {
          const childId = `${node.id}_${defNode.id}`;
          const label = escapeMermaid(defNode.label);
          const shape = defNode.shape;
          let nodeLine: string;
          switch (shape) {
            case "diamond":
              nodeLine = `    ${childId}{${label}}`;
              break;
            case "roundedRect":
              nodeLine = `    ${childId}(${label})`;
              break;
            case "circle":
              nodeLine = `    ${childId}((${label}))`;
              break;
            case "stadium":
              nodeLine = `    ${childId}([${label}])`;
              break;
            default:
              nodeLine = `    ${childId}[${label}]`;
          }
          lines.push(nodeLine);
        }

        // Output all internal edges from definition (including Start/End edges)
        for (const defEdge of def.edges) {
          const srcId = `${node.id}_${defEdge.source}`;
          const tgtId = `${node.id}_${defEdge.target}`;
          const label = defEdge.label;
          if (label) {
            lines.push(`    ${srcId} -->|${escapeMermaid(label)}| ${tgtId}`);
          } else {
            lines.push(`    ${srcId} --> ${tgtId}`);
          }
        }
      } else {
        // Fallback: use actual child nodes if definition not found
        const children = instanceChildMap.get(node.id) ?? [];
        for (const child of children) {
          const label = escapeMermaid(child.data.label);
          const shape = child.data.shape;
          let nodeLine: string;
          switch (shape) {
            case "diamond":
              nodeLine = `    ${child.id}{${label}}`;
              break;
            case "roundedRect":
              nodeLine = `    ${child.id}(${label})`;
              break;
            case "circle":
              nodeLine = `    ${child.id}((${label}))`;
              break;
            case "stadium":
              nodeLine = `    ${child.id}([${label}])`;
              break;
            default:
              nodeLine = `    ${child.id}[${label}]`;
          }
          lines.push(nodeLine);
        }

        for (const edge of edges) {
          if (childNodeIds.has(edge.source) && childNodeIds.has(edge.target)) {
            const srcNode = nodes.find((n) => n.id === edge.source);
            const tgtNode = nodes.find((n) => n.id === edge.target);
            if (srcNode?.data.componentParentId === node.id && tgtNode?.data.componentParentId === node.id) {
              const label = edge.data?.label;
              if (label) {
                lines.push(`    ${edge.source} -->|${escapeMermaid(label)}| ${edge.target}`);
              } else {
                lines.push(`    ${edge.source} --> ${edge.target}`);
              }
            }
          }
        }
      }

      lines.push(`    end`);
      continue;
    }

    lines.push(nodeToMermaid(node));
  }

  for (const edge of edges) {
    // Skip bridge edges
    if (edge.data?.isBridgeEdge) continue;
    // Skip internal edges (already handled in subgraph)
    if (childNodeIds.has(edge.source) && childNodeIds.has(edge.target)) continue;

    // For edges connected to component instances, remap to entry/exit child nodes
    if (definitions) {
      let source = edge.source;
      let target = edge.target;

      const sourceNode = nodes.find((n) => n.id === source);
      const targetNode = nodes.find((n) => n.id === target);

      if (sourceNode?.type === "componentInstance" && sourceNode.data.componentDefinitionId) {
        const def = definitions.find((d) => d.id === sourceNode.data.componentDefinitionId);
        if (def?.exitNodeId) {
          source = `${sourceNode.id}_${def.exitNodeId}`;
        }
      }
      if (targetNode?.type === "componentInstance" && targetNode.data.componentDefinitionId) {
        const def = definitions.find((d) => d.id === targetNode.data.componentDefinitionId);
        if (def?.entryNodeId) {
          target = `${targetNode.id}_${def.entryNodeId}`;
        }
      }

      if (source !== edge.source || target !== edge.target) {
        const label = edge.data?.label;
        if (label) {
          lines.push(`    ${source} -->|${escapeMermaid(label)}| ${target}`);
        } else {
          lines.push(`    ${source} --> ${target}`);
        }
        continue;
      }
    }

    lines.push(edgeToMermaid(edge));
  }

  return lines.join("\n");
}
