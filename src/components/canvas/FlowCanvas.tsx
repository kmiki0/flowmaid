"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  ConnectionMode,
  SelectionMode,
  Position,
  getBezierPath,
  type Connection,
  type ReactFlowInstance,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  type Viewport,
  type ConnectionLineComponentProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useFlowStore } from "@/store/useFlowStore";
import { perfCount, perfStart, perfEnd } from "@/lib/perf";
import type { FlowNode, FlowEdge } from "@/store/types";
import { nodeTypes } from "@/components/nodes/nodeTypes";
import { edgeTypes } from "@/components/edges/edgeTypes";
import { useDnDContext } from "./DnDContext";
import { ContextMenu, useContextMenu } from "./ContextMenu";
import { useSnapGuides } from "@/hooks/useSnapGuides";
import { SnapGuides } from "./SnapGuides";
import { MINIMAP_STORAGE_KEY } from "@/lib/constants";
import { useCtrlSelection } from "@/hooks/useCtrlSelection";
import { Map } from "lucide-react";

// Module-level state for reconnection: fixed endpoint position
let reconnectFixedEnd: { x: number; y: number; position: import("@xyflow/react").Position } | null = null;

function inferTargetPosition(sourceX: number, sourceY: number, targetX: number, targetY: number): Position {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? Position.Left : Position.Right;
  }
  return dy > 0 ? Position.Top : Position.Bottom;
}

function ReconnectConnectionLine({ fromX, fromY, toX, toY, fromPosition, toPosition }: ConnectionLineComponentProps<FlowNode>) {
  let startX: number, startY: number, endX: number, endY: number;
  let startPos = fromPosition;
  let endPos = toPosition;

  if (reconnectFixedEnd) {
    // During reconnection: draw from fixed end to cursor
    startX = reconnectFixedEnd.x;
    startY = reconnectFixedEnd.y;
    startPos = reconnectFixedEnd.position;
    endX = toX;
    endY = toY;
    // Infer target position from direction so bezier doesn't overshoot cursor
    endPos = inferTargetPosition(startX, startY, endX, endY);
  } else {
    // Normal connection: draw from drag origin to cursor
    startX = fromX;
    startY = fromY;
    endX = toX;
    endY = toY;
    endPos = inferTargetPosition(startX, startY, endX, endY);
  }

  const [path] = getBezierPath({
    sourceX: startX,
    sourceY: startY,
    sourcePosition: startPos,
    targetX: endX,
    targetY: endY,
    targetPosition: endPos,
  });

  return (
    <g>
      <path d={path} fill="none" stroke="var(--primary)" strokeWidth={2} strokeDasharray="6 3" />
    </g>
  );
}

