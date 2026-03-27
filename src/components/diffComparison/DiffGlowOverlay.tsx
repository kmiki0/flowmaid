"use client";

import { useMemo, useState, useEffect } from "react";
import { useViewport } from "@xyflow/react";
import type { DiffResult, DiffFilters, DiffKind } from "@/lib/diff/types";
import { shouldHighlightOnSide, DIFF_FLASH_DURATION_MS } from "@/lib/diff/types";
import type { FlowmaidLayout } from "@/lib/flowmaid/schema";
import { DIFF_COLORS } from "@/lib/diff/buildDiffNodes";

/** Glow blur radius for the outer glow */
const GLOW_BLUR = 6;

/** Inset margin to keep inner shadow inside the border (px) */
const INNER_SHADOW_INSET = 3;

interface DiffGlowOverlayProps {
  diffResult: DiffResult;
  filters: DiffFilters;
  /** Flash target for click-to-highlight */
  flashTarget?: { id: string; type: "node" | "edge"; seq: number } | null;
  layout: FlowmaidLayout;
  side: "base" | "compare";
}

/**
 * SVG shape path generators.
 * All return a path string in the coordinate system (0, 0, width, height).
 */
const rectPath = (w: number, h: number) => `M 0,0 L ${w},0 L ${w},${h} L 0,${h} Z`;

const SHAPE_PATHS: Record<string, (w: number, h: number) => string> = {
  rectangle: rectPath,
  text: rectPath,
  predefinedProcess: rectPath,
  internalStorage: rectPath,
  roundedRect: (w, h) => {
    const r = Math.min(16, w / 4, h / 4);
    return `M ${r},0 L ${w - r},0 Q ${w},0 ${w},${r} L ${w},${h - r} Q ${w},${h} ${w - r},${h} L ${r},${h} Q 0,${h} 0,${h - r} L 0,${r} Q 0,0 ${r},0 Z`;
  },
  circle: (w, h) => {
    const rx = w / 2;
    const ry = h / 2;
    return `M ${rx},0 A ${rx},${ry} 0 1,1 ${rx},${h} A ${rx},${ry} 0 1,1 ${rx},0 Z`;
  },
  stadium: (w, h) => {
    const r = h / 2;
    return `M ${r},0 L ${w - r},0 A ${r},${r} 0 0,1 ${w - r},${h} L ${r},${h} A ${r},${r} 0 0,1 ${r},0 Z`;
  },
  diamond: (w, h) =>
    `M ${w / 2},0 L ${w},${h / 2} L ${w / 2},${h} L 0,${h / 2} Z`,
  parallelogram: (w, h) => {
    const offset = w * 0.15;
    return `M ${offset},0 L ${w},0 L ${w - offset},${h} L 0,${h} Z`;
  },
  hexagon: (w, h) => {
    const qw = w * 0.25;
    return `M ${qw},0 L ${w - qw},0 L ${w},${h / 2} L ${w - qw},${h} L ${qw},${h} L 0,${h / 2} Z`;
  },
  trapezoid: (w, h) => {
    const offset = w * 0.2;
    return `M ${offset},0 L ${w - offset},0 L ${w},${h} L 0,${h} Z`;
  },
  cylinder: (w, h) => {
    const ey = h * 0.15;
    return `M 0,${ey} Q 0,0 ${w / 2},0 Q ${w},0 ${w},${ey} L ${w},${h - ey} Q ${w},${h} ${w / 2},${h} Q 0,${h} 0,${h - ey} Z`;
  },
  document: (w, h) => {
    const waveH = h * 0.2;
    const bodyH = h - waveH;
    return `M 0,0 L ${w},0 L ${w},${bodyH} Q ${w * 0.75},${h} ${w / 2},${bodyH} Q ${w * 0.25},${bodyH - waveH} 0,${bodyH} Z`;
  },
  manualInput: (w, h) => {
    const slant = h * 0.2;
    return `M 0,${slant} L ${w},0 L ${w},${h} L 0,${h} Z`;
  },
  display: (w, h) => {
    const cx = w * 0.15;
    return `M ${cx},0 L ${w * 0.8},0 Q ${w},${h / 2} ${w * 0.8},${h} L ${cx},${h} Q 0,${h / 2} ${cx},0 Z`;
  },
};

/** Default size when node has no explicit size */
const DEFAULT_W = 150;
const DEFAULT_H = 50;

