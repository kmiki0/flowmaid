"use client";

import { memo, useMemo, useCallback, useRef, useState, useEffect } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Panel,
  Background,
  useReactFlow,
  type Viewport,
} from "@xyflow/react";
import { ArrowLeft } from "lucide-react";
import { useLocale } from "@/lib/i18n/useLocale";
import { nodeTypes } from "@/components/nodes/nodeTypes";
import { edgeTypes } from "@/components/edges/edgeTypes";
import type { FlowmaidLayout } from "@/lib/flowmaid/schema";
import type { DiffResult, DiffFilters } from "@/lib/diff/types";
import { DIFF_FLASH_DURATION_MS } from "@/lib/diff/types";
import { buildPlainNodesEdges } from "@/lib/diff/buildDiffNodes";
import { DiffBadgeOverlay } from "./DiffBadgeOverlay";
import { DiffGlowOverlay } from "./DiffGlowOverlay";

// ─── Types ───

interface DiffCanvasProps {
  baseLayout: FlowmaidLayout;
  compareLayout: FlowmaidLayout;
  diffResult: DiffResult;
  filters: DiffFilters;
  onExit: () => void;
  baseFileName: string;
  compareFileName: string;
  /** Flash target: set id + type + seq to trigger flash animation */
  flashTarget?: { id: string; type: "node" | "edge"; seq: number } | null;
  /** Opacity for the base flow elements (0-1), overlays are unaffected */
  flowOpacity?: number;
}

interface DiffSingleCanvasProps {
  layout: FlowmaidLayout;
  diffResult: DiffResult;
  filters: DiffFilters;
  side: "base" | "compare";
  fileName: string;
  /** Ref to the other side's setViewport for direct sync */
  otherSetViewportRef: React.MutableRefObject<((vp: Viewport) => void) | null>;
  /** Ref where this side registers its own setViewport */
  selfSetViewportRef: React.MutableRefObject<((vp: Viewport) => void) | null>;
  /** Ref to prevent sync loops (per-side) */
  isSyncingRef: React.MutableRefObject<boolean>;
  onExit?: () => void;
  /** Flash target for click-to-highlight */
  flashTarget?: { id: string; type: "node" | "edge"; seq: number } | null;
  /** Opacity for the base flow elements (0-1) */
  flowOpacity?: number;
}

// ─── DiffSingleCanvas (one side of the side-by-side view) ───

