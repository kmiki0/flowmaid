import { describe, it, expect } from "vitest";
import { serialize } from "../serialize";
import { deserialize } from "../deserialize";
import type { FlowNode, FlowEdge } from "@/store/types";

describe("subgraphGroup serialize/deserialize round-trip", () => {
  const nodes: FlowNode[] = [
    {
      id: "sg1",
      type: "subgraphGroup",
      position: { x: 10, y: 50 },
      data: { label: "MyGroup", shape: "rectangle", isSubgraphGroup: true },
      style: { width: 400, height: 300 },
      zIndex: -1,
    },
    {
      id: "A",
      type: "rectangle",
      position: { x: 20, y: 60 },
      parentId: "sg1",
      data: { label: "NodeA", shape: "rectangle", subgraphParentId: "sg1" },
      style: { width: 150, height: 50 },
    },
    {
      id: "B",
      type: "diamond",
      position: { x: 20, y: 160 },
      parentId: "sg1",
      data: { label: "NodeB", shape: "diamond", subgraphParentId: "sg1" },
      style: { width: 100, height: 100 },
    },
    {
      id: "C",
      type: "rectangle",
      position: { x: 500, y: 200 },
      data: { label: "External", shape: "rectangle" },
      style: { width: 150, height: 50 },
    },
  ];

  const edges: FlowEdge[] = [
    {
      id: "A-B-bottom-source-top-target",
      source: "A",
      target: "B",
      type: "labeled",
      sourceHandle: "bottom-source",
      targetHandle: "top-target",
      data: { label: "", edgeType: "bezier", markerEnd: "arrowclosed" },
    },
    {
      id: "B-C-right-source-left-target",
      source: "B",
      target: "C",
      type: "labeled",
      sourceHandle: "right-source",
      targetHandle: "left-target",
      data: { label: "go", edgeType: "bezier", markerEnd: "arrowclosed" },
    },
  ];

  it("serializes subgraphGroup fields", () => {
    const output = serialize(nodes, edges, "TD");
    expect(output).toContain("isSubgraphGroup: true");
    expect(output).toContain("subgraphParentId: sg1");
    // Both child nodes should be present (not skipped)
    expect(output).toContain("A:");
    expect(output).toContain("B:");
  });

  it("deserializes subgraphGroup correctly", () => {
    const output = serialize(nodes, edges, "TD");
    const result = deserialize(output);

    // SubgraphGroup node
    const sgNode = result.nodes.find((n) => n.id === "sg1");
    expect(sgNode).toBeDefined();
    expect(sgNode!.type).toBe("subgraphGroup");
    expect(sgNode!.data.isSubgraphGroup).toBe(true);

    // Child nodes with parentId
    const nodeA = result.nodes.find((n) => n.id === "A");
    expect(nodeA).toBeDefined();
    expect(nodeA!.parentId).toBe("sg1");
    expect(nodeA!.data.subgraphParentId).toBe("sg1");

    const nodeB = result.nodes.find((n) => n.id === "B");
    expect(nodeB).toBeDefined();
    expect(nodeB!.parentId).toBe("sg1");

    // External node
    const nodeC = result.nodes.find((n) => n.id === "C");
    expect(nodeC).toBeDefined();
    expect(nodeC!.parentId).toBeUndefined();

    // All edges preserved
    expect(result.edges).toHaveLength(2);
  });

  it("round-trips positions correctly", () => {
    const output = serialize(nodes, edges, "TD");
    const result = deserialize(output);

    const sgNode = result.nodes.find((n) => n.id === "sg1");
    expect(sgNode!.position).toEqual({ x: 10, y: 50 });

    const nodeA = result.nodes.find((n) => n.id === "A");
    expect(nodeA!.position).toEqual({ x: 20, y: 60 });
  });
});
