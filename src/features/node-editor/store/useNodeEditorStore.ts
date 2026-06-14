import { create } from "zustand";
import { temporal } from "zundo";
import { applyNodeChanges, applyEdgeChanges, MarkerType } from "@xyflow/react";
import type { NodeEditorState, NodeEditorNode, NodeEditorEdge, NodeEditorPage } from "./types";
import type { NodeEditorNodeKind, PortDirection, NodeEditorPort } from "../types";
import {
  NODE_EDITOR_DEFAULT_NODE_WIDTH,
  NODE_EDITOR_DEFAULT_NODE_HEIGHT,
} from "../lib/constants";

function counterToId(counter: number): string {
  let result = "";
  let n = counter;
  do {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return result;
}

function createDefaultPorts(kind: NodeEditorNodeKind): NodeEditorPort[] {
  switch (kind) {
    case "service":
      return [
        { id: "p1", name: "input", direction: "input", dataType: "object" },
        { id: "p2", name: "output", direction: "output", dataType: "object" },
      ];
    case "table":
      return [
        { id: "p1", name: "id", direction: "bidirectional", dataType: "INT", isPrimaryKey: true },
      ];
    case "generic":
    default:
      return [
        { id: "p1", name: "in", direction: "input" },
        { id: "p2", name: "out", direction: "output" },
      ];
  }
}

const DEFAULT_PAGE_ID = "page-1";
const DEFAULT_PAGE_NAME = "Page 1";

function createPage(id: string, name: string): NodeEditorPage {
  return { id, name, nodes: [], edges: [], nextIdCounter: 0 };
}

/** 編集中（live）のノード/エッジをアクティブページに反映したpages配列を返す */
export function composePages(state: Pick<NodeEditorState, "pages" | "activePageId" | "nodes" | "edges" | "nextIdCounter">): NodeEditorPage[] {
  return state.pages.map((p) =>
    p.id === state.activePageId
      ? { ...p, nodes: state.nodes, edges: state.edges, nextIdCounter: state.nextIdCounter }
      : p
  );
}

function generatePortId(existingPorts: NodeEditorPort[]): string {
  let maxNum = 0;
  for (const p of existingPorts) {
    const match = p.id.match(/^p(\d+)$/);
    if (match) {
      maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
  }
  return `p${maxNum + 1}`;
}

const useNodeEditorStore = create<NodeEditorState>()(
  temporal(
    (set, get) => ({
      nodes: [],
      edges: [],
      subMode: "generic",
      nextIdCounter: 0,
      showLogicalName: false,
      pages: [createPage(DEFAULT_PAGE_ID, DEFAULT_PAGE_NAME)],
      activePageId: DEFAULT_PAGE_ID,

      // Node actions
      addNode: (kind, position) => {
        const state = get();
        const id = counterToId(state.nextIdCounter);
        const pos = position ?? { x: 200, y: 200 };

        const newNode: NodeEditorNode = {
          id,
          type: "cardNode",
          position: pos,
          data: {
            label: kind === "table" ? "table_name" : kind === "service" ? "ServiceName" : `Node ${id}`,
            kind,
            ports: createDefaultPorts(kind),
            isNew: true,
          },
          width: NODE_EDITOR_DEFAULT_NODE_WIDTH,
          height: NODE_EDITOR_DEFAULT_NODE_HEIGHT,
        };

        set({
          nodes: [...state.nodes, newNode],
          nextIdCounter: state.nextIdCounter + 1,
        });

        // Clear isNew flag after animation
        setTimeout(() => {
          set((s) => ({
            nodes: s.nodes.map((n) =>
              n.id === id ? { ...n, data: { ...n.data, isNew: false } } : n
            ),
          }));
        }, 300);
      },

      removeNodes: (ids) => {
        const idSet = new Set(ids);
        set((state) => ({
          nodes: state.nodes.filter((n) => !idSet.has(n.id)),
          edges: state.edges.filter(
            (e) => !idSet.has(e.source) && !idSet.has(e.target)
          ),
        }));
      },

      updateNodeLabel: (id, label) => {
        set((state) => ({
          nodes: state.nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, label } } : n
          ),
        }));
      },

      updateNodeStyle: (id, style) => {
        set((state) => ({
          nodes: state.nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, ...style } } : n
          ),
        }));
      },

      duplicateNodes: (ids) => {
        const state = get();
        const idSet = new Set(ids);
        const nodesToDuplicate = state.nodes.filter((n) => idSet.has(n.id));
        const newNodes: NodeEditorNode[] = [];
        let counter = state.nextIdCounter;
        const idMap = new Map<string, string>();

        for (const node of nodesToDuplicate) {
          const newId = counterToId(counter);
          idMap.set(node.id, newId);
          newNodes.push({
            ...node,
            id: newId,
            position: {
              x: (node.position?.x ?? 0) + 40,
              y: (node.position?.y ?? 0) + 40,
            },
            data: { ...node.data, isNew: true },
            selected: false,
          });
          counter++;
        }

        // Duplicate edges between selected nodes
        const newEdges: NodeEditorEdge[] = [];
        let edgeIdx = 0;
        for (const edge of state.edges) {
          if (idMap.has(edge.source) && idMap.has(edge.target)) {
            newEdges.push({
              ...edge,
              id: `${idMap.get(edge.source)}-${idMap.get(edge.target)}-dup${edgeIdx++}`,
              source: idMap.get(edge.source)!,
              target: idMap.get(edge.target)!,
            });
          }
        }

        set({
          nodes: [...state.nodes, ...newNodes],
          edges: [...state.edges, ...newEdges],
          nextIdCounter: counter,
        });
      },

      // Port actions
      addPort: (nodeId, direction) => {
        set((state) => ({
          nodes: state.nodes.map((n) => {
            if (n.id !== nodeId) return n;
            const newPort: NodeEditorPort = {
              id: generatePortId(n.data.ports),
              name: direction === "input" ? "input" : direction === "output" ? "output" : "port",
              direction,
            };
            return { ...n, data: { ...n.data, ports: [...n.data.ports, newPort] } };
          }),
        }));
      },

      removePort: (nodeId, portId) => {
        set((state) => ({
          nodes: state.nodes.map((n) => {
            if (n.id !== nodeId) return n;
            return {
              ...n,
              data: {
                ...n.data,
                ports: n.data.ports.filter((p) => p.id !== portId),
              },
            };
          }),
          // Remove edges connected to the removed port
          edges: state.edges.filter((e) => {
            if (e.source === nodeId && e.data?.sourcePortId === portId) return false;
            if (e.target === nodeId && e.data?.targetPortId === portId) return false;
            return true;
          }),
        }));
      },

      updatePort: (nodeId, portId, updates) => {
        set((state) => ({
          nodes: state.nodes.map((n) => {
            if (n.id !== nodeId) return n;
            return {
              ...n,
              data: {
                ...n.data,
                ports: n.data.ports.map((p) =>
                  p.id === portId ? { ...p, ...updates } : p
                ),
              },
            };
          }),
        }));
      },

      // Edge actions
      addEdge: (source, target, sourceHandle, targetHandle) => {
        const state = get();
        // Extract port IDs from handle IDs (format: "port-{portId}-source/target")
        const sourcePortId = sourceHandle?.match(/^port-(.+)-(source|target)$/)?.[1];
        const targetPortId = targetHandle?.match(/^port-(.+)-(source|target)$/)?.[1];

        const id = `${source}-${target}-${sourcePortId ?? "node"}-${targetPortId ?? "node"}`;

        // Prevent duplicate edges
        if (state.edges.some((e) => e.id === id)) return;

        // Check if both ends are table nodes — no arrow for ER diagram
        const sourceNode = state.nodes.find((n) => n.id === source);
        const targetNode = state.nodes.find((n) => n.id === target);
        const isTableEdge = sourceNode?.data.kind === "table" && targetNode?.data.kind === "table";

        const newEdge: NodeEditorEdge = {
          id,
          source,
          target,
          sourceHandle,
          targetHandle,
          type: "cardinality",
          ...(isTableEdge ? {} : { markerEnd: { type: MarkerType.ArrowClosed } }),
          data: {
            sourcePortId,
            targetPortId,
          },
        };

        set({ edges: [...state.edges, newEdge] });
      },

      removeEdges: (ids) => {
        const idSet = new Set(ids);
        set((state) => ({
          edges: state.edges.filter((e) => !idSet.has(e.id)),
        }));
      },

      updateEdgeData: (id, updates) => {
        set((state) => ({
          edges: state.edges.map((e) =>
            e.id === id ? { ...e, data: { ...e.data, ...updates } } : e
          ),
        }));
      },

      // React Flow callbacks
      onNodesChange: (changes) => {
        set((state) => ({
          nodes: applyNodeChanges(changes, state.nodes) as NodeEditorNode[],
        }));
      },

      onEdgesChange: (changes) => {
        set((state) => ({
          edges: applyEdgeChanges(changes, state.edges) as NodeEditorEdge[],
        }));
      },

      // Sub-mode
      setSubMode: (mode) => set({ subMode: mode }),

      // Page actions
      addPage: () => {
        const state = get();
        const id = `page-${Date.now()}`;
        const newPage = createPage(id, `Page ${state.pages.length + 1}`);
        set({
          pages: [...composePages(state), newPage],
          activePageId: id,
          nodes: [],
          edges: [],
          nextIdCounter: 0,
        });
      },

      importAsNewPage: (name, nodes, edges, nextIdCounter) => {
        const state = get();
        const id = `page-${Date.now()}`;
        const newPage: NodeEditorPage = { id, name, nodes, edges, nextIdCounter };
        set({
          pages: [...composePages(state), newPage],
          activePageId: id,
          nodes,
          edges,
          nextIdCounter,
        });
      },

      removePage: (id) => {
        const state = get();
        if (state.pages.length <= 1) return;
        const remaining = state.pages.filter((p) => p.id !== id);
        if (id === state.activePageId) {
          // アクティブページ削除時は先頭の残りページに切替
          const next = remaining[0];
          set({
            pages: remaining,
            activePageId: next.id,
            nodes: next.nodes,
            edges: next.edges,
            nextIdCounter: next.nextIdCounter,
          });
        } else {
          set({ pages: remaining });
        }
      },

      renamePage: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((state) => ({
          pages: state.pages.map((p) => (p.id === id ? { ...p, name: trimmed } : p)),
        }));
      },

      setActivePage: (id) => {
        const state = get();
        if (id === state.activePageId) return;
        const target = state.pages.find((p) => p.id === id);
        if (!target) return;
        set({
          pages: composePages(state),
          activePageId: id,
          nodes: target.nodes,
          edges: target.edges,
          nextIdCounter: target.nextIdCounter,
        });
      },

      // Display settings
      toggleShowLogicalName: () => set((s) => ({ showLogicalName: !s.showLogicalName })),

      // State management
      loadState: (loaded) => {
        // Compute safe fallback counter from existing node IDs
        let fallbackCounter = 0;
        if (loaded.nextIdCounter == null) {
          for (const n of loaded.nodes) {
            let counter = 0;
            for (let i = 0; i < n.id.length; i++) {
              counter = counter * 26 + (n.id.charCodeAt(i) - 64);
            }
            fallbackCounter = Math.max(fallbackCounter, counter);
          }
        }
        const nextIdCounter = loaded.nextIdCounter ?? fallbackCounter;

        // pages付きデータ（v2）/ 旧形式（v1: 単一ページとして移行）の両対応
        let pages: NodeEditorPage[];
        let activePageId: string;
        if (loaded.pages && loaded.pages.length > 0) {
          pages = loaded.pages;
          activePageId =
            loaded.activePageId && pages.some((p) => p.id === loaded.activePageId)
              ? loaded.activePageId
              : pages[0].id;
        } else {
          pages = [{
            id: DEFAULT_PAGE_ID,
            name: DEFAULT_PAGE_NAME,
            nodes: loaded.nodes,
            edges: loaded.edges,
            nextIdCounter,
          }];
          activePageId = DEFAULT_PAGE_ID;
        }
        const active = pages.find((p) => p.id === activePageId)!;

        set({
          nodes: active.nodes,
          edges: active.edges,
          subMode: loaded.subMode ?? "generic",
          nextIdCounter: active.nextIdCounter,
          pages,
          activePageId,
        });
      },

      loadIntoActivePage: (loaded) => {
        // liveコピーのみ差し替え（pagesへの反映は次回compose時に行われる）
        set({
          nodes: loaded.nodes,
          edges: loaded.edges,
          nextIdCounter: loaded.nextIdCounter,
        });
      },

      clearAll: () => {
        set({
          nodes: [],
          edges: [],
          nextIdCounter: 0,
        });
      },
    }),
    {
      partialize: (state) => ({
        nodes: state.nodes.map((n) => ({
          ...n,
          data: { ...n.data, isNew: undefined, isDeleting: undefined },
        })),
        edges: state.edges,
        subMode: state.subMode,
        nextIdCounter: state.nextIdCounter,
        pages: state.pages,
        activePageId: state.activePageId,
      }),
      limit: 50,
    }
  )
);

export { useNodeEditorStore };
