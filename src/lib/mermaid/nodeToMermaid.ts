import type { FlowNode } from "@/store/types";

/**
 * Escape special characters for Mermaid syntax using #<charcode>; format
 */
export function escapeMermaid(text: string): string {
  return text
    .replace(/&/g, "#amp;")
    .replace(/"/g, "#quot;")
    .replace(/</g, "#lt;")
    .replace(/>/g, "#gt;")
    .replace(/{/g, "#lbrace;")
    .replace(/}/g, "#rbrace;")
    .replace(/\(/g, "#lpar;")
    .replace(/\)/g, "#rpar;")
    .replace(/\[/g, "#lbrack;")
    .replace(/]/g, "#rbrack;");
}

/**
 * Convert a node to Mermaid syntax based on shape
 */
export function nodeToMermaid(node: FlowNode): string {
  const id = node.id;
  const label = escapeMermaid(node.data.label);
  const shape = node.data.shape;

  switch (shape) {
    case "rectangle":
      return `    ${id}[${label}]`;
    case "diamond":
      return `    ${id}{${label}}`;
    case "roundedRect":
      return `    ${id}(${label})`;
    case "circle":
      return `    ${id}((${label}))`;
    case "parallelogram":
      return `    ${id}[/${label}/]`;
    case "cylinder":
      return `    ${id}[(${label})]`;
    case "hexagon":
      return `    ${id}{{${label}}}`;
    case "stadium":
      return `    ${id}([${label}])`;
    case "trapezoid":
      return `    ${id}[\\${label}\\]`;
    case "document":
      return `    ${id}[/${label}\\]`;
    case "predefinedProcess":
      return `    ${id}[[${label}]]`;
    case "manualInput":
      return `    ${id}[\\${label}/]`;
    case "internalStorage":
      return `    ${id}[${label}]`;
    case "display":
      return `    ${id}(${label})`;
    default:
      return `    ${id}[${label}]`;
  }
}
