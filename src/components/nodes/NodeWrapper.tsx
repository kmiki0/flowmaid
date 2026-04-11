"use client";

import { memo, useState, useRef, useCallback, useEffect } from "react";
import { Position, NodeResizer, useReactFlow } from "@xyflow/react";
import type { ResizeParams } from "@xyflow/react";
import { NodeLabel } from "./NodeLabel";
import { ConnectHandle } from "./ConnectHandle";
import { useFlowStore } from "@/store/useFlowStore";
import { useShiftKey } from "@/hooks/useShiftKey";
import { clearGuidesRef } from "@/hooks/useSnapGuides";
import { computeColor } from "@/lib/color";
import type { TextAlign, TextVerticalAlign } from "@/types/flow";
import { perfCount } from "@/lib/perf";

const DELETE_ANIM_MS = 250;

/** Mark nodes as deleting (triggers exit animation), then remove after animation.
 *  Also marks child nodes of component instances / subgraph groups. */
export function animateDeleteNodes(ids: string[]) {
  const { nodes, onNodesChange } = useFlowStore.getState();
  // Collect all descendant nodes (component children + subgraph children, recursively)
  const allIds = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodes) {
      if (allIds.has(n.id)) continue;
      const isComponentChild = n.data.componentParentId && allIds.has(n.data.componentParentId as string);
      const isSubgraphChild = n.parentId && allIds.has(n.parentId);
      if (isComponentChild || isSubgraphChild) {
        allIds.add(n.id);
        changed = true;
      }
    }
  }
  // Deselect all immediately so focus border disappears
  onNodesChange(nodes.map((n) => ({ id: n.id, type: "select" as const, selected: false })));
  // Set isDeleting flag on all affected nodes
  useFlowStore.setState({
    nodes: useFlowStore.getState().nodes.map((n) =>
      allIds.has(n.id) ? { ...n, data: { ...n.data, isDeleting: true } } : n
    ),
  });
  // Remove after animation
  setTimeout(() => {
    useFlowStore.getState().removeNodes(ids);
  }, DELETE_ANIM_MS);
}

interface NodeWrapperProps {
  id: string;
  label: string;
  selected?: boolean;
  className?: string;
  style?: React.CSSProperties;
  fillColor?: string;
  fillOpacity?: number;
  fillLightness?: number;
  borderColor?: string;
  borderOpacity?: number;
  borderLightness?: number;
  borderWidth?: number;
  borderStyle?: string;
  fontSize?: number;
  textColor?: string;
  textOpacity?: number;
  textLightness?: number;
  textAlign?: TextAlign;
  textVerticalAlign?: TextVerticalAlign;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  isLocked?: boolean;
  isComponentChild?: boolean;
  ghostTargetHandle?: string; // e.g. "top-target" — only this handle is rendered (ghost node)
}

const positions = [Position.Top, Position.Right, Position.Bottom, Position.Left];

