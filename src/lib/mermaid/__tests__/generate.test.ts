import { describe, it, expect } from "vitest";
import { generateMermaid } from "../generate";
import { nodeToMermaid, escapeMermaid } from "../nodeToMermaid";
import { edgeToMermaid } from "../edgeToMermaid";
import type { FlowNode, FlowEdge } from "@/store/types";

function makeNode(
  id: string,
  label: string,
  shape: string
): FlowNode {
  return {
    id,
    type: shape,
    position: { x: 0, y: 0 },
    data: { label, shape: shape as FlowNode["data"]["shape"] },
  };
}

function makeEdge(
  source: string,
  target: string,
  label?: string
): FlowEdge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    type: "labeled",
    data: { label },
  };
}

describe("escapeMermaid", () => {
  it("escapes special characters", () => {
    expect(escapeMermaid("a & b")).toBe("a #amp; b");
    expect(escapeMermaid("x < y")).toBe("x #lt; y");
    expect(escapeMermaid("[test]")).toBe("#lbrack;test#rbrack;");
    expect(escapeMermaid("{test}")).toBe("#lbrace;test#rbrace;");
    expect(escapeMermaid("(test)")).toBe("#lpar;test#rpar;");
  });

  it("returns plain text unchanged", () => {
    expect(escapeMermaid("hello")).toBe("hello");
  });
});

describe("nodeToMermaid", () => {
  it("converts rectangle", () => {
    expect(nodeToMermaid(makeNode("A", "Start", "rectangle"))).toBe(
      "    A[Start]"
    );
  });

  it("converts diamond", () => {
    expect(nodeToMermaid(makeNode("B", "Condition", "diamond"))).toBe(
      "    B{Condition}"
    );
  });

  it("converts roundedRect", () => {
    expect(nodeToMermaid(makeNode("C", "Process", "roundedRect"))).toBe(
      "    C(Process)"
    );
  });

  it("converts circle", () => {
    expect(nodeToMermaid(makeNode("D", "End", "circle"))).toBe(
      "    D((End))"
    );
  });
});

describe("edgeToMermaid", () => {
  it("converts edge without label", () => {
    expect(edgeToMermaid(makeEdge("A", "B"))).toBe("    A --> B");
  });

  it("converts edge with label", () => {
    expect(edgeToMermaid(makeEdge("A", "B", "Yes"))).toBe(
      "    A -->|Yes| B"
    );
  });

  it("ignores empty label", () => {
    expect(edgeToMermaid(makeEdge("A", "B", ""))).toBe("    A --> B");
    expect(edgeToMermaid(makeEdge("A", "B", "  "))).toBe("    A --> B");
  });
});

describe("generateMermaid", () => {
  it("generates complete flowchart", () => {
    const nodes = [
      makeNode("A", "Start", "rectangle"),
      makeNode("B", "Decision", "diamond"),
      makeNode("C", "End", "circle"),
    ];
    const edges = [
      makeEdge("A", "B"),
      makeEdge("B", "C", "Yes"),
    ];

    const result = generateMermaid(nodes, edges, "TD");
    expect(result).toBe(
      `graph TD\n    A[Start]\n    B{Decision}\n    C((End))\n    A --> B\n    B -->|Yes| C`
    );
  });

  it("uses LR direction", () => {
    const result = generateMermaid([], [], "LR");
    expect(result).toBe("graph LR");
  });
});
