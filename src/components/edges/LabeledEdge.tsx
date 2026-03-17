"use client";

import { memo, useState, useRef, useEffect, useCallback } from "react";
import { perfCount } from "@/lib/perf";
import {
  EdgeLabelRenderer,
  getBezierPath,
  getStraightPath,
  getSmoothStepPath,
  Position,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { useFlowStore } from "@/store/useFlowStore";
import type { FlowEdge } from "@/store/types";
import { computeColor } from "@/lib/color";
import type { Waypoint } from "@/types/flow";

const WAYPOINT_BORDER_RADIUS = 8;

function buildWaypointPath(
  sx: number, sy: number,
  tx: number, ty: number,
  waypoints: Waypoint[],
  borderRadius: number = WAYPOINT_BORDER_RADIUS,
): string {
  const pts: Waypoint[] = [{ x: sx, y: sy }, ...waypoints, { x: tx, y: ty }];
  if (pts.length < 2) return "";
  if (pts.length === 2 || borderRadius <= 0) {
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x} ${pts[i].y}`;
    }
    return d;
  }

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const next = pts[i + 1];

    // Vector from curr to prev / next
    const dxIn = prev.x - curr.x;
    const dyIn = prev.y - curr.y;
    const dxOut = next.x - curr.x;
    const dyOut = next.y - curr.y;

    const lenIn = Math.hypot(dxIn, dyIn);
    const lenOut = Math.hypot(dxOut, dyOut);

    // Clamp radius so it doesn't exceed half of either segment
    const r = Math.min(borderRadius, lenIn / 2, lenOut / 2);

    if (r < 1) {
      d += ` L ${curr.x} ${curr.y}`;
      continue;
    }

    // Points where the arc starts and ends
    const startX = curr.x + (dxIn / lenIn) * r;
    const startY = curr.y + (dyIn / lenIn) * r;
    const endX = curr.x + (dxOut / lenOut) * r;
    const endY = curr.y + (dyOut / lenOut) * r;

    d += ` L ${startX} ${startY}`;
    d += ` Q ${curr.x} ${curr.y} ${endX} ${endY}`;
  }
  d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  return d;
}

const DETOUR_OFFSET = 50;

/** Calculate midpoint with U-shaped detour for same-direction handles */
function computeMid(
  s: number, t: number,
  sPos: Position, tPos: Position,
  positivePos: Position,
): number {
  const sGoesPositive = sPos === positivePos;
  const tGoesPositive = tPos === positivePos;

  if (sGoesPositive !== tGoesPositive) {
    // Opposite-direction handles (Bottom→Top, Left→Right, etc.)
    // midpoint always between source and target → arrow direction preserved
    return Math.round((s + t) / 2);
  }

  // Same-direction handles (Bottom→Bottom, Top→Top, etc.) → U-shaped detour
  if (sGoesPositive) {
    return Math.round(Math.max(s, t) + DETOUR_OFFSET);
  } else {
    return Math.round(Math.min(s, t) - DETOUR_OFFSET);
  }
}

function computeStepCorners(
  sx: number, sy: number, sPos: Position,
  tx: number, ty: number, tPos: Position,
): Waypoint[] {
  const isSourceVertical = sPos === Position.Top || sPos === Position.Bottom;
  const isTargetVertical = tPos === Position.Top || tPos === Position.Bottom;

  if (isSourceVertical && isTargetVertical) {
    const midY = computeMid(sy, ty, sPos, tPos, Position.Bottom);
    if (Math.abs(sx - tx) < 1) return [];
    return [
      { x: Math.round(sx), y: midY },
      { x: Math.round(tx), y: midY },
    ];
  } else if (!isSourceVertical && !isTargetVertical) {
    const midX = computeMid(sx, tx, sPos, tPos, Position.Right);
    if (Math.abs(sy - ty) < 1) return [];
    return [
      { x: midX, y: Math.round(sy) },
      { x: midX, y: Math.round(ty) },
    ];
  } else if (isSourceVertical && !isTargetVertical) {
    return [
      { x: Math.round(sx), y: Math.round(ty) },
    ];
  } else {
    return [
      { x: Math.round(tx), y: Math.round(sy) },
    ];
  }
}

const NODE_AVOID_MARGIN = 20;

interface NodeRect { x: number; y: number; w: number; h: number }

/** Check if an axis-aligned segment overlaps a rectangle (with margin) */
function segOverlapsRect(
  ax: number, ay: number, bx: number, by: number,
  r: NodeRect, m: number,
): boolean {
  const left = r.x - m, right = r.x + r.w + m;
  const top = r.y - m, bottom = r.y + r.h + m;
  const minX = Math.min(ax, bx), maxX = Math.max(ax, bx);
  const minY = Math.min(ay, by), maxY = Math.max(ay, by);
  return maxX > left && minX < right && maxY > top && minY < bottom;
}

/** Get bounding rects of all top-level visible nodes except source/target */
function getObstacleRects(sourceId: string, targetId: string): NodeRect[] {
  const nodes = useFlowStore.getState().nodes;
  return nodes
    .filter(n => n.id !== sourceId && n.id !== targetId && !n.hidden && !n.parentId)
    .map(n => ({
      x: n.position.x,
      y: n.position.y,
      w: (n.style?.width as number) ?? (n.measured?.width as number) ?? 150,
      h: (n.style?.height as number) ?? (n.measured?.height as number) ?? 50,
    }));
}

/**
 * Compute step corners with node-avoidance: shifts the connecting segment
 * (midY for both-vertical, midX for both-horizontal) so it doesn't pass through nodes.
 */
function computeStepCornersAvoidingNodes(
  sx: number, sy: number, sPos: Position,
  tx: number, ty: number, tPos: Position,
  sourceId: string, targetId: string,
): Waypoint[] {
  const basic = computeStepCorners(sx, sy, sPos, tx, ty, tPos);
  if (basic.length !== 2) return basic; // only adjust 2-corner paths

  const rects = getObstacleRects(sourceId, targetId);
  if (rects.length === 0) return basic;

  const isSourceVertical = sPos === Position.Top || sPos === Position.Bottom;
  const isTargetVertical = tPos === Position.Top || tPos === Position.Bottom;
  const m = NODE_AVOID_MARGIN;

  if (isSourceVertical && isTargetVertical) {
    // Horizontal connecting segment at midY
    let midY = basic[0].y;
    for (let iter = 0; iter < 5; iter++) {
      const blocked = rects.filter(r =>
        segOverlapsRect(Math.min(sx, tx), midY, Math.max(sx, tx), midY, r, m)
      );
      if (blocked.length === 0) break;
      let minTop = Infinity, maxBottom = -Infinity;
      for (const r of blocked) {
        minTop = Math.min(minTop, r.y - m);
        maxBottom = Math.max(maxBottom, r.y + r.h + m);
      }
      const above = Math.round(minTop);
      const below = Math.round(maxBottom);
      midY = Math.abs(midY - above) <= Math.abs(midY - below) ? above : below;
    }
    return [{ x: Math.round(sx), y: midY }, { x: Math.round(tx), y: midY }];
  } else if (!isSourceVertical && !isTargetVertical) {
    // Vertical connecting segment at midX
    let midX = basic[0].x;
    for (let iter = 0; iter < 5; iter++) {
      const blocked = rects.filter(r =>
        segOverlapsRect(midX, Math.min(sy, ty), midX, Math.max(sy, ty), r, m)
      );
      if (blocked.length === 0) break;
      let minLeft = Infinity, maxRight = -Infinity;
      for (const r of blocked) {
        minLeft = Math.min(minLeft, r.x - m);
        maxRight = Math.max(maxRight, r.x + r.w + m);
      }
      const left = Math.round(minLeft);
      const right = Math.round(maxRight);
      midX = Math.abs(midX - left) <= Math.abs(midX - right) ? left : right;
    }
    return [{ x: midX, y: Math.round(sy) }, { x: midX, y: Math.round(ty) }];
  }

  return basic;
}

/** Determine which segment index a click position is closest to */
function findClosestSegment(allPts: Waypoint[], clickPos: Waypoint): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < allPts.length - 1; i++) {
    // Distance from point to line segment
    const a = allPts[i];
    const b = allPts[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((clickPos.x - a.x) * dx + (clickPos.y - a.y) * dy) / len2));
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    const dist = Math.hypot(clickPos.x - px, clickPos.y - py);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export const LabeledEdge = memo(function LabeledEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
  selected,
  markerEnd,
  markerStart,
}: EdgeProps<FlowEdge>) {
  perfCount("LabeledEdge");
  const edgeType = data?.edgeType ?? "bezier";
  const waypoints = data?.waypoints ?? [];
  const hasWaypoints = waypoints.length > 0;

  const pathParams = { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition };
  let edgePath: string;
  let labelX: number;
  let labelY: number;

  if (hasWaypoints) {
    edgePath = buildWaypointPath(sourceX, sourceY, targetX, targetY, waypoints);
    const allPts: Waypoint[] = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];
    const midSegIdx = Math.floor((allPts.length - 1) / 2);
    const a = allPts[midSegIdx];
    const b = allPts[midSegIdx + 1];
    labelX = (a.x + b.x) / 2;
    labelY = (a.y + b.y) / 2 - 16;
  } else if (edgeType === "straight") {
    [edgePath, labelX, labelY] = getStraightPath(pathParams);
  } else if (edgeType === "step") {
    [edgePath, labelX, labelY] = getSmoothStepPath({ ...pathParams, borderRadius: 8 });
  } else {
    [edgePath, labelX, labelY] = getBezierPath(pathParams);
  }

  const updateEdgeWaypoints = useFlowStore((s) => s.updateEdgeWaypoints);

  // Auto-generate waypoints when switching to step with no existing waypoints
  const prevEdgeTypeRef = useRef(edgeType);
  useEffect(() => {
    if (edgeType === "step" && prevEdgeTypeRef.current !== "step" && waypoints.length === 0) {
      const corners = computeStepCornersAvoidingNodes(sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, source, target);
      if (corners.length > 0) {
        updateEdgeWaypoints(id, corners);
      }
    }
    prevEdgeTypeRef.current = edgeType;
  }, [edgeType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track node movement and adjust waypoints to maintain right-angle segments
  const prevPosRef = useRef({ sx: sourceX, sy: sourceY, tx: targetX, ty: targetY });
  useEffect(() => {
    const prev = prevPosRef.current;
    const sdx = sourceX - prev.sx;
    const sdy = sourceY - prev.sy;
    const tdx = targetX - prev.tx;
    const tdy = targetY - prev.ty;
    prevPosRef.current = { sx: sourceX, sy: sourceY, tx: targetX, ty: targetY };

    if ((sdx === 0 && sdy === 0 && tdx === 0 && tdy === 0) || waypoints.length === 0) return;

    if (waypoints.length <= 2) {
      // Basic step edge (auto-generated): recalculate from scratch to avoid broken paths
      const corners = computeStepCornersAvoidingNodes(sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, source, target);
      if (corners.length === 0) {
        // Nodes are aligned — clear waypoints
        updateEdgeWaypoints(id, []);
        return;
      }
      if (corners.every((w, i) => waypoints[i] && w.x === waypoints[i].x && w.y === waypoints[i].y)) return;
      updateEdgeWaypoints(id, corners);
    } else {
      // User-customized step edge (3+ waypoints from double-click): delta-based adjustment
      const updated = waypoints.map(w => ({ ...w }));
      const wp0 = updated[0];
      const wpLast = updated[updated.length - 1];

      const firstIsVertical = Math.abs(prev.sx - wp0.x) <= Math.abs(prev.sy - wp0.y);

      if (firstIsVertical) {
        wp0.x = Math.round(sourceX);
        wpLast.x = Math.round(targetX);
        const midY = computeMid(sourceY, targetY, sourcePosition, targetPosition, Position.Bottom);
        wp0.y = midY;
        wpLast.y = midY;
      } else {
        wp0.y = Math.round(sourceY);
        wpLast.y = Math.round(targetY);
        const midX = computeMid(sourceX, targetX, sourcePosition, targetPosition, Position.Right);
        wp0.x = midX;
        wpLast.x = midX;
      }

      for (let i = 1; i < updated.length - 1; i++) {
        updated[i].x += Math.round((sdx + tdx) / 2);
        updated[i].y += Math.round((sdy + tdy) / 2);
      }

      if (updated.every((w, i) => w.x === waypoints[i].x && w.y === waypoints[i].y)) return;
      updateEdgeWaypoints(id, updated);
    }
  }, [sourceX, sourceY, targetX, targetY]); // eslint-disable-line react-hooks/exhaustive-deps

  const label = data?.label ?? "";
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateEdgeLabel = useFlowStore((s) => s.updateEdgeLabel);
  const { screenToFlowPosition } = useReactFlow();

  useEffect(() => {
    setValue(label);
  }, [label]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    updateEdgeLabel(id, value.trim());
  }, [id, value, updateEdgeLabel]);

  const strokeColor = computeColor(data?.strokeColor, data?.strokeOpacity, data?.strokeLightness) ?? undefined;
  const strokeWidth = data?.strokeWidth ?? 2;

  // Double-click on step edge: add a new jog (2 waypoints) at clicked segment
  const handleEdgeDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (edgeType !== "step") return;
      e.stopPropagation();
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const clickPt: Waypoint = { x: Math.round(pos.x), y: Math.round(pos.y) };
      const allPts: Waypoint[] = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];
      const segIdx = findClosestSegment(allPts, clickPt);

      const a = allPts[segIdx];
      const b = allPts[segIdx + 1];
      const isHorizontal = Math.abs(a.y - b.y) < Math.abs(a.x - b.x);

      // Insert 2 new waypoints to create a jog perpendicular to the segment
      let newWp1: Waypoint;
      let newWp2: Waypoint;
      if (isHorizontal) {
        // Horizontal segment → add vertical jog
        newWp1 = { x: clickPt.x, y: a.y };
        newWp2 = { x: clickPt.x, y: clickPt.y };
      } else {
        // Vertical segment → add horizontal jog
        newWp1 = { x: a.x, y: clickPt.y };
        newWp2 = { x: clickPt.x, y: clickPt.y };
      }

      const updated = [...waypoints];
      // segIdx maps to waypoint insertion: waypoint index = segIdx (since allPts[0] is source)
      updated.splice(segIdx, 0, newWp1, newWp2);
      updateEdgeWaypoints(id, updated);
    },
    [id, edgeType, waypoints, sourceX, sourceY, targetX, targetY, screenToFlowPosition, updateEdgeWaypoints]
  );

  // Build segments for drag handles
  const allPts: Waypoint[] = hasWaypoints
    ? [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }]
    : [];

  return (
    <>
      {/* Invisible wider path for easier clicking/double-clicking */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(strokeWidth, 2) + 16}
        onDoubleClick={(e) => {
          if (edgeType === "step") {
            handleEdgeDoubleClick(e);
          } else {
            e.stopPropagation();
            setEditing(true);
          }
        }}
        style={{ cursor: edgeType === "step" ? "crosshair" : undefined }}
      />
      {/* Selection glow (like node box-shadow) */}
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={strokeWidth + 10}
          strokeOpacity={0.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pointerEvents: "none" }}
        />
      )}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={strokeWidth}
        markerEnd={markerEnd as string}
        markerStart={markerStart as string}
        style={{
          ...style,
          ...(strokeColor && { stroke: strokeColor }),
          strokeDasharray:
            data?.strokeStyle === "dashed" ? "8 4" :
            data?.strokeStyle === "dotted" ? "2 2" :
            undefined,
        }}
        className="react-flow__edge-path"
      />
      {/* Segment drag handles (only when selected, step edges with waypoints) */}
      {selected && hasWaypoints && allPts.map((_, segIdx) => {
        if (segIdx >= allPts.length - 1) return null;
        // Only middle segments (both endpoints are waypoints)
        const startIsWp = segIdx > 0;
        const endIsWp = segIdx + 1 < allPts.length - 1;
        if (!startIsWp || !endIsWp) return null;
        const p1 = allPts[segIdx];
        const p2 = allPts[segIdx + 1];
        return (
          <SegmentHandle
            key={segIdx}
            segIdx={segIdx}
            p1={p1}
            p2={p2}
            edgeId={id}
            waypoints={waypoints}
            updateEdgeWaypoints={updateEdgeWaypoints}
            screenToFlowPosition={screenToFlowPosition}
          />
        );
      })}
      <EdgeLabelRenderer>
        {(editing || label !== "") ? (
          <div
            className="nodrag nopan absolute bg-background border border-border rounded px-1 text-xs"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
              cursor: "pointer",
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
          >
            {editing ? (
              <input
                ref={inputRef}
                className="bg-transparent text-center text-xs outline-none w-16"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") {
                    setValue(label);
                    setEditing(false);
                  }
                }}
              />
            ) : (
              <span>{label}</span>
            )}
          </div>
        ) : selected ? (
          <div
            className="nodrag nopan absolute rounded text-xs"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
              cursor: "pointer",
              border: "1px dashed var(--border)",
              opacity: 0.6,
              padding: "0 4px",
              color: "var(--muted-foreground)",
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
          >
            +
          </div>
        ) : null}
      </EdgeLabelRenderer>
    </>
  );
});

function SegmentHandle({
  segIdx,
  p1,
  p2,
  edgeId,
  waypoints,
  updateEdgeWaypoints,
  screenToFlowPosition,
}: {
  segIdx: number;
  p1: Waypoint;
  p2: Waypoint;
  edgeId: string;
  waypoints: Waypoint[];
  updateEdgeWaypoints: (id: string, wps: Waypoint[]) => void;
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number };
}) {
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const isHorizontal = Math.abs(p1.y - p2.y) < Math.abs(p1.x - p2.x);
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const cursor = isHorizontal ? "ns-resize" : "ew-resize";

  // Both endpoints are always waypoints (middle segment)
  const wpStartIdx = segIdx - 1;
  const wpEndIdx = segIdx;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDragging(true);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const updated = waypoints.map(w => ({ ...w }));

    if (isHorizontal) {
      const newY = Math.round(pos.y);
      if (wpStartIdx >= 0 && wpStartIdx < updated.length) updated[wpStartIdx].y = newY;
      if (wpEndIdx >= 0 && wpEndIdx < updated.length) updated[wpEndIdx].y = newY;
    } else {
      const newX = Math.round(pos.x);
      if (wpStartIdx >= 0 && wpStartIdx < updated.length) updated[wpStartIdx].x = newX;
      if (wpEndIdx >= 0 && wpEndIdx < updated.length) updated[wpEndIdx].x = newX;
    }

    updateEdgeWaypoints(edgeId, updated);
  }, [dragging, isHorizontal, wpStartIdx, wpEndIdx, edgeId, waypoints, screenToFlowPosition, updateEdgeWaypoints]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
    setHovered(false);
  }, []);

  const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  if (segLen < 5) return null;

  const showIcon = hovered || dragging;

  return (
    <>
      {/* Invisible wider hit area */}
      <line
        x1={p1.x} y1={p1.y}
        x2={p2.x} y2={p2.y}
        stroke="transparent"
        strokeWidth={16}
        style={{ cursor, pointerEvents: "all" }}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => { if (!dragging) setHovered(false); }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      {/* Grab indicator at midpoint — only on hover */}
      {showIcon && (
        isHorizontal ? (
          <g style={{ pointerEvents: "none" }}>
            <line x1={mx - 6} y1={my - 3} x2={mx + 6} y2={my - 3} stroke="var(--handle-color)" strokeWidth={1.5} strokeLinecap="round" />
            <line x1={mx - 6} y1={my} x2={mx + 6} y2={my} stroke="var(--handle-color)" strokeWidth={1.5} strokeLinecap="round" />
            <line x1={mx - 6} y1={my + 3} x2={mx + 6} y2={my + 3} stroke="var(--handle-color)" strokeWidth={1.5} strokeLinecap="round" />
          </g>
        ) : (
          <g style={{ pointerEvents: "none" }}>
            <line x1={mx - 3} y1={my - 6} x2={mx - 3} y2={my + 6} stroke="var(--handle-color)" strokeWidth={1.5} strokeLinecap="round" />
            <line x1={mx} y1={my - 6} x2={mx} y2={my + 6} stroke="var(--handle-color)" strokeWidth={1.5} strokeLinecap="round" />
            <line x1={mx + 3} y1={my - 6} x2={mx + 3} y2={my + 6} stroke="var(--handle-color)" strokeWidth={1.5} strokeLinecap="round" />
          </g>
        )
      )}
    </>
  );
}
