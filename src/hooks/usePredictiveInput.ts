"use client";

import { useCallback, useMemo } from "react";
import { MarkerType } from "@xyflow/react";
import { useFlowStore } from "@/store/useFlowStore";
import { computeCandidates } from "@/lib/predictive/candidateUtils";
import { PREDICTIVE_GAP_PX, GHOST_NODE_ID, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT, DEFAULT_DIAMOND_SIZE } from "@/lib/constants";
import type { PredictiveDirection, FlowNode, FlowEdge } from "@/store/types";
import type { FlowNodeData } from "@/types/flow";

const GHOST_EDGE_ID = "__ghost_edge__";

const DIRECTION_HANDLES: Record<PredictiveDirection, { sourceHandle: string; targetHandle: string }> = {
  bottom: { sourceHandle: "bottom-source", targetHandle: "top-target" },
  top:    { sourceHandle: "top-source",    targetHandle: "bottom-target" },
  right:  { sourceHandle: "right-source",  targetHandle: "left-target" },
  left:   { sourceHandle: "left-source",   targetHandle: "right-target" },
};

function getNodeSize(node: FlowNode): { w: number; h: number } {
  const w = node.measured?.width ?? (node.style as Record<string, number>)?.width ?? DEFAULT_NODE_WIDTH;
  const h = node.measured?.height ?? (node.style as Record<string, number>)?.height ?? DEFAULT_NODE_HEIGHT;
  return { w, h };
}

function getDefaultSize(shape: string): { width: number; height: number } {
  if (shape === "diamond") return { width: DEFAULT_DIAMOND_SIZE, height: DEFAULT_DIAMOND_SIZE };
  if (shape === "circle") return { width: DEFAULT_NODE_HEIGHT * 2, height: DEFAULT_NODE_HEIGHT * 2 };
  if (shape === "hexagon") return { width: DEFAULT_NODE_WIDTH + 20, height: DEFAULT_NODE_HEIGHT + 10 };
  if (shape === "cylinder") return { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT + 20 };
  if (shape === "document") return { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT + 10 };
  if (shape === "predefinedProcess" || shape === "display") return { width: DEFAULT_NODE_WIDTH + 20, height: DEFAULT_NODE_HEIGHT };
  return { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT };
}

function computeGhostPosition(
  sourceNode: FlowNode,
  direction: PredictiveDirection,
  ghostData: FlowNodeData,
): { x: number; y: number } {
  const { w: srcW, h: srcH } = getNodeSize(sourceNode);
  const ghostSize = getDefaultSize(ghostData.shape);
  const gw = ghostSize.width;
  const gh = ghostSize.height;

  switch (direction) {
    case "bottom":
      return { x: sourceNode.position.x + (srcW - gw) / 2, y: sourceNode.position.y + srcH + PREDICTIVE_GAP_PX };
    case "top":
      return { x: sourceNode.position.x + (srcW - gw) / 2, y: sourceNode.position.y - gh - PREDICTIVE_GAP_PX };
    case "right":
      return { x: sourceNode.position.x + srcW + PREDICTIVE_GAP_PX, y: sourceNode.position.y + (srcH - gh) / 2 };
    case "left":
      return { x: sourceNode.position.x - gw - PREDICTIVE_GAP_PX, y: sourceNode.position.y + (srcH - gh) / 2 };
  }
}

