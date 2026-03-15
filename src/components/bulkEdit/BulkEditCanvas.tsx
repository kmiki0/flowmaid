"use client";

import { memo, useEffect, useCallback, useMemo, useState, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Panel,
  useReactFlow,
  SelectionMode,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import { ArrowLeft } from "lucide-react";
import { useLocale } from "@/lib/i18n/useLocale";
import { useFlowStore } from "@/store/useFlowStore";
import { nodeTypes } from "@/components/nodes/nodeTypes";
import { edgeTypes } from "@/components/edges/edgeTypes";
import { useCtrlSelection } from "@/hooks/useCtrlSelection";

interface BulkEditCanvasInnerProps {
  focusTarget: { type: "node" | "edge"; id: string } | null;
  highlightId: string | null;
  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  onPaneClick?: () => void;
  onExit?: () => void;
}

const FOCUS_PADDING = 1.0;
const FIT_DURATION = 300;
const DEFAULT_NODE_SIZE = 150;
const PAN_ON_DRAG_BUTTONS = [1, 2]; // middle + right mouse buttons
const MULTI_SELECTION_KEY_CODE: string[] = ["Control", "Meta"];

const BulkEditCanvasInner = memo(function BulkEditCanvasInner({
  focusTarget,
  highlightId,
  onNodeClick,
  onEdgeClick,
  onSelectionChange,
  onPaneClick,
  onExit,
}: BulkEditCanvasInnerProps) {
  const { t } = useLocale();
  const storeNodes = useFlowStore((s) => s.nodes);
  const storeEdges = useFlowStore((s) => s.edges);
  const { fitBounds, getNodes, getEdges } = useReactFlow();

  // --- Selection state (local) ---
  const [localSelectedIds, setLocalSelectedIds] = useState<Set<string>>(new Set());
  const localSelectedIdsRef = useRef<Set<string>>(new Set());
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  const storeNodesRef = useRef(storeNodes);
  storeNodesRef.current = storeNodes;
  const storeEdgesRef = useRef(storeEdges);
  storeEdgesRef.current = storeEdges;

  const updateSelection = useCallback((next: Set<string>) => {
    localSelectedIdsRef.current = next;
    setLocalSelectedIds(next);
    onSelectionChangeRef.current?.(Array.from(next));
  }, []);

  // --- Shared selection logic ---
  const {
    handleNodeClick,
    handleEdgeClick,
    handlePaneClick,
    handleSelectionStart,
    handleSelectionEnd,
    processNodesChanges,
    processEdgesChanges,
  } = useCtrlSelection({
    getSelectedIds: () => localSelectedIdsRef.current,
    setSelectedIds: updateSelection,
    getEdges: () => storeEdgesRef.current,
    getAllSelectableIds: () => {
      const ids = new Set<string>();
      for (const n of storeNodesRef.current) ids.add(n.id);
      for (const e of storeEdgesRef.current) {
        if (!e.data?.isBridgeEdge) ids.add(e.id);
      }
      return ids;
    },
    highlightId,
    onNormalNodeClick: onNodeClick,
    onNormalEdgeClick: onEdgeClick,
    onNormalPaneClick: onPaneClick,
  });

  // When multi-selection is active, show selection; otherwise show single highlight
  const nodes = useMemo(
    () =>
      storeNodes.map((n) => ({
        ...n,
        selected: localSelectedIds.size > 0
          ? localSelectedIds.has(n.id)
          : n.id === highlightId,
      })),
    [storeNodes, highlightId, localSelectedIds]
  );

  const edges = useMemo(
    () =>
      storeEdges.map((e) => ({
        ...e,
        selected: localSelectedIds.size > 0
          ? localSelectedIds.has(e.id)
          : e.id === highlightId,
      })),
    [storeEdges, highlightId, localSelectedIds]
  );

  // --- Wrap processNodesChanges / processEdgesChanges as OnNodesChange / OnEdgesChange ---
  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => { processNodesChanges(changes); },
    [processNodesChanges],
  );

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => { processEdgesChanges(changes); },
    [processEdgesChanges],
  );

  // --- Focus / zoom ---
  useEffect(() => {
    if (!focusTarget) return;

    if (focusTarget.type === "node") {
      const node = getNodes().find((n) => n.id === focusTarget.id);
      if (!node) return;
      const width = node.measured?.width ?? node.width ?? 150;
      const height = node.measured?.height ?? node.height ?? 50;
      fitBounds(
        { x: node.position.x, y: node.position.y, width, height },
        { padding: FOCUS_PADDING, duration: FIT_DURATION }
      );
    } else {
      // For edges, focus on the midpoint between source and target
      const edge = getEdges().find((e) => e.id === focusTarget.id);
      if (!edge) return;
      const sourceNode = getNodes().find((n) => n.id === edge.source);
      const targetNode = getNodes().find((n) => n.id === edge.target);
      if (!sourceNode || !targetNode) return;
      const sw = sourceNode.measured?.width ?? sourceNode.width ?? DEFAULT_NODE_SIZE;
      const sh = sourceNode.measured?.height ?? sourceNode.height ?? DEFAULT_NODE_SIZE;
      const tw = targetNode.measured?.width ?? targetNode.width ?? DEFAULT_NODE_SIZE;
      const th = targetNode.measured?.height ?? targetNode.height ?? DEFAULT_NODE_SIZE;
      const x = Math.min(sourceNode.position.x, targetNode.position.x);
      const y = Math.min(sourceNode.position.y, targetNode.position.y);
      const width = Math.max(sourceNode.position.x + sw, targetNode.position.x + tw) - x;
      const height = Math.max(sourceNode.position.y + sh, targetNode.position.y + th) - y;
      fitBounds(
        { x, y, width, height },
        { padding: FOCUS_PADDING, duration: FIT_DURATION }
      );
    }
  }, [focusTarget, fitBounds, getNodes, getEdges]);

  return (
    <div className="h-full w-full bulk-edit-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        connectOnClick={false}
        selectionOnDrag
        panOnDrag={PAN_ON_DRAG_BUTTONS}
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode={MULTI_SELECTION_KEY_CODE}
        zoomOnScroll
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onSelectionStart={handleSelectionStart}
        onSelectionEnd={handleSelectionEnd}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        {onExit && (
          <Panel position="top-left">
            <button
              onClick={onExit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-background/80 border border-border text-xs text-foreground backdrop-blur-sm hover:bg-accent cursor-pointer"
            >
              <ArrowLeft size={14} />
              {t("exitBulkEdit")}
            </button>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
});

interface BulkEditCanvasProps {
  focusTarget: { type: "node" | "edge"; id: string } | null;
  highlightId: string | null;
  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  onPaneClick?: () => void;
  onExit?: () => void;
}

/** Nested ReactFlowProvider creates an isolated instance separate from
 *  EditorLayout's provider. This is intentional — BulkEditCanvas is read-only
 *  and needs its own fitBounds/getNodes without interfering with the main canvas. */
export const BulkEditCanvas = memo(function BulkEditCanvas({
  focusTarget,
  highlightId,
  onNodeClick,
  onEdgeClick,
  onSelectionChange,
  onPaneClick,
  onExit,
}: BulkEditCanvasProps) {
  return (
    <ReactFlowProvider>
      <BulkEditCanvasInner
        focusTarget={focusTarget}
        highlightId={highlightId}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onSelectionChange={onSelectionChange}
        onPaneClick={onPaneClick}
        onExit={onExit}
      />
    </ReactFlowProvider>
  );
});
