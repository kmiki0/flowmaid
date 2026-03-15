import { describe, it, expect } from "vitest";
import { parseMermaid, unescapeMermaid } from "../parse";
import { generateMermaid } from "../generate";

describe("unescapeMermaid", () => {
  it("unescapes all 10 escape sequences", () => {
    expect(unescapeMermaid("#amp;")).toBe("&");
    expect(unescapeMermaid("#quot;")).toBe('"');
    expect(unescapeMermaid("#lt;")).toBe("<");
    expect(unescapeMermaid("#gt;")).toBe(">");
    expect(unescapeMermaid("#lbrace;")).toBe("{");
    expect(unescapeMermaid("#rbrace;")).toBe("}");
    expect(unescapeMermaid("#lpar;")).toBe("(");
    expect(unescapeMermaid("#rpar;")).toBe(")");
    expect(unescapeMermaid("#lbrack;")).toBe("[");
    expect(unescapeMermaid("#rbrack;")).toBe("]");
  });

  it("passes through plain text", () => {
    expect(unescapeMermaid("hello world")).toBe("hello world");
  });
});

describe("parseMermaid - node shapes", () => {
  it("parses rectangle [label]", () => {
    const result = parseMermaid("graph TD\nA[Start]");
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].data.shape).toBe("rectangle");
    expect(result.nodes[0].data.label).toBe("Start");
    expect(result.nodes[0].id).toBe("A");
  });

  it("parses diamond {label}", () => {
    const result = parseMermaid("graph TD\nA{Condition}");
    expect(result.nodes[0].data.shape).toBe("diamond");
    expect(result.nodes[0].data.label).toBe("Condition");
  });

  it("parses roundedRect (label)", () => {
    const result = parseMermaid("graph TD\nA(Process)");
    expect(result.nodes[0].data.shape).toBe("roundedRect");
  });

  it("parses circle ((label))", () => {
    const result = parseMermaid("graph TD\nA((End))");
    expect(result.nodes[0].data.shape).toBe("circle");
  });

  it("parses stadium ([label])", () => {
    const result = parseMermaid("graph TD\nA([Terminal])");
    expect(result.nodes[0].data.shape).toBe("stadium");
  });

  it("parses cylinder [(label)]", () => {
    const result = parseMermaid("graph TD\nA[(Database)]");
    expect(result.nodes[0].data.shape).toBe("cylinder");
  });

  it("parses hexagon {{label}}", () => {
    const result = parseMermaid("graph TD\nA{{Prepare}}");
    expect(result.nodes[0].data.shape).toBe("hexagon");
  });

  it("parses parallelogram [/label/]", () => {
    const result = parseMermaid("graph TD\nA[/Input/]");
    expect(result.nodes[0].data.shape).toBe("parallelogram");
  });

  it("parses trapezoid [\\label\\]", () => {
    const result = parseMermaid("graph TD\nA[\\Output\\]");
    expect(result.nodes[0].data.shape).toBe("trapezoid");
  });
});

describe("parseMermaid - edges", () => {
  it("parses edge without label", () => {
    const result = parseMermaid("graph TD\nA[Start] --> B[End]");
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].source).toBe("A");
    expect(result.edges[0].target).toBe("B");
    expect(result.edges[0].data?.label).toBe("");
  });

  it("parses edge with label", () => {
    const result = parseMermaid("graph TD\nA --> |Yes| B");
    expect(result.edges[0].data?.label).toBe("Yes");
  });

  it("parses chain edges A --> B --> C", () => {
    const result = parseMermaid("graph TD\nA --> B --> C");
    expect(result.edges).toHaveLength(2);
    expect(result.edges[0].source).toBe("A");
    expect(result.edges[0].target).toBe("B");
    expect(result.edges[1].source).toBe("B");
    expect(result.edges[1].target).toBe("C");
  });

  it("parses inline node definitions in edge", () => {
    const result = parseMermaid("graph TD\nA[Start] --> B{Cond}");
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0].data.shape).toBe("rectangle");
    expect(result.nodes[0].data.label).toBe("Start");
    expect(result.nodes[1].data.shape).toBe("diamond");
    expect(result.nodes[1].data.label).toBe("Cond");
  });
});

describe("parseMermaid - direction", () => {
  it("parses graph TD", () => {
    const result = parseMermaid("graph TD\nA[X]");
    expect(result.direction).toBe("TD");
  });

  it("parses graph LR", () => {
    const result = parseMermaid("graph LR\nA[X]");
    expect(result.direction).toBe("LR");
  });

  it("maps TB to TD", () => {
    const result = parseMermaid("graph TB\nA[X]");
    expect(result.direction).toBe("TD");
  });

  it("maps BT to TD", () => {
    const result = parseMermaid("graph BT\nA[X]");
    expect(result.direction).toBe("TD");
  });
});

describe("parseMermaid - implicit nodes", () => {
  it("creates rectangle nodes for IDs referenced only in edges", () => {
    const result = parseMermaid("graph TD\nA --> B");
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0].data.shape).toBe("rectangle");
    expect(result.nodes[0].data.label).toBe("A");
    expect(result.nodes[1].data.shape).toBe("rectangle");
    expect(result.nodes[1].data.label).toBe("B");
  });
});

describe("round-trip: generateMermaid → parseMermaid", () => {
  it("preserves labels, shapes, and connections", () => {
    const mermaidInput = [
      "graph TD",
      "    A[Start]",
      "    B{Decision}",
      "    C((End))",
      "    A --> B",
      "    B -->|Yes| C",
    ].join("\n");

    const parsed = parseMermaid(mermaidInput);

    expect(parsed.nodes).toHaveLength(3);
    expect(parsed.edges).toHaveLength(2);

    // Check shapes
    const shapeMap = new Map(parsed.nodes.map((n) => [n.id, n.data.shape]));
    expect(shapeMap.get("A")).toBe("rectangle");
    expect(shapeMap.get("B")).toBe("diamond");
    expect(shapeMap.get("C")).toBe("circle");

    // Check labels
    const labelMap = new Map(parsed.nodes.map((n) => [n.id, n.data.label]));
    expect(labelMap.get("A")).toBe("Start");
    expect(labelMap.get("B")).toBe("Decision");
    expect(labelMap.get("C")).toBe("End");

    // Re-generate and verify structure matches
    const regenerated = generateMermaid(parsed.nodes, parsed.edges, parsed.direction);
    const lines = regenerated.split("\n");
    expect(lines[0]).toBe("graph TD");
    expect(lines).toContainEqual("    A[Start]");
    expect(lines).toContainEqual("    B{Decision}");
    expect(lines).toContainEqual("    C((End))");
    expect(lines).toContainEqual("    A --> B");
    expect(lines).toContainEqual("    B -->|Yes| C");
  });
});