export const NodeWrapper = memo(function NodeWrapper({
  id,
  label,
  selected,
  className = "",
  style,
  fillColor,
  fillOpacity,
  fillLightness,
  borderColor,
  borderOpacity,
  borderLightness,
  borderWidth,
  borderStyle,
  fontSize,
  textColor,
  textOpacity,
  textLightness,
  textAlign,
  textVerticalAlign,
  bold,
  italic,
  underline,
  isLocked,
  isComponentChild,
  ghostTargetHandle,
}: NodeWrapperProps) {
  perfCount("NodeWrapper");
  const shiftPressed = useShiftKey();
  const [hovered, setHovered] = useState(false);

  const isNew = useFlowStore((s) => s.nodes.find((n) => n.id === id)?.data.isNew);
  const isDeleting = useFlowStore((s) => !!s.nodes.find((n) => n.id === id)?.data.isDeleting);
  useEffect(() => {
    if (!isNew) return;
    const timer = setTimeout(() => {
      const { nodes } = useFlowStore.getState();
      useFlowStore.setState({
        nodes: nodes.map((n) => n.id === id ? { ...n, data: { ...n.data, isNew: undefined } } : n),
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [id, isNew]);

  const visible = !isComponentChild && hovered;

  // Multi-node resize: track initial sizes and positions of all selected nodes
  const initialRef = useRef<{ w: number; h: number; x: number; y: number } | null>(null);
  const selectedInitialsRef = useRef<Map<string, { w: number; h: number; x: number; y: number }> | null>(null);

  const onResizeStart = useCallback(() => {
    const state = useFlowStore.getState();
    const node = state.nodes.find((n) => n.id === id);
    if (node) {
      initialRef.current = {
        w: node.width ?? node.measured?.width ?? (node.style?.width as number) ?? 150,
        h: node.height ?? node.measured?.height ?? (node.style?.height as number) ?? 50,
        x: node.position.x,
        y: node.position.y,
      };
    }
    const initials = new Map<string, { w: number; h: number; x: number; y: number }>();
    for (const n of state.nodes) {
      if (n.selected && n.id !== id && !n.data.componentParentId) {
        initials.set(n.id, {
          w: n.width ?? n.measured?.width ?? (n.style?.width as number) ?? 150,
          h: n.height ?? n.measured?.height ?? (n.style?.height as number) ?? 50,
          x: n.position.x,
          y: n.position.y,
        });
      }
    }
    selectedInitialsRef.current = initials;
    useFlowStore.temporal.getState().pause();
  }, [id]);

  const onResize = useCallback((_event: unknown, params: ResizeParams) => {
    if (!initialRef.current) return;
    const deltaW = params.width - initialRef.current.w;
    const deltaH = params.height - initialRef.current.h;
    const deltaX = params.x - initialRef.current.x;
    const deltaY = params.y - initialRef.current.y;
    useFlowStore.getState().resizeSelectedNodes(id, deltaW, deltaH, deltaX, deltaY, selectedInitialsRef.current ?? undefined);
  }, [id]);

  const onResizeEnd = useCallback(() => {
    initialRef.current = null;
    selectedInitialsRef.current = null;
    useFlowStore.temporal.getState().resume();
    clearGuidesRef.current?.();
  }, []);

  const colorStyle: React.CSSProperties = {};
  const computedFill = computeColor(fillColor, fillOpacity, fillLightness);
  const computedBorder = computeColor(borderColor, borderOpacity, borderLightness);
  const computedText = computeColor(textColor, textOpacity, textLightness);
  if (computedFill !== undefined) colorStyle.backgroundColor = computedFill;
  if (computedBorder !== undefined) colorStyle.borderColor = computedBorder;
  if (borderWidth) colorStyle.borderWidth = borderWidth;
  if (borderStyle) colorStyle.borderStyle = borderStyle;

  return (
    <>
      <NodeResizer
        isVisible={!isComponentChild && !!selected}
        minWidth={60}
        minHeight={30}
        keepAspectRatio={shiftPressed}
        lineClassName="!border-primary"
        handleClassName="!w-2 !h-2 !bg-primary !border-primary"
        onResizeStart={onResizeStart}
        onResize={onResize}
        onResizeEnd={onResizeEnd}
      />
      {/* Delete button (top-right corner when selected) */}
      {!isComponentChild && !isLocked && selected && !ghostTargetHandle && (
        <button
          className="nodrag nopan absolute flex items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          style={{
            top: "calc(-8px / var(--rf-zoom, 1))",
            right: "calc(-8px / var(--rf-zoom, 1))",
            width: "calc(18px / var(--rf-zoom, 1))",
            height: "calc(18px / var(--rf-zoom, 1))",
            fontSize: "calc(10px / var(--rf-zoom, 1))",
            lineHeight: 1,
            zIndex: 10,
            cursor: "pointer",
            border: "calc(2px / var(--rf-zoom, 1)) solid var(--background)",
          }}
          onClick={(e) => {
            e.stopPropagation();
            animateDeleteNodes([id]);
          }}
          title="Delete"
        >
          ✕
        </button>
      )}
      {/* Diagonal dotted line indicating aspect-ratio lock (Shift held) */}
      {!isComponentChild && selected && shiftPressed && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
          <line x1="0" y1="0" x2="100%" y2="100%" stroke="#f97316" strokeWidth="1" strokeDasharray="4 3" strokeOpacity="0.6" />
        </svg>
      )}
      <div
        className={`relative flex w-full h-full ${
          textVerticalAlign === "top" ? "items-start" : textVerticalAlign === "bottom" ? "items-end" : "items-center"
        } ${
          textAlign === "left" ? "justify-start" : textAlign === "right" ? "justify-end" : "justify-center"
        } ${isNew ? "node-new" : ""} ${className}`}
        style={{
          ...style,
          ...colorStyle,
          ...(isDeleting && {
            opacity: 0,
            filter: "blur(6px)",
            transition: "opacity 0.25s ease-in, filter 0.25s ease-in",
            pointerEvents: "none" as const,
          }),
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {positions.map((pos) => {
          if (ghostTargetHandle && `${pos}-target` !== ghostTargetHandle) return null;
          return <ConnectHandle key={`target-${pos}`} pos={pos} type="target" visible={isComponentChild ? false : visible} connectable={!isComponentChild} nodeId={id} />;
        })}
        {!ghostTargetHandle && isLocked && (
          <span className="absolute top-1 right-2 text-amber-500 dark:text-yellow-400" title="Locked">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </span>
        )}
        <NodeLabel
          id={id}
          label={label}
          fontSize={fontSize}
          textColor={computedText}
          textAlign={textAlign}
          bold={bold}
          italic={italic}
          underline={underline}
          isLocked={isLocked}
        />
        {positions.map((pos) => {
          if (ghostTargetHandle) return null; // ghost only needs target handle
          return <ConnectHandle key={`source-${pos}`} pos={pos} type="source" visible={isComponentChild ? false : visible} connectable={!isComponentChild} nodeId={id} />;
        })}
      </div>
    </>
  );
});