interface GlowItem {
  nodeId: string;
  kind: DiffKind;
  px: number;
  py: number;
  w: number;
  h: number;
  shape: string;
}

export function DiffGlowOverlay({ diffResult, filters, flashTarget, layout, side }: DiffGlowOverlayProps) {
  const { x, y, zoom } = useViewport();

  // Memoize glow items — only recompute when diff/filters/layout/side change (not on viewport)
  const items = useMemo(() => {
    const result: GlowItem[] = [];
    for (const nd of diffResult.nodeDiffs) {
      if (!shouldHighlightOnSide(nd.kind, filters, side)) continue;
      const nodeLayout = layout.nodes[nd.nodeId];
      if (!nodeLayout) continue;
      result.push({
        nodeId: nd.nodeId,
        kind: nd.kind,
        px: nodeLayout.position.x,
        py: nodeLayout.position.y,
        w: nodeLayout.size?.width ?? DEFAULT_W,
        h: nodeLayout.size?.height ?? DEFAULT_H,
        shape: nodeLayout.shape ?? "rectangle",
      });
    }
    return result;
  }, [diffResult, filters, layout, side]);

  // Flash animation state
  const [flashNodeId, setFlashNodeId] = useState<string | null>(null);
  useEffect(() => {
    if (!flashTarget || flashTarget.type !== "node") return;
    setFlashNodeId(flashTarget.id);
    const timer = setTimeout(() => setFlashNodeId(null), DIFF_FLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [flashTarget]);

  // Flash node info (memoized, avoids IIFE in render)
  const flashNode = useMemo(() => {
    if (!flashNodeId) return null;
    const nodeLayout = layout.nodes[flashNodeId];
    if (!nodeLayout) return null;
    const nd = diffResult.nodeDiffs.find((d) => d.nodeId === flashNodeId);
    const color = nd && nd.kind !== "unchanged" ? DIFF_COLORS[nd.kind] : "var(--color-primary)";
    return {
      px: nodeLayout.position.x,
      py: nodeLayout.position.y,
      w: nodeLayout.size?.width ?? DEFAULT_W,
      h: nodeLayout.size?.height ?? DEFAULT_H,
      shape: nodeLayout.shape ?? "rectangle",
      color,
    };
  }, [flashNodeId, layout, diffResult]);

  if (items.length === 0 && !flashNode) return null;

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "visible",
        zIndex: 9998,
      }}
    >
      <defs>
        <filter id="diff-glow-outer" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={GLOW_BLUR} />
        </filter>
        <filter id="diff-inner-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feComponentTransfer in="SourceAlpha">
            <feFuncA type="table" tableValues="1 0" />
          </feComponentTransfer>
          <feGaussianBlur stdDeviation="4" result="shadow" />
          <feFlood floodColor="#000" floodOpacity="0.4" result="color" />
          <feComposite in="color" in2="shadow" operator="in" result="innerShadow" />
          <feComposite in="innerShadow" in2="SourceAlpha" operator="in" />
        </filter>
      </defs>

      <g transform={`translate(${x},${y}) scale(${zoom})`}>
        {items.map((item) => {
          const pathFn = SHAPE_PATHS[item.shape] ?? SHAPE_PATHS.rectangle;
          const d = pathFn(item.w, item.h);
          const color = DIFF_COLORS[item.kind];
          const sx = (item.w - INNER_SHADOW_INSET * 2) / item.w;
          const sy = (item.h - INNER_SHADOW_INSET * 2) / item.h;

          return (
            <g key={item.nodeId} transform={`translate(${item.px},${item.py})`}>
              <path d={d} fill="none" stroke={color} strokeWidth={3} />
              <path d={d} fill="none" stroke={color} strokeWidth={4} opacity={0.6} filter="url(#diff-glow-outer)" />
              <g transform={`translate(${INNER_SHADOW_INSET},${INNER_SHADOW_INSET}) scale(${sx},${sy})`}>
                <path d={d} fill="black" filter="url(#diff-inner-shadow)" />
              </g>
            </g>
          );
        })}

        {/* Flash ring wave animation */}
        {flashNode && (
          <g transform={`translate(${flashNode.px},${flashNode.py})`}>
            <path
              d={(SHAPE_PATHS[flashNode.shape] ?? SHAPE_PATHS.rectangle)(flashNode.w, flashNode.h)}
              fill="none"
              stroke={flashNode.color}
              strokeWidth={2}
              className="diff-svg-ring-wave"
            />
          </g>
        )}
      </g>
    </svg>
  );
}
