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
      `flowchart TD\n    A[Start]\n    B{Decision}\n    C((End))\n    A --> B\n    B -->|Yes| C`
    );
  });

  it("uses LR direction", () => {
    const result = generateMermaid([], [], "LR");
    expect(result).toBe("flowchart LR");
  });

  it("generates subgraph for subgraphGroup nodes", () => {
    const nodes: FlowNode[] = [
      {
        id: "sg1",
        type: "subgraphGroup",
        position: { x: 0, y: 0 },
        data: { label: "MyGroup", shape: "rectangle", isSubgraphGroup: true },
      },
      {
        id: "A",
        type: "rectangle",
        parentId: "sg1",
        position: { x: 20, y: 60 },
        data: { label: "NodeA", shape: "rectangle", subgraphParentId: "sg1" },
      },
      {
        id: "B",
        type: "diamond",
        parentId: "sg1",
        position: { x: 20, y: 160 },
        data: { label: "NodeB", shape: "diamond", subgraphParentId: "sg1" },
      },
      {
        id: "C",
        type: "rectangle",
        position: { x: 500, y: 200 },
        data: { label: "External", shape: "rectangle" },
      },
    ];
    const edges: FlowEdge[] = [
      makeEdge("A", "B"),
      makeEdge("B", "C", "go"),
    ];

    const result = generateMermaid(nodes, edges, "TD");
    expect(result).toContain("subgraph sg1[MyGroup]");
    expect(result).toContain("A[NodeA]");
    expect(result).toContain("B{NodeB}");
    expect(result).toContain("A --> B");
    expect(result).toContain("end");
    // External edge should be outside the subgraph block
    expect(result).toContain("B -->|go| C");
    // External node should be outside the subgraph block
    expect(result).toContain("C[External]");
  });

  it("outputs edges to nested subgraphGroup nodes within parent subgraph", () => {
    const nodes: FlowNode[] = [
      {
        id: "WSL",
        type: "subgraphGroup",
        position: { x: 0, y: 0 },
        data: { label: "WSL2", shape: "rectangle", isSubgraphGroup: true },
      },
      {
        id: "CLI",
        type: "rectangle",
        parentId: "WSL",
        position: { x: 20, y: 60 },
        data: { label: "CLI", shape: "rectangle", subgraphParentId: "WSL" },
      },
      {
        id: "Container",
        type: "subgraphGroup",
        parentId: "WSL",
        position: { x: 20, y: 160 },
        data: { label: "Container", shape: "rectangle", isSubgraphGroup: true, subgraphParentId: "WSL" },
      },
      {
        id: "App",
        type: "rectangle",
        parentId: "Container",
        position: { x: 10, y: 30 },
        data: { label: "App", shape: "rectangle", subgraphParentId: "Container" },
      },
    ];
    const edges: FlowEdge[] = [
      makeEdge("CLI", "Container", "manage"),
      makeEdge("App", "WSL"),
    ];

    const result = generateMermaid(nodes, edges, "TD");
    // Edge from regular node to nested subgraphGroup should be inside WSL's subgraph block
    expect(result).toContain("CLI -->|manage| Container");
    // Edge from deeply nested node to top-level subgraph should be at top level
    // (App is subgraphChild, WSL is not a subgraphChild → not both in subgraphChildIds → top-level)
    expect(result).toContain("App --> WSL");
  });
});
