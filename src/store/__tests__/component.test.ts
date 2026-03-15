import { describe, it, expect, beforeEach } from "vitest";
import { useFlowStore } from "../useFlowStore";

describe("Component Definition Management", () => {
  beforeEach(() => {
    useFlowStore.getState().clearAll();
  });

  it("createComponentDefinition creates a definition with default template", () => {
    const id = useFlowStore.getState().createComponentDefinition("Auth Flow");
    const defs = useFlowStore.getState().componentDefinitions;
    expect(defs).toHaveLength(1);
    expect(defs[0].id).toBe(id);
    expect(defs[0].name).toBe("Auth Flow");
    expect(defs[0].version).toBe(1);
    expect(defs[0].nodes).toHaveLength(3);
    expect(defs[0].edges).toHaveLength(2);
    expect(defs[0].entryNodeId).toBe("n1");
    expect(defs[0].exitNodeId).toBe("n3");
  });

  it("createComponentDefinition accepts custom nodes and edges", () => {
    const nodes = [
      { id: "a", label: "A", shape: "rectangle" as const, position: { x: 0, y: 0 } },
      { id: "b", label: "B", shape: "diamond" as const, position: { x: 0, y: 80 } },
    ];
    const edges = [{ id: "e1", source: "a", target: "b" }];
    const id = useFlowStore.getState().createComponentDefinition("Custom", nodes, edges);
    const def = useFlowStore.getState().componentDefinitions.find((d) => d.id === id)!;
    expect(def.nodes).toHaveLength(2);
    expect(def.edges).toHaveLength(1);
  });

  it("updateComponentDefinition increments version", () => {
    const id = useFlowStore.getState().createComponentDefinition("Test");
    useFlowStore.getState().updateComponentDefinition(id, { name: "Updated" });
    const def = useFlowStore.getState().componentDefinitions.find((d) => d.id === id)!;
    expect(def.name).toBe("Updated");
    expect(def.version).toBe(2);
  });

  it("deleteComponentDefinition removes the definition", () => {
    const id = useFlowStore.getState().createComponentDefinition("ToDelete");
    expect(useFlowStore.getState().componentDefinitions).toHaveLength(1);
    useFlowStore.getState().deleteComponentDefinition(id);
    expect(useFlowStore.getState().componentDefinitions).toHaveLength(0);
  });
});

