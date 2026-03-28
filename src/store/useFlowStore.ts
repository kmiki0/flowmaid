import { create } from "zustand";
import { temporal } from "zundo";
import {
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
} from "@xyflow/react";
import type { FlowState, FlowNode, FlowEdge, PredictiveInputState } from "./types";
import type { NodeShape, EdgeType, MarkerStyle, BorderStyle, FlowDirection, ComponentDefinition, ComponentInternalNode, ComponentInternalEdge } from "@/types/flow";
import { counterToId, idToCounter } from "@/lib/id";
import {
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_HEIGHT,
  DEFAULT_DIAMOND_SIZE,
  GHOST_NODE_ID,
} from "@/lib/constants";
import { serialize } from "@/lib/flowmaid/serialize";
import { generateComponentChildren, calculateComponentSize, rescaleComponentChildren, generateBridgeEdges, COMPONENT_HEADER_HEIGHT, COMPONENT_PADDING } from "@/lib/component-children";

function markerStyleToMarker(style?: MarkerStyle, color?: string) {
  switch (style) {
    case "arrow":
      return color ? { type: MarkerType.Arrow, color } : { type: MarkerType.Arrow };
    case "arrowclosed":
      return color ? { type: MarkerType.ArrowClosed, color } : { type: MarkerType.ArrowClosed };
    case "none":
      return undefined;
    default:
      return undefined;
  }
}

function reconcileBridgeEdges(nodes: FlowNode[], edges: FlowEdge[], defs: ComponentDefinition[], direction: FlowDirection = "TD"): FlowEdge[] {
  // Remove all existing bridge edges
  const nonBridgeEdges = edges.filter((e) => !e.data?.isBridgeEdge);

  // Generate bridge edges for all component instances
  const allBridgeEdges: FlowEdge[] = [];
  for (const node of nodes) {
    if (node.type !== "componentInstance" || !node.data.componentDefinitionId) continue;
    const def = defs.find((d) => d.id === node.data.componentDefinitionId);
    if (!def) continue;

    const bridges = generateBridgeEdges({
      parentId: node.id,
      def,
      allEdges: nonBridgeEdges,
      direction: def.direction ?? direction,
    });

    // If instance is collapsed, hide bridge edges
    const isCollapsed = node.data.collapsed ?? false;
    for (const b of bridges) {
      if (isCollapsed) b.hidden = true;
      allBridgeEdges.push(b);
    }
  }

  return [...nonBridgeEdges, ...allBridgeEdges];
}

const initialState = {
  nodes: [] as FlowNode[],
  edges: [] as FlowEdge[],
  direction: "TD" as const,
  nextIdCounter: 0,
  componentDefinitions: [] as ComponentDefinition[],
  editingComponentId: null as string | null,
  savedMainFlow: null as import("./types").SavedMainFlow | null,
  predictiveInput: {
    sourceNodeId: null,
    direction: null,
    ghostVisible: false,
    candidates: [],
    candidateIndex: 0,
  } as PredictiveInputState,
};

