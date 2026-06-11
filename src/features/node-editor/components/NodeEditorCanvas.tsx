"use client";

import { useCallback, useRef, useState, useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ConnectionMode,
  SelectionMode,
  type Connection,
  type EdgeMouseHandler,
} from "@xyflow/react";
import { useNodeEditorStore } from "../store/useNodeEditorStore";
import type { NodeEditorNode, NodeEditorEdge } from "../store/types";
import { CardNode } from "./CardNode";
import { CardinalityEdge } from "./CardinalityEdge";
import { EdgeContextMenu } from "./EdgeContextMenu";
import { MIN_ZOOM, MAX_ZOOM, ZOOM_ACTIVATION_KEY_CODE } from "@/lib/constants";

const nodeTypes = {
  cardNode: CardNode,
};

const edgeTypes = {
  cardinality: CardinalityEdge,
};

const defaultEdgeOptions = {
  type: "cardinality" as const,
  selectable: true,
  interactionWidth: 20,
};

interface ContextMenuState {
  edgeId: string;
  x: number;
  y: number;
}

export function NodeEditorCanvas() {
  const nodes = useNodeEditorStore((s) => s.nodes);
  const edges = useNodeEditorStore((s) => s.edges);
  const onNodesChange = useNodeEditorStore((s) => s.onNodesChange);
  const onEdgesChange = useNodeEditorStore((s) => s.onEdgesChange);
  const addEdge = useNodeEditorStore((s) => s.addEdge);
  const removeNodes = useNodeEditorStore((s) => s.removeNodes);
  const removeEdges = useNodeEditorStore((s) => s.removeEdges);

  const isDraggingRef = useRef(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Compute related node IDs for focus dimming
  const selectedNodeIds = useMemo(
    () => nodes.filter((n) => n.selected).map((n) => n.id),
    [nodes]
  );

  const relatedNodeIds = useMemo(() => {
    if (selectedNodeIds.length === 0) return null;
    const selected = new Set(selectedNodeIds);
    const related = new Set(selectedNodeIds);
    for (const edge of edges) {
      if (selected.has(edge.source)) related.add(edge.target);
      if (selected.has(edge.target)) related.add(edge.source);
    }
    return related;
  }, [selectedNodeIds, edges]);

  // Apply dimming via style to unrelated nodes/edges
  const styledNodes = useMemo(() => {
    if (!relatedNodeIds) return nodes;
    return nodes.map((n) => ({
      ...n,
      style: {
        ...n.style,
        opacity: relatedNodeIds.has(n.id) ? 1 : 0.25,
        transition: "opacity 0.2s ease",
      },
    }));
  }, [nodes, relatedNodeIds]);

  const styledEdges = useMemo(() => {
    if (!relatedNodeIds) return edges;
    return edges.map((e) => ({
      ...e,
      style: {
        ...e.style,
        opacity: relatedNodeIds.has(e.source) && relatedNodeIds.has(e.target) ? 1 : 0.15,
        transition: "opacity 0.2s ease",
      },
    }));
  }, [edges, relatedNodeIds]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        addEdge(
          connection.source,
          connection.target,
          connection.sourceHandle,
          connection.targetHandle
        );
      }
    },
    [addEdge]
  );

  const onNodesDelete = useCallback(
    (deleted: NodeEditorNode[]) => {
      removeNodes(deleted.map((n) => n.id));
    },
    [removeNodes]
  );

  const onEdgesDelete = useCallback(
    (deleted: NodeEditorEdge[]) => {
      removeEdges(deleted.map((e) => e.id));
    },
    [removeEdges]
  );

  const onNodeDragStart = useCallback(() => {
    isDraggingRef.current = true;
    useNodeEditorStore.temporal.getState().pause();
  }, []);

  const onNodeDragStop = useCallback(() => {
    isDraggingRef.current = false;
    useNodeEditorStore.temporal.getState().resume();
  }, []);

  const onEdgeContextMenu: EdgeMouseHandler = useCallback((event, edge) => {
    event.preventDefault();
    setContextMenu({ edgeId: edge.id, x: event.clientX, y: event.clientY });
  }, []);

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  return (
    <>
      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionMode={ConnectionMode.Loose}
        connectOnClick={false}
        panOnDrag={[1, 2]}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        selectionKeyCode={null}
        zoomActivationKeyCode={ZOOM_ACTIVATION_KEY_CODE}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
      </ReactFlow>

      {contextMenu && (
        <EdgeContextMenu
          edgeId={contextMenu.edgeId}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