export function usePredictiveInput() {
  const predictiveInput = useFlowStore((s) => s.predictiveInput);
  const setPredictiveInput = useFlowStore((s) => s.setPredictiveInput);
  const clearPredictiveInput = useFlowStore((s) => s.clearPredictiveInput);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const addNodeWithData = useFlowStore((s) => s.addNodeWithData);
  const addEdge = useFlowStore((s) => s.addEdge);

  const sourceNode = useMemo(
    () => predictiveInput.sourceNodeId ? nodes.find((n) => n.id === predictiveInput.sourceNodeId) : null,
    [nodes, predictiveInput.sourceNodeId],
  );

  const candidates = useMemo(
    () => sourceNode ? computeCandidates(sourceNode, edges, nodes) : [],
    [sourceNode, edges, nodes],
  );

  const currentCandidate = candidates[predictiveInput.candidateIndex] ?? null;

  const ghostPosition = useMemo(
    () => sourceNode && predictiveInput.direction && currentCandidate
      ? computeGhostPosition(sourceNode, predictiveInput.direction, currentCandidate.nodeData)
      : null,
    [sourceNode, predictiveInput.direction, currentCandidate],
  );

  const ghostNode: FlowNode | null = useMemo(() => {
    if (!predictiveInput.ghostVisible || !predictiveInput.direction || !currentCandidate || !ghostPosition) return null;
    const size = getDefaultSize(currentCandidate.nodeData.shape);
    const handles = DIRECTION_HANDLES[predictiveInput.direction];
    return {
      id: GHOST_NODE_ID,
      type: currentCandidate.nodeData.shape,
      position: ghostPosition,
      data: { ...currentCandidate.nodeData, label: currentCandidate.nodeData.label || "...", ghostTargetHandle: handles.targetHandle },
      style: { width: size.width, height: size.height },
      selectable: false,
      draggable: false,
    };
  }, [predictiveInput.ghostVisible, predictiveInput.direction, currentCandidate, ghostPosition]);

  const ghostEdge: FlowEdge | null = useMemo(() => {
    if (!ghostNode || !predictiveInput.sourceNodeId || !predictiveInput.direction) return null;
    const handles = DIRECTION_HANDLES[predictiveInput.direction];
    const edgeData = currentCandidate?.edgeData ?? {};
    return {
      id: GHOST_EDGE_ID,
      source: predictiveInput.sourceNodeId,
      target: GHOST_NODE_ID,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      type: "labeled",
      label: edgeData.label,
      style: { strokeDasharray: "6 3" },
      selectable: false,
      markerEnd: { type: MarkerType.ArrowClosed },
      data: {
        edgeType: edgeData.edgeType ?? "bezier",
        markerEnd: edgeData.markerEnd ?? "arrowclosed",
        markerStart: edgeData.markerStart,
        strokeWidth: edgeData.strokeWidth,
        strokeColor: edgeData.strokeColor,
        strokeStyle: "dashed",
      },
    } as FlowEdge;
  }, [ghostNode, predictiveInput.sourceNodeId, predictiveInput.direction, currentCandidate]);

  const onArrowEnter = useCallback((nodeId: string, direction: PredictiveDirection) => {
    setPredictiveInput({
      sourceNodeId: nodeId,
      direction,
      ghostVisible: true,
      candidateIndex: 0,
    });
  }, [setPredictiveInput]);

  const onArrowLeave = useCallback(() => {
    clearPredictiveInput();
  }, [clearPredictiveInput]);

  const onCandidateCycle = useCallback((delta: number) => {
    if (!predictiveInput.ghostVisible || candidates.length === 0) return;
    const next = ((predictiveInput.candidateIndex + delta) % candidates.length + candidates.length) % candidates.length;
    setPredictiveInput({ candidateIndex: next });
  }, [predictiveInput.ghostVisible, predictiveInput.candidateIndex, candidates.length, setPredictiveInput]);

  const onConfirm = useCallback(() => {
    if (!predictiveInput.sourceNodeId || !predictiveInput.direction || !currentCandidate || !ghostPosition) return;

    const newId = addNodeWithData(currentCandidate.nodeData, ghostPosition);
    const handles = DIRECTION_HANDLES[predictiveInput.direction];
    addEdge(
      predictiveInput.sourceNodeId,
      newId,
      currentCandidate.edgeData?.label,
      handles.sourceHandle,
      handles.targetHandle,
      currentCandidate.edgeData,
    );
    clearPredictiveInput();
  }, [predictiveInput, currentCandidate, ghostPosition, addNodeWithData, addEdge, clearPredictiveInput]);

  return {
    predictiveInput,
    ghostNode,
    ghostEdge,
    currentCandidate,
    candidates,
    onArrowEnter,
    onArrowLeave,
    onCandidateCycle,
    onConfirm,
    clearPredictiveInput,
  };
}
