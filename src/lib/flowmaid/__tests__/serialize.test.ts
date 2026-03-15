import { describe, it, expect } from "vitest";
import { serialize } from "../serialize";
import { deserialize } from "../deserialize";
import type { FlowNode, FlowEdge } from "@/store/types";

function makeNode(
  id: string,
  label: string,
  shape: string,
  x: number,
  y: number
): FlowNode {
  return {
    id,
    type: shape,
    position: { x, y },
    data: { label, shape: shape as FlowNode["data"]["shape"] },
    width: 150,
    height: 50,
  };
}

function makeEdge(source: string, target: string, label?: string): FlowEdge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    type: "labeled",
    data: { label: label ?? "" },
  };
}

describe("serialize", () => {
  it("produces valid .flowmaid format", () => {
    const nodes = [
      makeNode("A", "Start", "rectangle", 100, 50),
      makeNode("B", "Check", "diamond", 100, 150),
    ];
    const edges = [makeEdge("A", "B", "next")];

    const output = serialize(nodes, edges, "TD");

    expect(output).toContain("--- mermaid ---");
    expect(output).toContain("--- layout ---");
    expect(output).toContain("graph TD");
    expect(output).toContain("A[Start]");
    expect(output).toContain("B{Check}");
    expect(output).toContain("A -->|next| B");
  });
});

describe("deserialize", () => {
  it("round-trips through serialize/deserialize", () => {
    const nodes = [
      makeNode("A", "Start", "rectangle", 100, 50),
      makeNode("B", "Check", "diamond", 200, 150),
      makeNode("C", "End", "circle", 300, 250),
    ];
    const edges = [
      makeEdge("A", "B", "Yes"),
      makeEdge("B", "C"),
    ];

    const serialized = serialize(nodes, edges, "LR");
    const result = deserialize(serialized);

    expect(result.direction).toBe("LR");
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(2);
    expect(result.nextIdCounter).toBe(3); // C = counter 2, so next = 3

    // Check node properties survived
    const nodeA = result.nodes.find((n) => n.id === "A");
    expect(nodeA).toBeDefined();
    expect(nodeA!.data.label).toBe("Start");
    expect(nodeA!.data.shape).toBe("rectangle");
    expect(nodeA!.position.x).toBe(100);
    expect(nodeA!.position.y).toBe(50);

    // Check edge properties
    const edgeAB = result.edges.find((e) => e.source === "A" && e.target === "B");
    expect(edgeAB).toBeDefined();
    expect(edgeAB!.data?.label).toBe("Yes");
  });

  it("handles missing layout section", () => {
    expect(() => deserialize("just some text")).toThrow(
      "Invalid .flowmaid file"
    );
  });
});

describe("nextIdCounter", () => {
  it("calculates correct next counter from IDs", () => {
    const nodes = [
      makeNode("A", "A", "rectangle", 0, 0),
      makeNode("D", "D", "rectangle", 0, 0),
    ];
    const serialized = serialize(nodes, [], "TD");
    const result = deserialize(serialized);
    expect(result.nextIdCounter).toBe(4); // D=3, next=4
  });
});
