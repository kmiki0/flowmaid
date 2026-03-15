import { describe, it, expect } from "vitest";
import { serialize } from "../serialize";
import { deserialize } from "../deserialize";
import type { FlowNode, FlowEdge } from "@/store/types";
import type { ComponentDefinition } from "@/types/flow";

describe("Component serialize/deserialize", () => {
  const definition: ComponentDefinition = {
    id: "sf1",
    name: "Auth",
    version: 2,
    nodes: [
      { id: "n1", label: "Start", shape: "stadium", position: { x: 50, y: 0 } },
      { id: "n2", label: "End", shape: "stadium", position: { x: 50, y: 80 } },
    ],
    edges: [{ id: "e1", source: "n1", target: "n2" }],
    entryNodeId: "n1",
    exitNodeId: "n2",
  };

  const instanceNode: FlowNode = {
    id: "A",
    type: "componentInstance",
    position: { x: 100, y: 100 },
    data: {
      label: "Auth Instance",
      shape: "rectangle",
      componentDefinitionId: "sf1",
      componentInstanceName: "Auth Instance",
      componentSyncVersion: 2,
      collapsed: false,
    },
    style: { width: 200, height: 150 },
  };

  // Child nodes (would be created by placeComponentInstance in real usage)
  const childNodes: FlowNode[] = definition.nodes.map((n) => ({
    id: `A_${n.id}`,
    type: n.shape,
    position: { x: n.position.x + 20, y: n.position.y + 56 },
    parentId: "A",
    data: {
      label: n.id === "n1" ? "Custom Start" : n.label,
      shape: n.shape,
      componentParentId: "A",
      componentInternalId: n.id,
    },
  }));

  const childEdges: FlowEdge[] = [{
    id: "A_e1",
    source: "A_n1",
    target: "A_n2",
    type: "labeled",
    data: { label: "", edgeType: "bezier", markerEnd: "arrowclosed" },
  }];

  it("round-trips component definitions and instances", () => {
    const content = serialize([instanceNode, ...childNodes], childEdges, "TD", [definition]);
    expect(content).toContain("componentDefinitions");

    const result = deserialize(content);
    expect(result.componentDefinitions).toBeDefined();
    expect(result.componentDefinitions!).toHaveLength(1);
    expect(result.componentDefinitions![0].name).toBe("Auth");
    expect(result.componentDefinitions![0].version).toBe(2);

    // Parent node
    const parent = result.nodes.find((n) => n.type === "componentInstance")!;
    expect(parent).toBeDefined();
    expect(parent.data.componentDefinitionId).toBe("sf1");
    expect(parent.data.componentInstanceName).toBe("Auth Instance");
    expect(parent.data.componentSyncVersion).toBe(2);

    // Child nodes (regenerated from definition, excluding entry/exit)
    const children = result.nodes.filter((n) => n.data.componentParentId === "A");
    expect(children).toHaveLength(0); // Both n1 and n2 are entry/exit, so excluded

    // Internal edges (regenerated, excluding entry/exit edges)
    const internalEdges = result.edges.filter((e) => e.source.startsWith("A_") && !e.data?.isBridgeEdge);
    expect(internalEdges).toHaveLength(0);
  });

  it("serializes collapsed state", () => {
    const collapsedNode = {
      ...instanceNode,
      data: { ...instanceNode.data, collapsed: true },
    };
    const content = serialize([collapsedNode, ...childNodes], childEdges, "TD", [definition]);
    const result = deserialize(content);
    const parent = result.nodes.find((n) => n.type === "componentInstance")!;
    expect(parent.data.collapsed).toBe(true);
    // No children since both nodes are entry/exit
    const children = result.nodes.filter((n) => n.data.componentParentId === "A");
    expect(children).toHaveLength(0);
  });

  it("omits componentDefinitions when empty", () => {
    const normalNode: FlowNode = {
      id: "A",
      type: "rectangle",
      position: { x: 0, y: 0 },
      data: { label: "A", shape: "rectangle" },
      style: { width: 150, height: 50 },
    };
    const content = serialize([normalNode], [], "TD", []);
    expect(content).not.toContain("componentDefinitions");
  });
});
