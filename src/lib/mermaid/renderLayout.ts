/**
 * Render Mermaid text using mermaid.js and extract node/subgraph positions and sizes from the SVG output.
 */

export interface MermaidNodeLayout {
  id: string;
  x: number;       // center X
  y: number;       // center Y
  width: number;
  height: number;
}

export interface MermaidSubgraphLayout {
  id: string;
  x: number;       // top-left X
  y: number;       // top-left Y
  width: number;
  height: number;
}

export interface MermaidLayoutResult {
  nodes: Map<string, MermaidNodeLayout>;
  subgraphs: Map<string, MermaidSubgraphLayout>;
}

let renderCounter = 0;

/**
 * Strip mermaid's ID decorations to recover the original node/subgraph ID.
 * mermaid.js generates IDs like "flowchart-A-0" for node "A".
 */
function extractId(rawId: string): string {
  // Pattern: "flowchart-{id}-{number}" or just the id with prefix
  const match = rawId.match(/^flowchart-(.+?)-\d+$/);
  if (match) return match[1];
  // Fallback: return as-is
  return rawId;
}

/**
 * Get the absolute SVG coordinates of an element by walking the transform chain.
 * Accumulates all translate transforms from the element up to the SVG root.
 */
function getAbsoluteTranslate(el: SVGElement, svgRoot: SVGSVGElement): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let current: SVGElement | null = el;

  while (current && current !== svgRoot) {
    const transform = current.getAttribute("transform");
    if (transform) {
      const translateMatch = transform.match(/translate\(\s*([\d.-]+)\s*[,\s]\s*([\d.-]+)\s*\)/);
      if (translateMatch) {
        x += parseFloat(translateMatch[1]);
        y += parseFloat(translateMatch[2]);
      }
    }
    current = current.parentElement as SVGElement | null;
  }

  return { x, y };
}

export async function renderMermaidLayout(
  mermaidText: string,
): Promise<MermaidLayoutResult> {
  const mermaid = (await import("mermaid")).default;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    flowchart: {
      htmlLabels: false,  // SVG labels for accurate size measurement
    },
  });

  // Unique ID per render call to avoid mermaid.js internal cache conflicts
  const containerId = `mermaid-layout-tmp-${++renderCounter}`;

  // Create off-screen container
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  document.body.appendChild(container);

  try {
    const { svg } = await mermaid.render(containerId, mermaidText);
    container.innerHTML = svg;
    const svgEl = container.querySelector("svg");
    if (!svgEl) throw new Error("Failed to render Mermaid SVG");

    const nodes = new Map<string, MermaidNodeLayout>();
    const subgraphs = new Map<string, MermaidSubgraphLayout>();

    // Extract node positions and sizes from .node elements
    // Walk the full transform chain to get absolute SVG coordinates
    svgEl.querySelectorAll(".node").forEach((el) => {
      const gEl = el as SVGGraphicsElement;
      const rawId = gEl.id;
      if (!rawId) return;
      const id = extractId(rawId);

      const bbox = gEl.getBBox();
      const abs = getAbsoluteTranslate(gEl as SVGElement, svgEl);

      nodes.set(id, {
        id,
        x: abs.x,
        y: abs.y,
        width: bbox.width,
        height: bbox.height,
      });
    });

    // Extract subgraph (cluster) positions and sizes
    svgEl.querySelectorAll(".cluster").forEach((el) => {
      const gEl = el as SVGGraphicsElement;
      const rawId = gEl.id;
      if (!rawId) return;
      const id = extractId(rawId);

      const rect = gEl.querySelector("rect");
      if (!rect) return;

      const rectX = parseFloat(rect.getAttribute("x") ?? "0");
      const rectY = parseFloat(rect.getAttribute("y") ?? "0");
      const width = parseFloat(rect.getAttribute("width") ?? "0");
      const height = parseFloat(rect.getAttribute("height") ?? "0");

      // Walk transform chain for absolute position
      const abs = getAbsoluteTranslate(gEl as SVGElement, svgEl);

      subgraphs.set(id, {
        id,
        x: rectX + abs.x,
        y: rectY + abs.y,
        width,
        height,
      });
    });

    return { nodes, subgraphs };
  } finally {
    document.body.removeChild(container);
    // Clean up mermaid internal cache element if it exists
    const cached = document.getElementById(containerId);
    if (cached) cached.remove();
  }
}
