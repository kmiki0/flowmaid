import { describe, it, expect, beforeEach, vi } from "vitest";
import { useFlowStore } from "../useFlowStore";
import { generateMermaid } from "@/lib/mermaid/generate";

describe("Mermaid output after node deletion (#21)", () => {
  beforeEach(() => {
    useFlowStore.getState().clearAll();
  });

  it("generateMermaid returns only header when nodes/edges are empty", () => {
    const result = generateMermaid([], [], "TD");
    expect(result).toBe("graph TD");
  });

  it("store nodes/edges are empty after removeNodes", () => {
    // Add nodes
    useFlowStore.getState().addNode("rectangle", { x: 0, y: 0 });
    useFlowStore.getState().addNode("rectangle", { x: 100, y: 100 });
    const state1 = useFlowStore.getState();
    expect(state1.nodes.length).toBe(2);

    // Remove all nodes
    const ids = state1.nodes.map((n) => n.id);
    useFlowStore.getState().removeNodes(ids);
    const state2 = useFlowStore.getState();
    expect(state2.nodes.length).toBe(0);
    expect(state2.edges.length).toBe(0);
  });

  it("store subscribe fires with updated state after removeNodes", () => {
    // Add nodes
    useFlowStore.getState().addNode("rectangle", { x: 0, y: 0 });
    useFlowStore.getState().addNode("rectangle", { x: 100, y: 100 });

    const states: { nodes: number; edges: number }[] = [];
    const unsub = useFlowStore.subscribe((state) => {
      states.push({ nodes: state.nodes.length, edges: state.edges.length });
    });

    // Remove all nodes
    const ids = useFlowStore.getState().nodes.map((n) => n.id);
    useFlowStore.getState().removeNodes(ids);

    unsub();

    // Subscribe should have fired with empty state
    expect(states.length).toBeGreaterThanOrEqual(1);
    const last = states[states.length - 1];
    expect(last.nodes).toBe(0);
    expect(last.edges).toBe(0);
  });

  it("store subscribe fires with updated nodes after onNodesChange remove", () => {
    // Add nodes
    useFlowStore.getState().addNode("rectangle", { x: 0, y: 0 });
    useFlowStore.getState().addNode("rectangle", { x: 100, y: 100 });
    const nodeIds = useFlowStore.getState().nodes.map((n) => n.id);

    const states: { nodes: number; edges: number }[] = [];
    const unsub = useFlowStore.subscribe((state) => {
      states.push({ nodes: state.nodes.length, edges: state.edges.length });
    });

    // Simulate React Flow's deleteKeyCode behavior — calls onNodesChange with remove changes
    useFlowStore.getState().onNodesChange(
      nodeIds.map((id) => ({ type: "remove" as const, id }))
    );

    unsub();

    // Nodes should be removed
    expect(useFlowStore.getState().nodes.length).toBe(0);
    // Subscribe should have fired
    expect(states.length).toBeGreaterThanOrEqual(1);
    const last = states[states.length - 1];
    expect(last.nodes).toBe(0);
  });

  it("nodes reference changes after deletion (for snapshot comparison)", () => {
    useFlowStore.getState().addNode("rectangle", { x: 0, y: 0 });
    const nodesBefore = useFlowStore.getState().nodes;

    useFlowStore.getState().removeNodes([nodesBefore[0].id]);
    const nodesAfter = useFlowStore.getState().nodes;

    // Reference must be different for useMermaidOutput snapshot comparison
    expect(nodesAfter).not.toBe(nodesBefore);
    expect(nodesAfter.length).toBe(0);
  });

  it("edges connected to deleted nodes are also removed via removeNodes", () => {
    useFlowStore.getState().addNode("rectangle", { x: 0, y: 0 });
    useFlowStore.getState().addNode("rectangle", { x: 100, y: 100 });
    const state = useFlowStore.getState();
    const [a, b] = state.nodes;
    useFlowStore.getState().addEdge(a.id, b.id);
    expect(useFlowStore.getState().edges.length).toBe(1);

    // Delete node A — edge should also be removed
    useFlowStore.getState().removeNodes([a.id]);
    expect(useFlowStore.getState().nodes.length).toBe(1);
    expect(useFlowStore.getState().edges.length).toBe(0);
  });

  it("orphaned edges are removed by onNodesChange when nodes are deleted", () => {
    useFlowStore.getState().addNode("rectangle", { x: 0, y: 0 });
    useFlowStore.getState().addNode("rectangle", { x: 100, y: 100 });
    const state = useFlowStore.getState();
    const [a, b] = state.nodes;
    useFlowStore.getState().addEdge(a.id, b.id);
    expect(useFlowStore.getState().edges.length).toBe(1);

    // onNodesChange should now also remove connected edges
    useFlowStore.getState().onNodesChange([
      { type: "remove", id: a.id },
      { type: "remove", id: b.id },
    ]);

    const remaining = useFlowStore.getState();
    expect(remaining.nodes.length).toBe(0);
    expect(remaining.edges.length).toBe(0);
  });

  it("Mermaid output is empty after all nodes deleted via onNodesChange", () => {
    useFlowStore.getState().addNode("rectangle", { x: 0, y: 0 });
    useFlowStore.getState().addNode("diamond", { x: 100, y: 100 });
    const state = useFlowStore.getState();
    const [a, b] = state.nodes;
    useFlowStore.getState().addEdge(a.id, b.id);

    // Delete all via onNodesChange (same as Delete key in React Flow)
    useFlowStore.getState().onNodesChange(
      state.nodes.map((n) => ({ type: "remove" as const, id: n.id }))
    );

    const { nodes, edges } = useFlowStore.getState();
    const mermaid = generateMermaid(nodes, edges, "TD");
    expect(mermaid).toBe("graph TD");
  });
});
