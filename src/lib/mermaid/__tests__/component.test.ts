import { describe, it, expect } from "vitest";
import { generateMermaid } from "../generate";
import { parseMermaid } from "../parse";
import type { FlowNode, FlowEdge } from "@/store/types";
import type { ComponentDefinition } from "@/types/flow";
import { MarkerType } from "@xyflow/react";

describe("generateMermaid with component instances", () => {
  const definition: ComponentDefinition = {
    id: "sf1",
    name: "Auth",
    version: 1,
    nodes: [
      { id: "n1", label: "Start", shape: "stadium", position: { x: 50, y: 0 } },
      { id: "n2", label: "Login", shape: "rectangle", position: { x: 50, y: 80 } },
      { id: "n3", label: "End", shape: "stadium", position: { x: 50, y: 160 } },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n3", label: "next" },
    ],
    entryNodeId: "n1",
    exitNodeId: "n3",
  };

  // Helper: create parent + child nodes + internal edges for a component instance
  function createInstance(id: string, name: string): { nodes: FlowNode[]; edges: FlowEdge[] } {
    const parent: FlowNode = {
      id,
      type: "componentInstance",
      position: { x: 100, y: 100 },
      data: {
        label: name,
        shape: "rectangle",
        componentDefinitionId: "sf1",
        componentInstanceName: name,
        componentSyncVersion: 1,
      },
    };
    const children: FlowNode[] = definition.nodes.map((n) => ({
      id: `${id}_${n.id}`,
      type: n.shape,
      position: { x: n.position.x + 20, y: n.position.y + 56 },
      parentId: id,
      data: {
        label: n.label,
        shape: n.shape,
        componentParentId: id,
        componentInternalId: n.id,
      },
    }));
    const edges: FlowEdge[] = definition.edges.map((e) => ({
      id: `${id}_${e.id}`,
      source: `${id}_${e.source}`,
      target: `${id}_${e.target}`,
      type: "labeled",
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { label: e.label ?? "", edgeType: "bezier", markerEnd: "arrowclosed" },
    }));
    return { nodes: [parent, ...children], edges };
  }

  it("generates subgraph for component instance", () => {
    const { nodes, edges } = createInstance("A", "Auth Process");

    const result = generateMermaid(nodes, edges, "TD", [definition]);
    expect(result).toContain("subgraph A[Auth Process]");
    expect(result).toContain("A_n1([Start])");
    expect(result).toContain("A_n2[Login]");
    expect(result).toContain("A_n3([End])");
    expect(result).toContain("A_n1 --> A_n2");
    expect(result).toContain("A_n2 -->|next| A_n3");
    expect(result).toContain("end");
  });

  it("uses definition labels in mermaid output", () => {
    const { nodes, edges } = createInstance("A", "Auth");

    const result = generateMermaid(nodes, edges, "TD", [definition]);
    expect(result).toContain("A_n2[Login]");
  });

  it("remaps edges to entry/exit nodes", () => {
    const { nodes: instanceNodes, edges: instanceEdges } = createInstance("A", "Auth");
    const nodes: FlowNode[] = [
      ...instanceNodes,
      {
        id: "B",
        type: "rectangle",
        position: { x: 100, y: 300 },
        data: { label: "Next Step", shape: "rectangle" },
      },
    ];

    const edges: FlowEdge[] = [
      ...instanceEdges,
      {
        id: "A-B-d-d",
        source: "A",
        target: "B",
        type: "labeled",
        markerEnd: { type: MarkerType.ArrowClosed },
        data: { label: "", edgeType: "bezier", markerEnd: "arrowclosed" },
      },
    ];

    const result = generateMermaid(nodes, edges, "TD", [definition]);
    // Should remap A (exit=n3) -> B
    expect(result).toContain("A_n3 --> B");
  });
});

describe("parseMermaid with subgraph", () => {
  it("parses subgraph into definitions and instances", () => {
    const input = `graph TD
    subgraph Auth[Authentication]
    A[Start] --> B[Login]
    B --> C[End]
    end
    D[Dashboard]
    C --> D`;

    const result = parseMermaid(input);
    expect(result.componentDefinitions).toBeDefined();
    expect(result.componentDefinitions!.length).toBe(1);
    expect(result.componentDefinitions![0].name).toBe("Authentication");
    expect(result.componentDefinitions![0].nodes).toHaveLength(3);
    expect(result.componentDefinitions![0].edges).toHaveLength(2);

    // Should have instance node + dashboard node
    const instanceNode = result.nodes.find((n) => n.type === "componentInstance");
    expect(instanceNode).toBeDefined();
    expect(instanceNode!.data.componentInstanceName).toBe("Authentication");

    const dashNode = result.nodes.find((n) => n.id === "D");
    expect(dashNode).toBeDefined();
  });

  it("parses subgraph without bracket label", () => {
    const input = `graph TD
    subgraph Auth
    A[Start] --> B[End]
    end`;

    const result = parseMermaid(input);
    expect(result.componentDefinitions).toBeDefined();
    expect(result.componentDefinitions![0].name).toBe("Auth");
  });
});
