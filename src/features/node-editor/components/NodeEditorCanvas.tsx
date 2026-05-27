"use client";

import { useCallback, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ConnectionMode,
  type Connection,
  type EdgeMouseHandler,
} from "@xyflow/react";
import { useNodeEditorStore } from "../store/useNodeEditorStore";
import type { NodeEditorNode, NodeEditorEdge } from "../store/types";
import { CardNode } from "./CardNode";
import { CardinalityEdge } from "./CardinalityEdge";
import { EdgeContextMenu } from "./EdgeContextMenu";
import { MIN_ZOOM, MAX_ZOOM } from "@/lib/constants";

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
        nodes={nodes}
        edges={edges}
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