const DiffSingleCanvas = memo(function DiffSingleCanvas({
  layout,
  diffResult,
  filters,
  side,
  fileName,
  otherSetViewportRef,
  selfSetViewportRef,
  isSyncingRef,
  flashTarget,
  flowOpacity = 1,
  onExit,
}: DiffSingleCanvasProps) {
  const { t } = useLocale();
  const { setViewport } = useReactFlow();

  // Register this side's setViewport so the other side can call it directly
  selfSetViewportRef.current = setViewport;

  // Build nodes/edges from layout (highlight is handled by DiffGlowOverlay)
  const { displayNodes, displayEdges } = useMemo(
    () => buildPlainNodesEdges(layout),
    [layout],
  );

  // Sync viewport to the other side on every move (not just moveEnd)
  const handleMove = useCallback(
    (_event: unknown, vp: Viewport) => {
      if (isSyncingRef.current) return;
      const otherSetVp = otherSetViewportRef.current;
      if (!otherSetVp) return;
      isSyncingRef.current = true;
      otherSetVp(vp);
      // Reset syncing flag on next frame
      requestAnimationFrame(() => {
        isSyncingRef.current = false;
      });
    },
    [otherSetViewportRef, isSyncingRef],
  );

  // Edge flash animation (node flash is handled by DiffGlowOverlay)
  const [flashingEdgeIds, setFlashingEdgeIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!flashTarget || flashTarget.type !== "edge") return;
    setFlashingEdgeIds(new Set([flashTarget.id]));
    const timer = setTimeout(() => setFlashingEdgeIds(new Set()), DIFF_FLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [flashTarget]);

  const finalEdges = useMemo(() => {
    if (flashingEdgeIds.size === 0) return displayEdges;
    return displayEdges.map((e) => {
      const isFlashing = flashingEdgeIds.has(e.id) || flashingEdgeIds.has(e.source);
      if (!isFlashing) return e;
      return { ...e, className: "diff-edge-flash" };
    });
  }, [displayEdges, flashingEdgeIds]);

  return (
    <div className="h-full w-full relative diff-canvas-wrapper" style={{ "--diff-flow-opacity": flowOpacity } as React.CSSProperties}>
      <ReactFlow
        nodes={displayNodes}
        edges={finalEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        connectOnClick={false}
        zoomOnScroll
        panOnDrag={[0, 1, 2]}
        fitView
        onMove={handleMove}
        proOptions={{ hideAttribution: true }}
      >
        <Background />

        {/* Back button (left side only) */}
        {onExit && (
          <Panel position="top-left">
            <button
              onClick={onExit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-foreground/10 border border-border text-xs text-foreground backdrop-blur-sm hover:bg-foreground/15 cursor-pointer"
            >
              <ArrowLeft size={14} />
              {t("diffBack")}
            </button>
          </Panel>
        )}
        {/* File name label (right-aligned) */}
        <Panel position="top-right">
          <div className="px-2.5 py-1 rounded-md bg-foreground/10 border border-border text-xs text-foreground backdrop-blur-sm">
            {fileName}
          </div>
        </Panel>

        {/* Diff glow overlay (shape-aware outer glow + inner shadow) */}
        <DiffGlowOverlay
          diffResult={diffResult}
          filters={filters}
          flashTarget={flashTarget}
          layout={layout}
          side={side}
        />

        {/* Diff badge overlay */}
        <DiffBadgeOverlay
          diffResult={diffResult}
          filters={filters}
          layout={layout}
          side={side}
        />
      </ReactFlow>
    </div>
  );
});

// ─── DiffCanvas (outer: side-by-side layout with two ReactFlowProviders) ───

export const DiffCanvas = memo(function DiffCanvas({
  baseLayout,
  compareLayout,
  diffResult,
  filters,
  onExit,
  baseFileName,
  compareFileName,
  flashTarget,
  flowOpacity,
}: DiffCanvasProps) {
  // Separate syncing refs per side to avoid race conditions
  const baseSyncingRef = useRef(false);
  const compareSyncingRef = useRef(false);

  // Refs to each side's setViewport for direct cross-side sync (no state/re-render)
  const baseSetViewportRef = useRef<((vp: Viewport) => void) | null>(null);
  const compareSetViewportRef = useRef<((vp: Viewport) => void) | null>(null);

  return (
    <div className="flex h-full w-full">
      {/* Left: Base canvas */}
      <div className="flex-1 h-full border-r border-border">
        <ReactFlowProvider>
          <DiffSingleCanvas
            layout={baseLayout}
            diffResult={diffResult}
            filters={filters}
            side="base"
            fileName={baseFileName}
            otherSetViewportRef={compareSetViewportRef}
            selfSetViewportRef={baseSetViewportRef}
            isSyncingRef={baseSyncingRef}
            onExit={onExit}
            flashTarget={flashTarget}
            flowOpacity={flowOpacity}
          />
        </ReactFlowProvider>
      </div>
      {/* Right: Compare canvas */}
      <div className="flex-1 h-full">
        <ReactFlowProvider>
          <DiffSingleCanvas
            layout={compareLayout}
            diffResult={diffResult}
            filters={filters}
            side="compare"
            fileName={compareFileName}
            otherSetViewportRef={baseSetViewportRef}
            selfSetViewportRef={compareSetViewportRef}
            isSyncingRef={compareSyncingRef}
            flashTarget={flashTarget}
            flowOpacity={flowOpacity}
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
});
