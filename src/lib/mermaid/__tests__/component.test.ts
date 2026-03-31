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
  it("parses subgraph into subgraphGroup nodes", () => {
    const input = `graph TD
    subgraph Auth[Authentication]
    A[Start] --> B[Login]
    B --> C[End]
    end
    D[Dashboard]
    C --> D`;

    const result = parseMermaid(input);

    // Should have subgraphGroup node
    const sgNode = result.nodes.find((n) => n.type === "subgraphGroup");
    expect(sgNode).toBeDefined();
    expect(sgNode!.id).toBe("Auth");
    expect(sgNode!.data.label).toBe("Authentication");
    expect(sgNode!.data.isSubgraphGroup).toBe(true);

    // Child nodes should have parentId and subgraphParentId
    const childA = result.nodes.find((n) => n.id === "A");
    expect(childA).toBeDefined();
    expect(childA!.parentId).toBe("Auth");
    expect(childA!.data.subgraphParentId).toBe("Auth");

    const childB = result.nodes.find((n) => n.id === "B");
    expect(childB!.parentId).toBe("Auth");

    const childC = result.nodes.find((n) => n.id === "C");
    expect(childC!.parentId).toBe("Auth");

    // Dashboard should be a top-level node
    const dashNode = result.nodes.find((n) => n.id === "D");
    expect(dashNode).toBeDefined();
    expect(dashNode!.parentId).toBeUndefined();

    // Edges should reference child node IDs directly (no remapping)
    const edgeCD = result.edges.find((e) => e.source === "C" && e.target === "D");
    expect(edgeCD).toBeDefined();
  });

  it("parses subgraph without bracket label", () => {
    const input = `graph TD
    subgraph Auth
    A[Start] --> B[End]
    end`;

    const result = parseMermaid(input);
    const sgNode = result.nodes.find((n) => n.type === "subgraphGroup");
    expect(sgNode).toBeDefined();
    expect(sgNode!.data.label).toBe("Auth");
  });

  it("parses nested subgraphs", () => {
    const input = `graph TD
    subgraph outer[Outer]
    subgraph inner[Inner]
    A[NodeA]
    B[NodeB]
    end
    C[NodeC]
    end`;

    const result = parseMermaid(input);

    const outerSg = result.nodes.find((n) => n.id === "outer");
    expect(outerSg).toBeDefined();
    expect(outerSg!.data.isSubgraphGroup).toBe(true);
    expect(outerSg!.parentId).toBeUndefined();

    const innerSg = result.nodes.find((n) => n.id === "inner");
    expect(innerSg).toBeDefined();
    expect(innerSg!.data.isSubgraphGroup).toBe(true);
    expect(innerSg!.parentId).toBe("outer");
    expect(innerSg!.data.subgraphParentId).toBe("outer");

    const nodeA = result.nodes.find((n) => n.id === "A");
    expect(nodeA!.parentId).toBe("inner");
    expect(nodeA!.data.subgraphParentId).toBe("inner");

    const nodeC = result.nodes.find((n) => n.id === "C");
    expect(nodeC!.parentId).toBe("outer");
    expect(nodeC!.data.subgraphParentId).toBe("outer");
  });

  it("handles 3-level nested subgraphs with edges to subgraph IDs", () => {
    const input = `flowchart TB
    subgraph WSL[WSL2]
        PodmanCLI[CLI]
        subgraph Container[Container]
            App[App]
            subgraph Agents[Agents]
                A1[Agent1]
                A2[Agent2]
            end
        end
    end
    subgraph External[External]
        LLM[LLM]
    end
    D[Dashboard] --> WSL
    PodmanCLI -->|manage| Container
    App --> Agents
    Agents -->|call| LLM`;

    const result = parseMermaid(input);

    // All subgraphs should be subgraphGroup nodes, not regular nodes
    for (const sgId of ["WSL", "Container", "Agents", "External"]) {
      const sg = result.nodes.find((n) => n.id === sgId);
      expect(sg, `${sgId} should exist`).toBeDefined();
      expect(sg!.type, `${sgId} should be subgraphGroup`).toBe("subgraphGroup");
      expect(sg!.data.isSubgraphGroup, `${sgId} should have isSubgraphGroup`).toBe(true);
      // No duplicate regular node
      const all = result.nodes.filter((n) => n.id === sgId);
      expect(all, `${sgId} should have exactly 1 node`).toHaveLength(1);
    }

    // Verify nesting hierarchy
    expect(result.nodes.find((n) => n.id === "Container")!.parentId).toBe("WSL");
    expect(result.nodes.find((n) => n.id === "Agents")!.parentId).toBe("Container");

    // Verify child assignments
    expect(result.nodes.find((n) => n.id === "PodmanCLI")!.data.subgraphParentId).toBe("WSL");
    expect(result.nodes.find((n) => n.id === "App")!.data.subgraphParentId).toBe("Container");
    expect(result.nodes.find((n) => n.id === "A1")!.data.subgraphParentId).toBe("Agents");

    // Edges to subgraph IDs should work
    const edgeDtoWSL = result.edges.find((e) => e.target === "WSL");
    expect(edgeDtoWSL).toBeDefined();
    const edgeToAgents = result.edges.find((e) => e.source === "App" && e.target === "Agents");
    expect(edgeToAgents).toBeDefined();

    // WSL subgraph label
    expect(result.nodes.find((n) => n.id === "WSL")!.data.label).toBe("WSL2");
  });
});