describe("Component Instance Management", () => {
  let defId: string;

  beforeEach(() => {
    useFlowStore.getState().clearAll();
    defId = useFlowStore.getState().createComponentDefinition("Auth Flow");
  });

  it("placeComponentInstance creates a componentInstance node with children", () => {
    useFlowStore.getState().placeComponentInstance(defId);
    const nodes = useFlowStore.getState().nodes;
    const parent = nodes.find((n) => n.type === "componentInstance")!;
    const children = nodes.filter((n) => n.data.componentParentId === parent.id);
    expect(parent).toBeDefined();
    expect(parent.data.componentDefinitionId).toBe(defId);
    expect(parent.data.componentSyncVersion).toBe(1);
    expect(parent.data.componentInstanceName).toBe("Auth Flow");
    expect(children).toHaveLength(1); // Process only (Start/End excluded)
    expect(useFlowStore.getState().edges.filter((e) => !e.data?.isBridgeEdge)).toHaveLength(0); // internal edges (entry/exit edges excluded)
  });

  it("placeComponentInstance with custom name", () => {
    useFlowStore.getState().placeComponentInstance(defId, undefined, "Admin Auth");
    const parent = useFlowStore.getState().nodes.find((n) => n.type === "componentInstance")!;
    expect(parent.data.componentInstanceName).toBe("Admin Auth");
    expect(parent.data.label).toBe("Admin Auth");
  });

  it("updateComponentInstanceName changes the name", () => {
    useFlowStore.getState().placeComponentInstance(defId);
    const parentId = useFlowStore.getState().nodes.find((n) => n.type === "componentInstance")!.id;
    useFlowStore.getState().updateComponentInstanceName(parentId, "Renamed");
    const node = useFlowStore.getState().nodes.find((n) => n.id === parentId)!;
    expect(node.data.componentInstanceName).toBe("Renamed");
    expect(node.data.label).toBe("Renamed");
  });

  it("child nodes are not selectable or draggable", () => {
    useFlowStore.getState().placeComponentInstance(defId);
    const parentId = useFlowStore.getState().nodes.find((n) => n.type === "componentInstance")!.id;
    const children = useFlowStore.getState().nodes.filter((n) => n.data.componentParentId === parentId);
    for (const child of children) {
      expect(child.selectable).toBe(false);
      expect(child.draggable).toBe(false);
    }
  });

  it("toggleComponentCollapse toggles collapsed state and hides children", () => {
    useFlowStore.getState().placeComponentInstance(defId);
    const parentId = useFlowStore.getState().nodes.find((n) => n.type === "componentInstance")!.id;
    expect(useFlowStore.getState().nodes.find((n) => n.id === parentId)!.data.collapsed).toBe(false);
    useFlowStore.getState().toggleComponentCollapse(parentId);
    expect(useFlowStore.getState().nodes.find((n) => n.id === parentId)!.data.collapsed).toBe(true);
    // Children should be hidden
    const hiddenChildren = useFlowStore.getState().nodes.filter((n) => n.data.componentParentId === parentId);
    expect(hiddenChildren.every((n) => n.hidden)).toBe(true);
    useFlowStore.getState().toggleComponentCollapse(parentId);
    expect(useFlowStore.getState().nodes.find((n) => n.id === parentId)!.data.collapsed).toBe(false);
  });

  it("syncComponentInstance regenerates children from definition", () => {
    useFlowStore.getState().placeComponentInstance(defId);
    const parentId = useFlowStore.getState().nodes.find((n) => n.type === "componentInstance")!.id;

    // Update definition
    useFlowStore.getState().updateComponentDefinition(defId, { name: "Updated Auth" });
    expect(useFlowStore.getState().componentDefinitions[0].version).toBe(2);

    // Sync
    useFlowStore.getState().syncComponentInstance(parentId);
    const node = useFlowStore.getState().nodes.find((n) => n.id === parentId)!;
    expect(node.data.componentSyncVersion).toBe(2);
    // Children should be regenerated
    const children = useFlowStore.getState().nodes.filter((n) => n.data.componentParentId === parentId);
    expect(children).toHaveLength(1); // Process only (Start/End excluded)
  });

  it("multiple instances of same definition are independent", () => {
    useFlowStore.getState().placeComponentInstance(defId, undefined, "Instance A");
    useFlowStore.getState().placeComponentInstance(defId, undefined, "Instance B");
    const parents = useFlowStore.getState().nodes.filter((n) => n.type === "componentInstance");
    expect(parents).toHaveLength(2);
    expect(parents[0].data.componentInstanceName).toBe("Instance A");
    expect(parents[1].data.componentInstanceName).toBe("Instance B");
    expect(parents[0].data.componentDefinitionId).toBe(parents[1].data.componentDefinitionId);
  });
});