export const useFlowStore = create<FlowState>()(
  temporal(
    (set, get) => ({
      ...initialState,

      addNode: (shape: string, position?: { x: number; y: number }) => {
        const counter = get().nextIdCounter;
        const id = counterToId(counter);

        let width = DEFAULT_NODE_WIDTH;
        let height = DEFAULT_NODE_HEIGHT;
        if (shape === "diamond") {
          width = DEFAULT_DIAMOND_SIZE;
          height = DEFAULT_DIAMOND_SIZE;
        } else if (shape === "circle") {
          width = DEFAULT_NODE_HEIGHT * 2;
          height = DEFAULT_NODE_HEIGHT * 2;
        } else if (shape === "hexagon") {
          width = DEFAULT_NODE_WIDTH + 20;
          height = DEFAULT_NODE_HEIGHT + 10;
        } else if (shape === "cylinder") {
          width = DEFAULT_NODE_WIDTH;
          height = DEFAULT_NODE_HEIGHT + 20;
        } else if (shape === "document") {
          width = DEFAULT_NODE_WIDTH;
          height = DEFAULT_NODE_HEIGHT + 10;
        } else if (shape === "predefinedProcess") {
          width = DEFAULT_NODE_WIDTH + 20;
          height = DEFAULT_NODE_HEIGHT;
        } else if (shape === "display") {
          width = DEFAULT_NODE_WIDTH + 20;
          height = DEFAULT_NODE_HEIGHT;
        } else if (shape === "text") {
          width = DEFAULT_NODE_WIDTH;
          height = DEFAULT_NODE_HEIGHT;
        }

        const isText = shape === "text";
        const newNode: FlowNode = {
          id,
          type: shape,
          position: position ?? { x: 250, y: 150 },
          data: {
            label: isText ? "Text" : id,
            shape: shape as NodeShape,
            ...(isText && { fillOpacity: 0, borderOpacity: 0 }),
          },
          style: { width, height },
        };

        set({
          nodes: [...get().nodes, newNode],
          nextIdCounter: counter + 1,
        });
      },

      removeNodes: (ids: string[]) => {
        const { nodes, edges, editingComponentId } = get();
        // In component editing mode, protect locked (entry/exit) nodes
        const protectedIds = editingComponentId
          ? new Set(nodes.filter((n) => n.data.isLocked).map((n) => n.id))
          : new Set<string>();
        const idSet = new Set(ids.filter((id) => !protectedIds.has(id)));
        if (idSet.size === 0) return;
        // Also remove children of component instances being deleted
        for (const n of nodes) {
          if (n.data.componentParentId && idSet.has(n.data.componentParentId as string)) {
            idSet.add(n.id);
          }
        }
        set({
          nodes: nodes.filter((n) => !idSet.has(n.id)),
          edges: edges.filter(
            (e) => !idSet.has(e.source) && !idSet.has(e.target)
          ),
        });
      },

      updateNodeLabel: (id: string, label: string) => {
        // In component editing mode, protect locked (entry/exit) nodes
        const node = get().nodes.find((n) => n.id === id);
        if (node?.data.isLocked && get().editingComponentId) return;
        set({
          nodes: get().nodes.map((n) => {
            if (n.id !== id) return n;
            const updated = { ...n, data: { ...n.data, label } };
            // Auto-expand height for multiline text
            const lineCount = label.split("\n").length;
            if (lineCount > 1) {
              const fontSize = n.data.fontSize ?? 14;
              const lineHeight = fontSize * 1.5;
              const padding = 20; // vertical padding
              const minHeight = padding + lineCount * lineHeight;
              const currentH = (n.style as Record<string, number>)?.height ?? DEFAULT_NODE_HEIGHT;
              if (minHeight > currentH) {
                updated.style = { ...n.style, height: Math.round(minHeight) };
              }
            }
            return updated;
          }),
        });
      },

      updateNodeId: (oldId: string, newId: string) => {
        const { nodes, edges } = get();
        if (oldId === newId) return true;
        if (nodes.some((n) => n.id === newId)) return false;

        set({
          nodes: nodes.map((n) =>
            n.id === oldId ? { ...n, id: newId } : n
          ),
          edges: edges.map((e) => ({
            ...e,
            id:
              e.source === oldId || e.target === oldId
                ? `${e.source === oldId ? newId : e.source}-${e.target === oldId ? newId : e.target}`
                : e.id,
            source: e.source === oldId ? newId : e.source,
            target: e.target === oldId ? newId : e.target,
          })),
        });
        return true;
      },

      updateNodeColors: (id: string, fillColor?: string | null, borderColor?: string | null) => {
        set({
          nodes: get().nodes.map((n) => {
            if (n.id !== id) return n;
            const newData = { ...n.data };
            if (fillColor !== undefined) newData.fillColor = fillColor ?? undefined;
            if (borderColor !== undefined) newData.borderColor = borderColor ?? undefined;
            return { ...n, data: newData };
          }),
        });
      },

      updateNodeBorder: (id: string, borderWidth?: number, borderStyle?: BorderStyle) => {
        set({
          nodes: get().nodes.map((n) => {
            if (n.id !== id) return n;
            const newData = { ...n.data };
            if (borderWidth !== undefined) newData.borderWidth = borderWidth;
            if (borderStyle !== undefined) newData.borderStyle = borderStyle;
            return { ...n, data: newData };
          }),
        });
      },

      updateNodeTextStyle: (id, style) => {
        set({
          nodes: get().nodes.map((n) => {
            if (n.id !== id) return n;
            const newData = { ...n.data };
            if (style.fontSize !== undefined) newData.fontSize = style.fontSize;
            if (style.textColor !== undefined) newData.textColor = style.textColor || undefined;
            if (style.textAlign !== undefined) newData.textAlign = style.textAlign;
            if (style.textVerticalAlign !== undefined) newData.textVerticalAlign = style.textVerticalAlign;
            if (style.bold !== undefined) newData.bold = style.bold;
            if (style.italic !== undefined) newData.italic = style.italic;
            if (style.underline !== undefined) newData.underline = style.underline;
            return { ...n, data: newData };
          }),
        });
      },

      updateNodeColorAdjust: (id, target, opacity, lightness) => {
        set({
          nodes: get().nodes.map((n) => {
            if (n.id !== id) return n;
            const newData = { ...n.data };
            if (target === "fill") {
              if (opacity !== undefined) newData.fillOpacity = opacity;
              if (lightness !== undefined) newData.fillLightness = lightness;
            } else if (target === "border") {
              if (opacity !== undefined) newData.borderOpacity = opacity;
              if (lightness !== undefined) newData.borderLightness = lightness;
            } else if (target === "text") {
              if (opacity !== undefined) newData.textOpacity = opacity;
              if (lightness !== undefined) newData.textLightness = lightness;
            }
            return { ...n, data: newData };
          }),
        });
      },

      updateNodeShape: (id, shape) => {
        set({
          nodes: get().nodes.map((n) => {
            if (n.id !== id) return n;
            // Skip component instances and locked nodes
            if (n.type === "componentInstance" || n.data.isLocked) return n;
            return { ...n, type: shape, data: { ...n.data, shape } };
          }),
        });
      },

      resizeSelectedNodes: (resizingId: string, deltaW: number, deltaH: number, deltaX: number, deltaY: number, initials?: Map<string, { w: number; h: number; x: number; y: number }>) => {
        const MIN_W = 60;
        const MIN_H = 30;
        const nodes = get().nodes;
        const selectedIds = nodes
          .filter((n) => n.selected && n.id !== resizingId && !n.data.componentParentId)
          .map((n) => n.id);
        if (selectedIds.length === 0) return;

        const idSet = new Set(selectedIds);
        const updatedNodes = nodes.map((n) => {
          if (!idSet.has(n.id)) return n;
          const initial = initials?.get(n.id);
          const baseW = initial?.w ?? n.width ?? n.measured?.width ?? (n.style?.width as number) ?? DEFAULT_NODE_WIDTH;
          const baseH = initial?.h ?? n.height ?? n.measured?.height ?? (n.style?.height as number) ?? DEFAULT_NODE_HEIGHT;
          const baseX = initial?.x ?? n.position.x;
          const baseY = initial?.y ?? n.position.y;
          const newW = Math.max(MIN_W, baseW + deltaW);
          const newH = Math.max(MIN_H, baseH + deltaH);
          return {
            ...n,
            position: { x: baseX + deltaX, y: baseY + deltaY },
            width: newW,
            height: newH,
            style: { ...n.style, width: newW, height: newH },
          };
        });

        // Rescale component instance children if needed
        let result = updatedNodes;
        const defs = get().componentDefinitions;
        for (const id of selectedIds) {
          const node = result.find((n) => n.id === id);
          if (node?.type === "componentInstance" && !node.data.collapsed && node.data.componentDefinitionId) {
            const def = defs.find((d) => d.id === node.data.componentDefinitionId);
            if (def) {
              const w = (node.style?.width as number) ?? DEFAULT_NODE_WIDTH;
              const h = (node.style?.height as number) ?? DEFAULT_NODE_HEIGHT;
              result = rescaleComponentChildren(result, id, def, w, h);
            }
          }
        }

        set({ nodes: result });
      },

      // Component definition actions
      createComponentDefinition: (name: string, nodes?: ComponentInternalNode[], edges?: ComponentInternalEdge[]) => {
        const id = `comp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const defaultNodes: ComponentInternalNode[] = nodes ?? [
          { id: "n1", label: "Start", shape: "stadium", position: { x: 50, y: 0 } },
          { id: "n2", label: "Process", shape: "rectangle", position: { x: 50, y: 120 } },
          { id: "n3", label: "End", shape: "stadium", position: { x: 50, y: 240 } },
        ];
        const defaultEdges: ComponentInternalEdge[] = edges ?? [
          { id: "e1", source: "n1", target: "n2" },
          { id: "e2", source: "n2", target: "n3" },
        ];
        const def: ComponentDefinition = {
          id,
          name,
          version: 1,
          nodes: defaultNodes,
          edges: defaultEdges,
          entryNodeId: defaultNodes[0]?.id ?? null,
          exitNodeId: defaultNodes.length > 0 ? defaultNodes[defaultNodes.length - 1].id : null,
        };
        set({ componentDefinitions: [...get().componentDefinitions, def] });
        return id;
      },

      updateComponentDefinition: (id: string, updates: Partial<Omit<ComponentDefinition, 'id'>>) => {
        set({
          componentDefinitions: get().componentDefinitions.map((d) => {
            if (d.id !== id) return d;
            const updated = { ...d, ...updates };
            // Auto-increment version unless explicitly set
            if (updates.version === undefined) {
              updated.version = d.version + 1;
            }
            return updated;
          }),
        });
      },

      deleteComponentDefinition: (id: string) => {
        set({
          componentDefinitions: get().componentDefinitions.filter((d) => d.id !== id),
        });
      },

      // Component instance actions
      placeComponentInstance: (definitionId: string, position?: { x: number; y: number }, instanceName?: string) => {
        const def = get().componentDefinitions.find((d) => d.id === definitionId);
        if (!def) return;

        let counter = get().nextIdCounter;
        const parentId = counterToId(counter++);
        const { width, height } = calculateComponentSize(def);

        const parentNode: FlowNode = {
          id: parentId,
          type: "componentInstance",
          position: position ?? { x: 250, y: 150 },
          data: {
            label: instanceName ?? def.name,
            shape: "rectangle" as NodeShape,
            componentDefinitionId: definitionId,
            componentDefinitionDirection: def.direction,
            componentInstanceName: instanceName ?? def.name,
            componentSyncVersion: def.version,
            collapsed: false,
          },
          style: { width, height },
        };

        const { childNodes, childEdges } = generateComponentChildren({ parentId, def });

        const newNodes = [...get().nodes, parentNode, ...childNodes];
        const newEdges = reconcileBridgeEdges(newNodes, [...get().edges, ...childEdges], get().componentDefinitions, get().direction);
        set({
          nodes: newNodes,
          edges: newEdges,
          nextIdCounter: counter,
        });
      },

      updateComponentInstanceName: (nodeId: string, name: string) => {
        set({
          nodes: get().nodes.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, componentInstanceName: name, label: name } }
              : n
          ),
        });
      },

      syncComponentInstance: (nodeId: string) => {
        const node = get().nodes.find((n) => n.id === nodeId);
        if (!node?.data.componentDefinitionId) return;
        const def = get().componentDefinitions.find((d) => d.id === node.data.componentDefinitionId);
        if (!def) return;

        // Remove old children and internal edges
        const oldChildIds = new Set(
          get().nodes.filter((n) => n.data.componentParentId === nodeId).map((n) => n.id)
        );
        const filteredNodes = get().nodes.filter((n) => !oldChildIds.has(n.id));
        const filteredEdges = get().edges.filter(
          (e) => !oldChildIds.has(e.source) && !oldChildIds.has(e.target)
        );

        const isCollapsed = node.data.collapsed ?? false;
        const { childNodes: newChildren, childEdges: newChildEdges } = generateComponentChildren({
          parentId: nodeId,
          def,
          hidden: isCollapsed,
        });

        const { width, height } = calculateComponentSize(def);

        const updatedNodes = filteredNodes.map((n) => {
          if (n.id !== nodeId) return n;
          if (isCollapsed) {
            // Keep collapsed size, update expandedSize
            return {
              ...n,
              data: { ...n.data, componentSyncVersion: def.version, componentDefinitionDirection: def.direction, expandedSize: { width, height } },
            };
          }
          return {
            ...n,
            data: { ...n.data, componentSyncVersion: def.version, componentDefinitionDirection: def.direction },
            style: { ...n.style, width, height },
          };
        }).concat(newChildren);
        const updatedEdges = reconcileBridgeEdges(updatedNodes, [...filteredEdges, ...newChildEdges], get().componentDefinitions, get().direction);
        set({
          nodes: updatedNodes,
          edges: updatedEdges,
        });
      },

      toggleComponentCollapse: (nodeId: string) => {
        const node = get().nodes.find((n) => n.id === nodeId);
        if (!node) return;
        const newCollapsed = !node.data.collapsed;

        // Collect child IDs for edge filtering
        const childIds = new Set(
          get().nodes.filter((n) => n.data.componentParentId === nodeId).map((n) => n.id)
        );

        // Calculate z-index for expanded component (parent: maxZ+1, children: maxZ+2)
        const allZ = get().nodes.map((nd) => nd.zIndex ?? 0);
        const maxZ = allZ.length > 0 ? Math.max(...allZ) : 0;

        const updatedNodes = get().nodes.map((n) => {
          if (n.id === nodeId) {
            if (newCollapsed) {
              // Save expanded size and restore collapsed size (or default 150x50)
              const currentW = n.width ?? (n.style as Record<string, unknown>)?.width as number | undefined;
              const currentH = n.height ?? (n.style as Record<string, unknown>)?.height as number | undefined;
              const collapsedSize = n.data.collapsedSize ?? { width: 150, height: 50 };
              // Restore z-index from before expand
              const restoredZ = n.data.preExpandZIndex ?? (n.zIndex ?? 0);
              return {
                ...n,
                width: collapsedSize.width,
                height: collapsedSize.height,
                zIndex: restoredZ,
                data: {
                  ...n.data,
                  collapsed: true,
                  expandedSize: currentW && currentH ? { width: currentW, height: currentH } : undefined,
                  preExpandZIndex: undefined,
                },
                style: { width: collapsedSize.width, height: collapsedSize.height },
              };
            } else {
              // Save collapsed size and restore expanded size
              const currentW = n.width ?? (n.style as Record<string, unknown>)?.width as number | undefined;
              const currentH = n.height ?? (n.style as Record<string, unknown>)?.height as number | undefined;
              const def = get().componentDefinitions.find((d) => d.id === n.data.componentDefinitionId);
              const expandedSize = n.data.expandedSize ?? (def ? calculateComponentSize(def) : { width: 200, height: 120 });
              // Save current z-index before bringing to front
              const preExpandZ = n.zIndex ?? 0;
              return {
                ...n,
                width: expandedSize.width,
                height: expandedSize.height,
                zIndex: maxZ + 1,
                data: {
                  ...n.data,
                  collapsed: false,
                  collapsedSize: currentW && currentH ? { width: currentW, height: currentH } : undefined,
                  preExpandZIndex: preExpandZ,
                },
                style: { width: expandedSize.width, height: expandedSize.height },
              };
            }
          }
          // Hide/show child nodes and set z-index above parent
          if (n.data.componentParentId === nodeId) {
            if (newCollapsed) {
              return { ...n, hidden: true };
            }
            return { ...n, hidden: false, zIndex: maxZ + 2 };
          }
          return n;
        });

        const updatedEdges = get().edges.map((e) => {
          // Hide/show internal edges (between children) and bridge edges
          const isBridge = e.data?.isBridgeEdge && (childIds.has(e.source) || childIds.has(e.target) || e.source === nodeId || e.target === nodeId);
          const isInternal = childIds.has(e.source) && childIds.has(e.target);
          if (isInternal || isBridge) {
            return { ...e, hidden: newCollapsed };
          }
          return e;
        });

        set({ nodes: updatedNodes, edges: updatedEdges });
      },

      enterComponentEditMode: (definitionId: string) => {
        const { nodes, edges, direction, nextIdCounter, componentDefinitions } = get();
        const def = componentDefinitions.find((d) => d.id === definitionId);
        if (!def) return;

        // Convert definition nodes to FlowNodes
        const flowNodes: FlowNode[] = def.nodes.map((n) => ({
          id: n.id,
          type: n.shape,
          position: n.position,
          data: {
            label: n.label,
            shape: n.shape as NodeShape,
            ...(n.id === def.entryNodeId || n.id === def.exitNodeId ? { isLocked: true } : {}),
            ...(n.fillColor ? { fillColor: n.fillColor } : {}),
            ...(n.fillOpacity !== undefined ? { fillOpacity: n.fillOpacity } : {}),
            ...(n.fillLightness !== undefined ? { fillLightness: n.fillLightness } : {}),
            ...(n.borderColor ? { borderColor: n.borderColor } : {}),
            ...(n.borderOpacity !== undefined ? { borderOpacity: n.borderOpacity } : {}),
            ...(n.borderLightness !== undefined ? { borderLightness: n.borderLightness } : {}),
            ...(n.borderWidth ? { borderWidth: n.borderWidth } : {}),
            ...(n.borderStyle ? { borderStyle: n.borderStyle } : {}),
            ...(n.fontSize ? { fontSize: n.fontSize } : {}),
            ...(n.textColor ? { textColor: n.textColor } : {}),
            ...(n.textOpacity !== undefined ? { textOpacity: n.textOpacity } : {}),
            ...(n.textLightness !== undefined ? { textLightness: n.textLightness } : {}),
            ...(n.textAlign ? { textAlign: n.textAlign } : {}),
            ...(n.textVerticalAlign ? { textVerticalAlign: n.textVerticalAlign } : {}),
            ...(n.bold ? { bold: n.bold } : {}),
            ...(n.italic ? { italic: n.italic } : {}),
            ...(n.underline ? { underline: n.underline } : {}),
          },
          style: n.style ?? { width: 150, height: 50 },
        }));

        const defDirection = def.direction ?? "TD";
        const defaultSrcHandle = defDirection === "LR" ? "right-source" : "bottom-source";
        const defaultTgtHandle = defDirection === "LR" ? "left-target" : "top-target";
        const flowEdges: FlowEdge[] = def.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle ?? defaultSrcHandle,
          targetHandle: e.targetHandle ?? defaultTgtHandle,
          type: "labeled" as const,
          markerEnd: markerStyleToMarker(e.markerEnd ?? "arrowclosed", e.strokeColor) ?? { type: MarkerType.ArrowClosed },
          markerStart: markerStyleToMarker(e.markerStart, e.strokeColor),
          data: {
            label: e.label ?? "",
            edgeType: e.edgeType ?? "bezier" as const,
            markerStart: e.markerStart,
            markerEnd: e.markerEnd ?? "arrowclosed" as const,
            ...(e.strokeWidth ? { strokeWidth: e.strokeWidth } : {}),
            ...(e.strokeColor ? { strokeColor: e.strokeColor } : {}),
            ...(e.strokeOpacity !== undefined ? { strokeOpacity: e.strokeOpacity } : {}),
            ...(e.strokeLightness !== undefined ? { strokeLightness: e.strokeLightness } : {}),
            ...(e.strokeStyle ? { strokeStyle: e.strokeStyle } : {}),
          },
        }));

        // Calculate next counter based on existing node IDs
        let maxCounter = 0;
        for (const n of def.nodes) {
          if (/^[A-Z]+$/.test(n.id)) {
            const c = idToCounter(n.id);
            if (c + 1 > maxCounter) maxCounter = c + 1;
          }
        }

        // Take snapshot of component state for change detection on exit
        const componentSnapshot = serialize(flowNodes, flowEdges, defDirection);

        set({
          savedMainFlow: { nodes, edges, direction, nextIdCounter, componentSnapshot },
          editingComponentId: definitionId,
          nodes: flowNodes,
          edges: flowEdges,
          direction: defDirection,
          nextIdCounter: maxCounter,
        });

        // Clear undo history for clean edit session
        useFlowStore.temporal.getState().clear();
      },

      exitComponentEditMode: () => {
        const { nodes, edges, editingComponentId, savedMainFlow, componentDefinitions } = get();
        if (!editingComponentId || !savedMainFlow) return false;

        const def = componentDefinitions.find((d) => d.id === editingComponentId);
        if (!def) return false;

        // Convert back to definition format
        const internalNodes: ComponentInternalNode[] = nodes.map((n) => {
          // Use measured/width/height (set by NodeResizer) over style (initial value)
          const w = n.width ?? n.measured?.width ?? (n.style?.width as number | undefined);
          const h = n.height ?? n.measured?.height ?? (n.style?.height as number | undefined);
          const node: ComponentInternalNode = {
            id: n.id,
            label: n.data.label,
            shape: n.data.shape,
            position: n.position,
            style: w && h ? { width: w, height: h } : undefined,
          };
          if (n.data.fillColor) node.fillColor = n.data.fillColor;
          if (n.data.fillOpacity !== undefined && n.data.fillOpacity !== 10) node.fillOpacity = n.data.fillOpacity;
          if (n.data.fillLightness !== undefined && n.data.fillLightness !== 5) node.fillLightness = n.data.fillLightness;
          if (n.data.borderColor) node.borderColor = n.data.borderColor;
          if (n.data.borderOpacity !== undefined && n.data.borderOpacity !== 10) node.borderOpacity = n.data.borderOpacity;
          if (n.data.borderLightness !== undefined && n.data.borderLightness !== 5) node.borderLightness = n.data.borderLightness;
          if (n.data.borderWidth) node.borderWidth = n.data.borderWidth;
          if (n.data.borderStyle) node.borderStyle = n.data.borderStyle;
          if (n.data.fontSize) node.fontSize = n.data.fontSize;
          if (n.data.textColor) node.textColor = n.data.textColor;
          if (n.data.textOpacity !== undefined && n.data.textOpacity !== 10) node.textOpacity = n.data.textOpacity;
          if (n.data.textLightness !== undefined && n.data.textLightness !== 5) node.textLightness = n.data.textLightness;
          if (n.data.textAlign && n.data.textAlign !== "center") node.textAlign = n.data.textAlign;
          if (n.data.textVerticalAlign && n.data.textVerticalAlign !== "middle") node.textVerticalAlign = n.data.textVerticalAlign;
          if (n.data.bold) node.bold = n.data.bold;
          if (n.data.italic) node.italic = n.data.italic;
          if (n.data.underline) node.underline = n.data.underline;
          return node;
        });

        const internalEdges: ComponentInternalEdge[] = edges.map((e) => {
          const edge: ComponentInternalEdge = {
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.data?.label || undefined,
          };
          if (e.sourceHandle) edge.sourceHandle = e.sourceHandle;
          if (e.targetHandle) edge.targetHandle = e.targetHandle;
          if (e.data?.edgeType && e.data.edgeType !== "bezier") edge.edgeType = e.data.edgeType;
          if (e.data?.markerStart) edge.markerStart = e.data.markerStart;
          if (e.data?.markerEnd && e.data.markerEnd !== "arrowclosed") edge.markerEnd = e.data.markerEnd;
          if (e.data?.strokeWidth && e.data.strokeWidth !== 2) edge.strokeWidth = e.data.strokeWidth;
          if (e.data?.strokeColor) edge.strokeColor = e.data.strokeColor;
          if (e.data?.strokeOpacity !== undefined && e.data.strokeOpacity !== 10) edge.strokeOpacity = e.data.strokeOpacity;
          if (e.data?.strokeLightness !== undefined && e.data.strokeLightness !== 5) edge.strokeLightness = e.data.strokeLightness;
          if (e.data?.strokeStyle && e.data.strokeStyle !== "solid") edge.strokeStyle = e.data.strokeStyle;
          return edge;
        });

        // Check if content changed by comparing .flowmaid serialized output
        // Use current direction (component's editing direction), not savedMainFlow.direction
        const currentDirection = get().direction;
        const currentSnapshot = serialize(nodes, edges, currentDirection);
        const hasChanges = currentSnapshot !== savedMainFlow.componentSnapshot;

        let updatedDefs: ComponentDefinition[];

        if (!hasChanges && def.version === 1) {
          // New component with no changes from template — delete it
          updatedDefs = componentDefinitions.filter((d) => d.id !== editingComponentId);
        } else if (!hasChanges) {
          // Existing component with no changes — keep as-is, no version bump
          // But backfill direction if missing (legacy data migration)
          if (def.direction !== currentDirection) {
            updatedDefs = componentDefinitions.map((d) =>
              d.id === editingComponentId ? { ...d, direction: currentDirection } : d
            );
          } else {
            updatedDefs = componentDefinitions;
          }
        } else {
          // Has changes — update definition with version bump
          const nodeIdSet = new Set(nodes.map((n) => n.id));
          const entryNodeId = def.entryNodeId && nodeIdSet.has(def.entryNodeId)
            ? def.entryNodeId
            : (nodes[0]?.id ?? null);
          const exitNodeId = def.exitNodeId && nodeIdSet.has(def.exitNodeId)
            ? def.exitNodeId
            : (nodes.length > 0 ? nodes[nodes.length - 1].id : null);

          updatedDefs = componentDefinitions.map((d) => {
            if (d.id !== editingComponentId) return d;
            return {
              ...d,
              direction: currentDirection,
              nodes: internalNodes,
              edges: internalEdges,
              entryNodeId,
              exitNodeId,
              version: d.version + 1,
            };
          });
        }

        // Restore main flow
        set({
          nodes: savedMainFlow.nodes,
          edges: savedMainFlow.edges,
          direction: savedMainFlow.direction,
          nextIdCounter: savedMainFlow.nextIdCounter,
          componentDefinitions: updatedDefs,
          editingComponentId: null,
          savedMainFlow: null,
        });

        // Auto-sync all instances of the edited component
        if (hasChanges) {
          const instanceIds = get().nodes
            .filter((n) => n.data.componentDefinitionId === editingComponentId)
            .map((n) => n.id);
          for (const instId of instanceIds) {
            get().syncComponentInstance(instId);
          }
        }

        useFlowStore.temporal.getState().clear();
        return true;
      },

      discardComponentEdit: () => {
        const { savedMainFlow } = get();
        if (!savedMainFlow) return;

        // Restore main flow without saving component changes
        set({
          nodes: savedMainFlow.nodes,
          edges: savedMainFlow.edges,
          direction: savedMainFlow.direction,
          nextIdCounter: savedMainFlow.nextIdCounter,
          editingComponentId: null,
          savedMainFlow: null,
        });

        useFlowStore.temporal.getState().clear();
      },

      createAndEditComponent: (name?: string, initNodes?: ComponentInternalNode[], initEdges?: ComponentInternalEdge[]) => {
        const { componentDefinitions } = get();

        // Generate default name
        const baseName = name ?? (() => {
          let idx = 1;
          while (componentDefinitions.some((d) => d.name === `コンポーネント${idx}`)) idx++;
          return `コンポーネント${idx}`;
        })();

        const id = get().createComponentDefinition(baseName, initNodes, initEdges);
        get().enterComponentEditMode(id);
      },

      renameComponentDefinition: (id: string, name: string) => {
        set({
          componentDefinitions: get().componentDefinitions.map((d) =>
            d.id === id ? { ...d, name } : d
          ),
        });
      },

      duplicateNodes: (ids: string[]) => {
        const { nodes, edges, nextIdCounter } = get();
        let counter = nextIdCounter;

        // Filter out component children (they'll be duplicated with their parent)
        const toDuplicate = nodes.filter((n) => ids.includes(n.id) && !n.data.componentParentId);
        const newNodes: FlowNode[] = [];
        const newEdges: FlowEdge[] = [];

        for (const n of toDuplicate) {
          const newId = counterToId(counter++);

          if (n.type === "componentInstance" && n.data.componentDefinitionId) {
            // Duplicate parent
            newNodes.push({
              ...n,
              id: newId,
              position: { x: n.position.x + 30, y: n.position.y + 30 },
              data: { ...n.data },
              selected: false,
            });
            // Duplicate children
            const children = nodes.filter((c) => c.data.componentParentId === n.id);
            for (const child of children) {
              const newChildId = child.id.replace(n.id, newId);
              newNodes.push({
                ...child,
                id: newChildId,
                parentId: newId,
                data: { ...child.data, componentParentId: newId },
                selected: false,
              });
            }
            // Duplicate internal edges
            const childIds = new Set(children.map((c) => c.id));
            for (const e of edges) {
              if (childIds.has(e.source) && childIds.has(e.target)) {
                newEdges.push({
                  ...e,
                  id: e.id.replace(n.id, newId),
                  source: e.source.replace(n.id, newId),
                  target: e.target.replace(n.id, newId),
                });
              }
            }
          } else {
            newNodes.push({
              ...n,
              id: newId,
              position: { x: n.position.x + 30, y: n.position.y + 30 },
              data: { ...n.data },
              selected: false,
            });
          }
        }
        const allNodes = [...nodes, ...newNodes];
        const allEdges = reconcileBridgeEdges(allNodes, [...edges, ...newEdges], get().componentDefinitions, get().direction);
        set({
          nodes: allNodes,
          edges: allEdges,
          nextIdCounter: counter,
        });
      },

      addEdge: (
        source: string,
        target: string,
        label?: string,
        sourceHandle?: string | null,
        targetHandle?: string | null,
        edgeData?: Partial<import("@/types/flow").FlowEdgeData>,
      ) => {
        // Reject edges connected to ghost nodes (predictive input previews)
        if (source.startsWith(GHOST_NODE_ID) || target.startsWith(GHOST_NODE_ID)) return;
        const id = `${source}-${target}-${sourceHandle ?? "d"}-${targetHandle ?? "d"}`;
        if (get().edges.some((e) => e.id === id)) return;

        const mergedData = {
          label: label ?? edgeData?.label ?? "",
          edgeType: edgeData?.edgeType ?? "bezier" as const,
          markerEnd: edgeData?.markerEnd ?? "arrowclosed" as const,
          ...(edgeData?.markerStart && { markerStart: edgeData.markerStart }),
          ...(edgeData?.strokeWidth && { strokeWidth: edgeData.strokeWidth }),
          ...(edgeData?.strokeColor && { strokeColor: edgeData.strokeColor }),
          ...(edgeData?.strokeStyle && { strokeStyle: edgeData.strokeStyle }),
        };

        const newEdge: FlowEdge = {
          id,
          source,
          target,
          sourceHandle: sourceHandle ?? undefined,
          targetHandle: targetHandle ?? undefined,
          type: "labeled",
          markerEnd: markerStyleToMarker(mergedData.markerEnd, mergedData.strokeColor) ?? { type: MarkerType.ArrowClosed },
          ...(mergedData.markerStart && { markerStart: markerStyleToMarker(mergedData.markerStart, mergedData.strokeColor) }),
          data: mergedData,
        };
        const newEdges = reconcileBridgeEdges(get().nodes, [...get().edges, newEdge], get().componentDefinitions, get().direction);
        set({ edges: newEdges });
      },

      removeEdges: (ids: string[]) => {
        const idSet = new Set(ids);
        const filtered = get().edges.filter((e) => !idSet.has(e.id));
        set({
          edges: reconcileBridgeEdges(get().nodes, filtered, get().componentDefinitions, get().direction),
        });
      },

      updateEdgeLabel: (id: string, label: string) => {
        set({
          edges: get().edges.map((e) =>
            e.id === id ? { ...e, data: { ...e.data, label } } : e
          ),
        });
      },

      updateEdgeType: (id: string, edgeType: EdgeType) => {
        set({
          edges: get().edges.map((e) =>
            e.id === id ? { ...e, data: { ...e.data, edgeType, ...(edgeType !== "step" ? { waypoints: undefined } : {}) } } : e
          ),
        });
      },

      updateEdgeMarkers: (id: string, markerStart?: MarkerStyle, markerEnd?: MarkerStyle) => {
        set({
          edges: get().edges.map((e) => {
            if (e.id !== id) return e;
            const newData = { ...e.data };
            const color = e.data?.strokeColor;
            const update: Partial<FlowEdge> = { data: newData };
            if (markerStart !== undefined) {
              newData.markerStart = markerStart;
              update.markerStart = markerStyleToMarker(markerStart, color);
            }
            if (markerEnd !== undefined) {
              newData.markerEnd = markerEnd;
              update.markerEnd = markerStyleToMarker(markerEnd, color);
            }
            return { ...e, ...update };
          }),
        });
      },

      updateEdgeStyle: (id, strokeWidth, strokeColor, strokeStyle) => {
        set({
          edges: get().edges.map((e) => {
            if (e.id !== id) return e;
            const newData = { ...e.data };
            if (strokeWidth !== undefined) newData.strokeWidth = strokeWidth;
            if (strokeColor !== undefined) newData.strokeColor = strokeColor || undefined;
            if (strokeStyle !== undefined) newData.strokeStyle = strokeStyle;
            const color = newData.strokeColor;
            return {
              ...e,
              data: newData,
              markerEnd: markerStyleToMarker(newData.markerEnd ?? "arrowclosed", color),
              markerStart: markerStyleToMarker(newData.markerStart, color),
            };
          }),
        });
      },

      updateEdgeColorAdjust: (id, opacity, lightness) => {
        set({
          edges: get().edges.map((e) => {
            if (e.id !== id) return e;
            const newData = { ...e.data };
            if (opacity !== undefined) newData.strokeOpacity = opacity;
            if (lightness !== undefined) newData.strokeLightness = lightness;
            return { ...e, data: newData };
          }),
        });
      },

      updateEdgeWaypoints: (id: string, waypoints) => {
        set({
          edges: get().edges.map((e) =>
            e.id === id ? { ...e, data: { ...e.data, waypoints: waypoints.length > 0 ? waypoints : undefined } } : e
          ),
        });
      },

      reconnectEdge: (oldEdge, newConnection) => {
        if (!newConnection.source || !newConnection.target) return;
        const newId = `${newConnection.source}-${newConnection.target}-${newConnection.sourceHandle ?? "d"}-${newConnection.targetHandle ?? "d"}`;
        // Prevent duplicate
        if (newId !== oldEdge.id && get().edges.some((e) => e.id === newId)) return;
        const updatedEdges = get().edges.map((e) => {
          if (e.id !== oldEdge.id) return e;
          return {
            ...e,
            id: newId,
            source: newConnection.source!,
            target: newConnection.target!,
            sourceHandle: newConnection.sourceHandle ?? undefined,
            targetHandle: newConnection.targetHandle ?? undefined,
            data: { ...e.data, waypoints: undefined },
          };
        });
        set({ edges: reconcileBridgeEdges(get().nodes, updatedEdges, get().componentDefinitions, get().direction) });
      },

      alignNodes: (ids: string[], alignment) => {
        const { nodes } = get();
        const targets = nodes.filter((n) => ids.includes(n.id));
        if (targets.length < 2) return;

        let ref: number;
        switch (alignment) {
          case "left":
            ref = Math.min(...targets.map((n) => n.position.x));
            set({ nodes: nodes.map((n) => ids.includes(n.id) ? { ...n, position: { ...n.position, x: ref } } : n) });
            break;
          case "center": {
            const xs = targets.map((n) => n.position.x + ((n.measured?.width ?? 100) / 2));
            ref = (Math.min(...xs) + Math.max(...xs)) / 2;
            set({ nodes: nodes.map((n) => ids.includes(n.id) ? { ...n, position: { ...n.position, x: ref - ((n.measured?.width ?? 100) / 2) } } : n) });
            break;
          }
          case "right": {
            const rights = targets.map((n) => n.position.x + (n.measured?.width ?? 100));
            ref = Math.max(...rights);
            set({ nodes: nodes.map((n) => ids.includes(n.id) ? { ...n, position: { ...n.position, x: ref - (n.measured?.width ?? 100) } } : n) });
            break;
          }
          case "top":
            ref = Math.min(...targets.map((n) => n.position.y));
            set({ nodes: nodes.map((n) => ids.includes(n.id) ? { ...n, position: { ...n.position, y: ref } } : n) });
            break;
          case "middle": {
            const ys = targets.map((n) => n.position.y + ((n.measured?.height ?? 50) / 2));
            ref = (Math.min(...ys) + Math.max(...ys)) / 2;
            set({ nodes: nodes.map((n) => ids.includes(n.id) ? { ...n, position: { ...n.position, y: ref - ((n.measured?.height ?? 50) / 2) } } : n) });
            break;
          }
          case "bottom": {
            const bottoms = targets.map((n) => n.position.y + (n.measured?.height ?? 50));
            ref = Math.max(...bottoms);
            set({ nodes: nodes.map((n) => ids.includes(n.id) ? { ...n, position: { ...n.position, y: ref - (n.measured?.height ?? 50) } } : n) });
            break;
          }
        }
      },

      distributeNodes: (ids: string[], axis) => {
        const { nodes } = get();
        const targets = nodes.filter((n) => ids.includes(n.id));
        if (targets.length < 3) return;

        if (axis === "horizontal") {
          const sorted = [...targets].sort((a, b) => a.position.x - b.position.x);
          const first = sorted[0].position.x;
          const last = sorted[sorted.length - 1].position.x;
          const step = (last - first) / (sorted.length - 1);
          const posMap = new Map(sorted.map((n, i) => [n.id, first + i * step]));
          set({ nodes: nodes.map((n) => posMap.has(n.id) ? { ...n, position: { ...n.position, x: posMap.get(n.id)! } } : n) });
        } else {
          const sorted = [...targets].sort((a, b) => a.position.y - b.position.y);
          const first = sorted[0].position.y;
          const last = sorted[sorted.length - 1].position.y;
          const step = (last - first) / (sorted.length - 1);
          const posMap = new Map(sorted.map((n, i) => [n.id, first + i * step]));
          set({ nodes: nodes.map((n) => posMap.has(n.id) ? { ...n, position: { ...n.position, y: posMap.get(n.id)! } } : n) });
        }
      },

      reorderNodes: (ids: string[], action) => {
        const { nodes } = get();
        const idSet = new Set(ids);
        const zValues = nodes.map((n) => n.zIndex ?? 0);
        const minZ = Math.min(...zValues);
        const maxZ = Math.max(...zValues);

        switch (action) {
          case "front":
            set({
              nodes: nodes.map((n) =>
                idSet.has(n.id) ? { ...n, zIndex: maxZ + 1 } : n
              ),
            });
            break;
          case "back":
            set({
              nodes: nodes.map((n) =>
                idSet.has(n.id) ? { ...n, zIndex: minZ - 1 } : n
              ),
            });
            break;
          case "forward":
            set({
              nodes: nodes.map((n) =>
                idSet.has(n.id) ? { ...n, zIndex: (n.zIndex ?? 0) + 1 } : n
              ),
            });
            break;
          case "backward":
            set({
              nodes: nodes.map((n) =>
                idSet.has(n.id) ? { ...n, zIndex: (n.zIndex ?? 0) - 1 } : n
              ),
            });
            break;
        }
      },

      onNodesChange: (changes) => {
        const nodes = get().nodes;

        // Collect parent IDs being removed so we can cascade to children
        const removingParentIds = new Set<string>();
        for (const c of changes) {
          if (c.type === "remove") {
            const node = nodes.find((n) => n.id === c.id);
            if (node?.type === "componentInstance") {
              removingParentIds.add(c.id);
            }
          }
        }

        // Add removal changes for children of deleted component instances
        const childRemovals: typeof changes = [];
        if (removingParentIds.size > 0) {
          for (const n of nodes) {
            if (n.data.componentParentId && removingParentIds.has(n.data.componentParentId as string)) {
              childRemovals.push({ type: "remove", id: n.id });
            }
          }
        }

        // Collect component instance dimension changes for absolute child rescaling
        const parentResizes = new Map<string, { newW: number; newH: number }>();
        for (const c of changes) {
          if (c.type === "dimensions" && c.dimensions) {
            const node = nodes.find((n) => n.id === c.id);
            if (node?.type === "componentInstance" && !node.data.collapsed) {
              const oldW = (node.style?.width as number) ?? node.measured?.width;
              const oldH = (node.style?.height as number) ?? node.measured?.height;
              const newW = c.dimensions.width;
              const newH = c.dimensions.height;
              if (oldW && oldH && newW && newH && (oldW !== newW || oldH !== newH)) {
                parentResizes.set(c.id, { newW, newH });
              }
            }
          }
        }

        const allChanges = [...changes, ...childRemovals];
        const filteredChanges = allChanges.filter((c) => {
          // In component editing mode, protect locked nodes from removal
          if (c.type === "remove" && get().editingComponentId) {
            const node = nodes.find((n) => n.id === c.id);
            if (node?.data.isLocked) return false;
          }
          // Prevent independent removal of component child nodes (unless parent is also being removed)
          if (c.type === "remove") {
            const node = nodes.find((n) => n.id === c.id);
            if (node?.data.componentParentId && !removingParentIds.has(node.data.componentParentId as string)) return false;
          }
          // Prevent dimension changes on component child nodes (sizing is controlled by parent scaling)
          if (c.type === "dimensions") {
            const node = nodes.find((n) => n.id === c.id);
            if (node?.data.componentParentId) return false;
          }
          return true;
        });

        let updatedNodes = applyNodeChanges(filteredChanges, nodes);

        // Absolute rescale child nodes from definition base layout when parent component is resized
        if (parentResizes.size > 0) {
          const defs = get().componentDefinitions;
          for (const [parentId, resize] of parentResizes) {
            const parentNode = updatedNodes.find((n) => n.id === parentId);
            if (!parentNode?.data.componentDefinitionId) continue;
            const def = defs.find((d) => d.id === parentNode.data.componentDefinitionId);
            if (!def) continue;
            updatedNodes = rescaleComponentChildren(updatedNodes, parentId, def, resize.newW, resize.newH);
          }
        }

        // Remove orphaned edges (connected to deleted nodes) and reconcile bridges
        const hasRemoval = filteredChanges.some((c) => c.type === "remove");
        if (hasRemoval || removingParentIds.size > 0 || parentResizes.size > 0) {
          const updatedNodeIds = new Set(updatedNodes.map((n) => n.id));
          const cleanedEdges = get().edges.filter(
            (e) => updatedNodeIds.has(e.source) && updatedNodeIds.has(e.target)
          );
          set({
            nodes: updatedNodes,
            edges: (removingParentIds.size > 0 || parentResizes.size > 0)
              ? reconcileBridgeEdges(updatedNodes, cleanedEdges, get().componentDefinitions, get().direction)
              : cleanedEdges,
          });
        } else {
          set({ nodes: updatedNodes });
        }
      },

      onEdgesChange: (changes) => {
        const updated = applyEdgeChanges(changes, get().edges);
        // Reconcile bridge edges if any edges were removed
        const hasRemoval = changes.some((c) => c.type === "remove");
        set({
          edges: hasRemoval ? reconcileBridgeEdges(get().nodes, updated, get().componentDefinitions, get().direction) : updated,
        });
      },

      setDirection: (direction) => {
        // In component editing mode, update edge handles and swap node positions
        if (get().editingComponentId) {
          const sh = direction === "LR" ? "right-source" : "bottom-source";
          const th = direction === "LR" ? "left-target" : "top-target";
          const prevDirection = get().direction;
          const swapAxes = prevDirection !== direction;
          set({
            direction,
            nodes: swapAxes
              ? get().nodes.map((n) => ({
                  ...n,
                  position: { x: n.position.y, y: n.position.x },
                }))
              : get().nodes,
            edges: get().edges.map((e) => ({
              ...e,
              sourceHandle: sh,
              targetHandle: th,
              id: `${e.source}-${e.target}-${sh}-${th}`,
            })),
          });
        } else {
          set({ direction });
        }
      },

      loadState: (state) => {
        // Migrate edges: ensure top-level markers match data (incl. color)
        const edges = state.edges.map((e) => {
          const color = e.data?.strokeColor;
          return {
            ...e,
            markerEnd: e.markerEnd ?? markerStyleToMarker(e.data?.markerEnd ?? "arrowclosed", color),
            markerStart: e.markerStart ?? markerStyleToMarker(e.data?.markerStart, color),
          };
        });
        const defs = state.componentDefinitions ?? [];
        // Populate runtime-only componentDefinitionDirection from definitions
        const nodes = state.nodes.map((n) => {
          if (!n.data.componentDefinitionId) return n;
          const def = defs.find((d) => d.id === n.data.componentDefinitionId);
          if (!def?.direction) return n;
          return { ...n, data: { ...n.data, componentDefinitionDirection: def.direction } };
        });
        set({
          nodes,
          edges: reconcileBridgeEdges(nodes, edges, defs, state.direction),
          direction: state.direction,
          nextIdCounter: state.nextIdCounter,
          componentDefinitions: defs,
        });
      },

      // Predictive input
      setPredictiveInput: (update: Partial<PredictiveInputState>) => {
        set({ predictiveInput: { ...get().predictiveInput, ...update } });
      },
      clearPredictiveInput: () => {
        set({
          predictiveInput: {
            sourceNodeId: null,
            direction: null,
            ghostVisible: false,
            candidates: [],
            candidateIndex: 0,
          },
        });
      },
      addNodeWithData: (data, position, style) => {
        const counter = get().nextIdCounter;
        const id = counterToId(counter);
        const shape = data.shape;

        // Determine size: use provided style, or shape defaults
        let width = style?.width ?? DEFAULT_NODE_WIDTH;
        let height = style?.height ?? DEFAULT_NODE_HEIGHT;
        if (!style) {
          if (shape === "diamond") { width = DEFAULT_DIAMOND_SIZE; height = DEFAULT_DIAMOND_SIZE; }
          else if (shape === "circle") { width = DEFAULT_NODE_HEIGHT * 2; height = DEFAULT_NODE_HEIGHT * 2; }
          else if (shape === "hexagon") { width = DEFAULT_NODE_WIDTH + 20; height = DEFAULT_NODE_HEIGHT + 10; }
          else if (shape === "cylinder") { height = DEFAULT_NODE_HEIGHT + 20; }
          else if (shape === "document") { height = DEFAULT_NODE_HEIGHT + 10; }
          else if (shape === "predefinedProcess" || shape === "display") { width = DEFAULT_NODE_WIDTH + 20; }
        }

        const newNode: FlowNode = {
          id,
          type: shape,
          position,
          data: { ...data, label: data.label || id },
          style: { width, height },
        };

        set({
          nodes: [...get().nodes, newNode],
          nextIdCounter: counter + 1,
        });
        return id;
      },

      clearAll: () => {
        set({ ...initialState });
      },
    }),
    {
      partialize: (state) => ({
        nodes: state.nodes.filter((n) => !n.id.startsWith(GHOST_NODE_ID)),
        edges: state.edges.filter((e) => !e.source.startsWith(GHOST_NODE_ID) && !e.target.startsWith(GHOST_NODE_ID)),
        direction: state.direction,
        nextIdCounter: state.nextIdCounter,
        componentDefinitions: state.componentDefinitions,
      }),
      limit: 50,
    }
  )
);