export function FlowCanvas() {
  perfCount("FlowCanvas");
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const onNodesChange = useFlowStore((s) => s.onNodesChange);
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange);
  const addEdge = useFlowStore((s) => s.addEdge);
  const addNode = useFlowStore((s) => s.addNode);
  const reconnectEdge = useFlowStore((s) => s.reconnectEdge);

  const placeComponentInstance = useFlowStore((s) => s.placeComponentInstance);
  const [dragPayload] = useDnDContext();
  const reactFlowInstance = useRef<ReactFlowInstance<FlowNode, FlowEdge> | null>(null);
  const { menu, open: openMenu, close: closeMenu } = useContextMenu();
  const { guides, onNodeDrag, applySnap, clearGuides } = useSnapGuides(nodes);

  // Minimap toggle (persisted in localStorage, default: hidden)
  const [showMinimap, setShowMinimap] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(MINIMAP_STORAGE_KEY) === "true";
  });
  const toggleMinimap = useCallback(() => {
    setShowMinimap((prev) => {
      const next = !prev;
      localStorage.setItem(MINIMAP_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  // Track edge reconnection initiated from ring handles
  const reconnectingEdgeRef = useRef<FlowEdge | null>(null);
  const reconnectingTypeRef = useRef<"source" | "target" | null>(null);

  const setEdgeVisibility = useCallback((edgeId: string | null, hidden: boolean) => {
    if (!edgeId) return;
    const edgeEl = document.querySelector(`.react-flow__edge[data-id="${CSS.escape(edgeId)}"]`);
    if (hidden) {
      edgeEl?.classList.add("reconnecting");
    } else {
      edgeEl?.classList.remove("reconnecting");
    }
  }, []);

  const onConnectStart = useCallback(
    (_event: MouseEvent | TouchEvent, params: { nodeId: string | null; handleId: string | null; handleType: "source" | "target" | null }) => {
      if (!params.nodeId || !params.handleId || !params.handleType) return;
      const currentEdges = useFlowStore.getState().edges;
      // Reconnect priority:
      // 1. Selected edge at this position (same pos, either source or target handle) → always reconnect
      //    Handles at the same position overlap visually, so user may grab the "wrong" one
      // 2. Exactly one edge on the dragged handle → reconnect it
      // 3. Multiple edges on handle + one selected → reconnect the selected one
      // 4. Otherwise → new connection mode
      const handlePos = params.handleId.split("-")[0]; // e.g. "bottom" from "bottom-source"
      const sourceHandleId = `${handlePos}-source`;
      const targetHandleId = `${handlePos}-target`;

      // Priority 1: selected edge at this position (check both source and target handles)
      const selectedAtPos = currentEdges.find((e) => {
        if (!e.selected || e.data?.isBridgeEdge) return false;
        return (e.source === params.nodeId && e.sourceHandle === sourceHandleId) ||
               (e.target === params.nodeId && e.targetHandle === targetHandleId);
      });

      let connectedEdge: FlowEdge | undefined;
      let actualReconnectType: "source" | "target" | null = null;

      if (selectedAtPos) {
        connectedEdge = selectedAtPos;
        // Determine which side of the edge connects to this node at this position
        actualReconnectType = (selectedAtPos.source === params.nodeId && selectedAtPos.sourceHandle === sourceHandleId)
          ? "source" : "target";
      } else {
        // Priority 2-3: fall back to edges on the exact dragged handle
        const edgesOnHandle = currentEdges.filter((e) => {
          if (e.data?.isBridgeEdge) return false;
          if (params.handleType === "source") return e.source === params.nodeId && e.sourceHandle === params.handleId;
          return e.target === params.nodeId && e.targetHandle === params.handleId;
        });
        connectedEdge = edgesOnHandle.length === 1
          ? edgesOnHandle[0]
          : edgesOnHandle.find((e) => e.selected);
        actualReconnectType = connectedEdge ? params.handleType : null;
      }

      reconnectingEdgeRef.current = connectedEdge ?? null;
      reconnectingTypeRef.current = actualReconnectType;
      reconnectFixedEnd = null;
      if (connectedEdge && actualReconnectType) {
        setEdgeVisibility(connectedEdge.id, true);
        // Calculate the FIXED endpoint (the end NOT being dragged) for connection line rendering
        const fixedType = actualReconnectType === "source" ? "target" : "source";
        const fixedNodeId = fixedType === "source" ? connectedEdge.source : connectedEdge.target;
        const fixedHandleId = fixedType === "source" ? connectedEdge.sourceHandle : connectedEdge.targetHandle;
        if (fixedNodeId && fixedHandleId && reactFlowInstance.current) {
          const handleEl = document.querySelector(
            `.react-flow__node[data-id="${CSS.escape(fixedNodeId)}"] .react-flow__handle[data-handleid="${CSS.escape(fixedHandleId)}"]`
          );
          if (handleEl) {
            const rect = handleEl.getBoundingClientRect();
            const pos = reactFlowInstance.current.screenToFlowPosition({
              x: rect.x + rect.width / 2,
              y: rect.y + rect.height / 2,
            });
            // Determine the Position enum from handle ID (e.g. "top-source" → Position.Top)
            const posStr = fixedHandleId.split("-")[0] as "top" | "right" | "bottom" | "left";
            const posMap: Record<string, import("@xyflow/react").Position> = {
              top: Position.Top, right: Position.Right, bottom: Position.Bottom, left: Position.Left,
            };
            reconnectFixedEnd = { x: pos.x, y: pos.y, position: posMap[posStr] ?? Position.Top };
          }
        }
      }
    },
    [setEdgeVisibility]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const oldEdge = reconnectingEdgeRef.current;
      const reconnectType = reconnectingTypeRef.current;
      if (oldEdge && reconnectType) {
        // Determine which node in the connection is the new drop target
        const origNodeId = reconnectType === "source" ? oldEdge.source : oldEdge.target;
        const oldHandleId = reconnectType === "source" ? oldEdge.sourceHandle : oldEdge.targetHandle;

        let newNodeId: string;
        let newHandle: string | null;

        if (connection.source === connection.target) {
          // Same node: pick the handle that differs from the original
          newNodeId = connection.source!;
          const candidate = [connection.sourceHandle, connection.targetHandle].find(h => h && h !== oldHandleId);
          newHandle = candidate ?? null;
        } else {
          newNodeId = connection.source === origNodeId ? connection.target! : connection.source!;
          newHandle = connection.source === origNodeId ? connection.targetHandle : connection.sourceHandle;
        }

        // Normalize handle ID suffix: React Flow may swap source/target in the connection object,
        // so the handle ID might have the wrong type suffix (e.g. "top-source" when we need "top-target")
        if (newHandle) {
          const pos = newHandle.split("-")[0];
          newHandle = `${pos}-${reconnectType}`;
        }

        // Guard: if no valid handle found, abort reconnection
        if (!newHandle) return;

        const newConnection: Connection = reconnectType === "source"
          ? { source: newNodeId, sourceHandle: newHandle, target: oldEdge.target, targetHandle: oldEdge.targetHandle ?? null }
          : { source: oldEdge.source, sourceHandle: oldEdge.sourceHandle ?? null, target: newNodeId, targetHandle: newHandle };

        reconnectEdge(oldEdge, newConnection);
        setEdgeVisibility(oldEdge.id, false);
        reconnectingEdgeRef.current = null;
        reconnectingTypeRef.current = null;
        reconnectFixedEnd = null;
      } else {
        // Normalize handle IDs: React Flow may swap source/target when dragging from a target handle,
        // causing sourceHandle to have "-target" suffix and vice versa
        let srcHandle = connection.sourceHandle;
        let tgtHandle = connection.targetHandle;
        if (srcHandle) {
          const pos = srcHandle.split("-")[0];
          srcHandle = `${pos}-source`;
        }
        if (tgtHandle) {
          const pos = tgtHandle.split("-")[0];
          tgtHandle = `${pos}-target`;
        }
        addEdge(
          connection.source,
          connection.target,
          undefined,
          srcHandle,
          tgtHandle,
        );
      }
    },
    [addEdge, reconnectEdge, setEdgeVisibility]
  );

  const onConnectEnd = useCallback(() => {
    if (reconnectingEdgeRef.current) {
      setEdgeVisibility(reconnectingEdgeRef.current.id, false);
      reconnectingEdgeRef.current = null;
      reconnectingTypeRef.current = null;
    }
    reconnectFixedEnd = null;
  }, [setEdgeVisibility]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (!dragPayload || !reactFlowInstance.current) return;

      const position = reactFlowInstance.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      if (dragPayload.kind === "component") {
        placeComponentInstance(dragPayload.value, position);
      } else {
        addNode(dragPayload.value, position);
      }
    },
    [dragPayload, addNode, placeComponentInstance]
  );

  const onNodeDragStart = useCallback(() => {
    useFlowStore.temporal.getState().pause();
  }, []);

  const onNodeDragStop = useCallback(
    () => {
      useFlowStore.temporal.getState().resume();
      clearGuides();
    },
    [clearGuides]
  );

  // --- Shared Ctrl+click / Ctrl+drag selection logic ---
  const {
    handleNodeClick,
    handleEdgeClick,
    handleSelectionStart: onSelectionStart,
    handleSelectionEnd: onSelectionEnd,
    processNodesChanges,
    processEdgesChanges,
  } = useCtrlSelection({
    getSelectedIds: () => {
      const state = useFlowStore.getState();
      const ids = new Set<string>();
      for (const n of state.nodes) { if (n.selected) ids.add(n.id); }
      for (const e of state.edges) { if (e.selected) ids.add(e.id); }
      return ids;
    },
    setSelectedIds: (ids) => {
      const t = perfStart("setSelectedIds");
      const state = useFlowStore.getState();
      let nodesChanged = false;
      const nextNodes = state.nodes.map((n) => {
        const shouldSelect = ids.has(n.id);
        if (n.selected === shouldSelect) return n;
        nodesChanged = true;
        return { ...n, selected: shouldSelect };
      });
      let edgesChanged = false;
      const nextEdges = state.edges.map((e) => {
        const shouldSelect = ids.has(e.id);
        if (e.selected === shouldSelect) return e;
        edgesChanged = true;
        return { ...e, selected: shouldSelect };
      });
      if (nodesChanged || edgesChanged) {
        useFlowStore.setState({
          ...(nodesChanged ? { nodes: nextNodes } : {}),
          ...(edgesChanged ? { edges: nextEdges } : {}),
        });
      }
      perfEnd("setSelectedIds", t);
    },
    getEdges: () => useFlowStore.getState().edges,
    // No Ctrl+A (handled by useKeyboardShortcuts)
    // No highlightId (main canvas uses store's selected)
    // No onNormalNodeClick (let ReactFlow handle normal clicks)
  });

  const onNodesChangeWithSnap = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      const t = perfStart("onNodesChangeWithSnap");
      const remaining = processNodesChanges(changes);
      if (remaining.length > 0) {
        onNodesChange(applySnap(remaining));
      }
      perfEnd("onNodesChangeWithSnap", t);
    },
    [onNodesChange, applySnap, processNodesChanges]
  );

  const onEdgesChangeWithSelection = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      const remaining = processEdgesChanges(changes);
      if (remaining.length > 0) {
        onEdgesChange(remaining);
      }
    },
    [onEdgesChange, processEdgesChanges]
  );

  const onNodeContextMenu: NodeMouseHandler<FlowNode> = useCallback(
    (event, node) => {
      event.preventDefault();
      // Skip context menu for component child nodes (preview-only)
      if (node.data.componentParentId) return;
      const selectedNodeIds = nodes.filter((n) => n.selected).map((n) => n.id);
      const ids = selectedNodeIds.includes(node.id) ? selectedNodeIds : [node.id];
      openMenu(event as unknown as React.MouseEvent, ids, []);
    },
    [nodes, openMenu]
  );

  const onEdgeContextMenu: EdgeMouseHandler<FlowEdge> = useCallback(
    (event, edge) => {
      event.preventDefault();
      // Skip context menu for bridge edges and internal component edges
      if (edge.data?.isBridgeEdge) return;
      if (edge.selectable === false) return;
      const selectedEdgeIds = edges.filter((e) => e.selected).map((e) => e.id);
      const ids = selectedEdgeIds.includes(edge.id) ? selectedEdgeIds : [edge.id];
      openMenu(event as unknown as React.MouseEvent, [], ids);
    },
    [edges, openMenu]
  );

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      const selectedNodeIds = nodes.filter((n) => n.selected).map((n) => n.id);
      const selectedEdgeIds = edges.filter((e) => e.selected).map((e) => e.id);
      openMenu(event as React.MouseEvent, selectedNodeIds, selectedEdgeIds);
    },
    [nodes, edges, openMenu]
  );

  // Shift+Wheel → horizontal scroll
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.shiftKey || !reactFlowInstance.current) return;
      e.preventDefault();
      e.stopPropagation();
      const { x, y, zoom } = reactFlowInstance.current.getViewport();
      reactFlowInstance.current.setViewport({ x: x - e.deltaY * zoom * 0.5, y, zoom });
    };
    el.addEventListener("wheel", handler, { passive: false, capture: true });
    return () => el.removeEventListener("wheel", handler, { capture: true });
  }, []);

  // Listen for fitview events
  useEffect(() => {
    const handler = () => {
      reactFlowInstance.current?.fitView({ padding: 0.2 });
    };
    window.addEventListener("flowmaid:fitview", handler);
    return () => window.removeEventListener("flowmaid:fitview", handler);
  }, []);

  return (
    <div ref={wrapperRef} className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeWithSnap}
        onEdgesChange={onEdgesChangeWithSelection}
        onConnectStart={onConnectStart}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onInit={(instance) => {
          reactFlowInstance.current = instance;
          const { zoom } = instance.getViewport();
          document.documentElement.style.setProperty("--rf-zoom", String(zoom));
        }}
        onViewportChange={(viewport: Viewport) => {
          document.documentElement.style.setProperty("--rf-zoom", String(viewport.zoom));
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onSelectionStart={onSelectionStart}
        onSelectionEnd={onSelectionEnd}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: "labeled" }}
        connectionMode={ConnectionMode.Loose}
        connectOnClick={false}
        panOnDrag={[1, 2]}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        fitView
        connectionLineComponent={ReconnectConnectionLine}
        deleteKeyCode="Delete"
        multiSelectionKeyCode={["Control", "Meta"]}
      >
        <Background />
        <Controls />
        <Panel position="bottom-right" className="!bottom-2.5 !right-2.5">
          <div className="minimap-container">
            <div className={`minimap-wrapper ${showMinimap ? "minimap-open" : "minimap-closed"}`}>
              <MiniMap pannable zoomable />
            </div>
            <button
              onClick={toggleMinimap}
              className="minimap-toggle"
              title="Minimap"
              aria-label="Toggle minimap"
            >
              <Map size={14} />
            </button>
          </div>
        </Panel>
        <SnapGuides guides={guides} />
      </ReactFlow>
      {menu.position && (
        <ContextMenu
          position={menu.position}
          nodeIds={menu.nodeIds}
          edgeIds={menu.edgeIds}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}