describe("Component Editing Mode", () => {
  beforeEach(() => {
    useFlowStore.getState().clearAll();
  });

  it("enterComponentEditMode saves main flow and loads component nodes", () => {
    // Set up main flow
    useFlowStore.getState().addNode("rectangle");
    useFlowStore.getState().addNode("diamond");
    expect(useFlowStore.getState().nodes).toHaveLength(2);

    const defId = useFlowStore.getState().createComponentDefinition("Test");
    useFlowStore.getState().enterComponentEditMode(defId);

    // Should be in edit mode
    expect(useFlowStore.getState().editingComponentId).toBe(defId);
    expect(useFlowStore.getState().savedMainFlow).not.toBeNull();
    expect(useFlowStore.getState().savedMainFlow!.nodes).toHaveLength(2);

    // Canvas should show component's 3 default nodes
    expect(useFlowStore.getState().nodes).toHaveLength(3);
    expect(useFlowStore.getState().nodes[0].data.label).toBe("Start");
    expect(useFlowStore.getState().nodes[0].type).toBe("stadium");
  });

  it("exitComponentEditMode restores main flow and updates definition", () => {
    useFlowStore.getState().addNode("rectangle");
    const defId = useFlowStore.getState().createComponentDefinition("Test");
    useFlowStore.getState().enterComponentEditMode(defId);

    // Modify the Process node (n2, not locked) label in edit mode
    useFlowStore.getState().updateNodeLabel("n2", "Modified Process");

    // Exit edit mode
    const result = useFlowStore.getState().exitComponentEditMode();
    expect(result).toBe(true);

    // Should be back to main flow
    expect(useFlowStore.getState().editingComponentId).toBeNull();
    expect(useFlowStore.getState().savedMainFlow).toBeNull();
    expect(useFlowStore.getState().nodes).toHaveLength(1); // original main flow node

    // Definition should be updated
    const def = useFlowStore.getState().componentDefinitions.find((d) => d.id === defId)!;
    expect(def.version).toBe(2);
    expect(def.nodes[1].label).toBe("Modified Process");
  });

  it("createAndEditComponent creates definition and enters edit mode", () => {
    useFlowStore.getState().createAndEditComponent();

    expect(useFlowStore.getState().editingComponentId).not.toBeNull();
    expect(useFlowStore.getState().componentDefinitions).toHaveLength(1);
    expect(useFlowStore.getState().componentDefinitions[0].name).toBe("コンポーネント1");
    expect(useFlowStore.getState().nodes).toHaveLength(3); // default template
  });

  it("createAndEditComponent generates unique names", () => {
    useFlowStore.getState().createComponentDefinition("コンポーネント1");
    useFlowStore.getState().createAndEditComponent();

    const defs = useFlowStore.getState().componentDefinitions;
    expect(defs).toHaveLength(2);
    expect(defs[1].name).toBe("コンポーネント2");
  });

  it("renameComponentDefinition changes name without incrementing version", () => {
    const defId = useFlowStore.getState().createComponentDefinition("Old Name");
    useFlowStore.getState().renameComponentDefinition(defId, "New Name");
    const def = useFlowStore.getState().componentDefinitions[0];
    expect(def.name).toBe("New Name");
    expect(def.version).toBe(1); // version unchanged
  });

  it("entry/exit nodes are locked in edit mode", () => {
    const defId = useFlowStore.getState().createComponentDefinition("Test");
    useFlowStore.getState().enterComponentEditMode(defId);

    // Entry (n1) and exit (n3) should be locked
    const nodes = useFlowStore.getState().nodes;
    expect(nodes.find((n) => n.id === "n1")!.data.isLocked).toBe(true);
    expect(nodes.find((n) => n.id === "n3")!.data.isLocked).toBe(true);
    expect(nodes.find((n) => n.id === "n2")!.data.isLocked).toBeUndefined();
  });

  it("locked nodes cannot have their label changed", () => {
    const defId = useFlowStore.getState().createComponentDefinition("Test");
    useFlowStore.getState().enterComponentEditMode(defId);

    useFlowStore.getState().updateNodeLabel("n1", "Should Not Change");
    expect(useFlowStore.getState().nodes.find((n) => n.id === "n1")!.data.label).toBe("Start");
  });

  it("locked nodes cannot be deleted", () => {
    const defId = useFlowStore.getState().createComponentDefinition("Test");
    useFlowStore.getState().enterComponentEditMode(defId);

    useFlowStore.getState().removeNodes(["n1", "n2"]);
    const nodes = useFlowStore.getState().nodes;
    // n1 (locked) should survive, n2 should be removed
    expect(nodes.find((n) => n.id === "n1")).toBeDefined();
    expect(nodes.find((n) => n.id === "n2")).toBeUndefined();
  });

  it("discardComponentEdit restores main flow without saving", () => {
    useFlowStore.getState().addNode("rectangle");
    const defId = useFlowStore.getState().createComponentDefinition("Test");
    const originalVersion = useFlowStore.getState().componentDefinitions[0].version;
    useFlowStore.getState().enterComponentEditMode(defId);

    // Make changes
    useFlowStore.getState().updateNodeLabel("n2", "Changed");

    // Discard
    useFlowStore.getState().discardComponentEdit();

    // Main flow restored
    expect(useFlowStore.getState().editingComponentId).toBeNull();
    expect(useFlowStore.getState().nodes).toHaveLength(1);

    // Definition NOT updated (version unchanged)
    const def = useFlowStore.getState().componentDefinitions.find((d) => d.id === defId)!;
    expect(def.version).toBe(originalVersion);
    expect(def.nodes[1].label).toBe("Process"); // original label
  });

  it("enterComponentEditMode with invalid id does nothing", () => {
    useFlowStore.getState().addNode("rectangle");
    useFlowStore.getState().enterComponentEditMode("nonexistent");
    expect(useFlowStore.getState().editingComponentId).toBeNull();
    expect(useFlowStore.getState().nodes).toHaveLength(1);
  });

  it("editing preserves entry/exit node IDs when changed", () => {
    const defId = useFlowStore.getState().createComponentDefinition("Test");
    useFlowStore.getState().enterComponentEditMode(defId);

    // Make a change so it actually saves
    useFlowStore.getState().updateNodeLabel("n2", "Changed");
    useFlowStore.getState().exitComponentEditMode();

    const def = useFlowStore.getState().componentDefinitions.find((d) => d.id === defId)!;
    expect(def.entryNodeId).toBe("n1");
    expect(def.exitNodeId).toBe("n3");
  });

  it("no version bump when nothing changed on existing component", () => {
    const defId = useFlowStore.getState().createComponentDefinition("Test");
    // Make it version 2 so it's not treated as new
    useFlowStore.getState().updateComponentDefinition(defId, { name: "Test Updated" });
    expect(useFlowStore.getState().componentDefinitions[0].version).toBe(2);

    useFlowStore.getState().enterComponentEditMode(defId);
    // Exit without changes
    useFlowStore.getState().exitComponentEditMode();

    const def = useFlowStore.getState().componentDefinitions.find((d) => d.id === defId)!;
    expect(def.version).toBe(2); // no bump
  });

  it("new component with no changes is deleted on exit", () => {
    useFlowStore.getState().createAndEditComponent();
    expect(useFlowStore.getState().componentDefinitions).toHaveLength(1);

    // Exit without any changes
    useFlowStore.getState().exitComponentEditMode();

    // Definition should be deleted
    expect(useFlowStore.getState().componentDefinitions).toHaveLength(0);
  });

  it("new component with changes is kept on exit", () => {
    useFlowStore.getState().createAndEditComponent();
    const defId = useFlowStore.getState().editingComponentId!;

    // Make a change
    useFlowStore.getState().updateNodeLabel("n2", "My Process");
    useFlowStore.getState().exitComponentEditMode();

    // Definition should be kept and updated
    const def = useFlowStore.getState().componentDefinitions.find((d) => d.id === defId)!;
    expect(def).toBeDefined();
    expect(def.version).toBe(2);
    expect(def.nodes[1].label).toBe("My Process");
  });
});

describe("Component with loadState", () => {
  beforeEach(() => {
    useFlowStore.getState().clearAll();
  });

  it("loadState restores componentDefinitions", () => {
    const defId = useFlowStore.getState().createComponentDefinition("Test");
    useFlowStore.getState().placeComponentInstance(defId);

    const state = useFlowStore.getState();
    useFlowStore.getState().clearAll();
    expect(useFlowStore.getState().componentDefinitions).toHaveLength(0);

    useFlowStore.getState().loadState({
      nodes: state.nodes,
      edges: state.edges,
      direction: state.direction,
      nextIdCounter: state.nextIdCounter,
      componentDefinitions: state.componentDefinitions,
    });

    expect(useFlowStore.getState().componentDefinitions).toHaveLength(1);
    const parents = useFlowStore.getState().nodes.filter((n) => n.type === "componentInstance");
    expect(parents).toHaveLength(1);
    const children = useFlowStore.getState().nodes.filter((n) => n.data.componentParentId);
    expect(children).toHaveLength(1); // Process only (Start/End excluded)
  });
});
