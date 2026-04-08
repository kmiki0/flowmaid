"use client";

import { useCallback, useRef, useState } from "react";
import type { NodeChange, NodePositionChange } from "@xyflow/react";
import type { FlowNode } from "@/store/types";
import { useFlowStore } from "@/store/useFlowStore";
import { isShiftPressed } from "@/hooks/useShiftKey";
import { SNAP_GRID_SIZE, GRID_SNAP_SIZE } from "@/lib/constants";

/** Shared ref so NodeWrapper.onResizeEnd can clear guides without prop drilling */
export const clearGuidesRef: { current: (() => void) | null } = { current: null };

export type GuideLine =
  | {
      kind: "alignment";
      orientation: "horizontal" | "vertical";
      pos: number; // x for vertical, y for horizontal
      from: number;
      to: number;
    }
  | {
      kind: "size-match";
      dimension: "width" | "height";
      value: number;
      // Resizing node rect
      a: { x: number; y: number; w: number; h: number };
      // Matching other node rect
      b: { x: number; y: number; w: number; h: number };
    }
  | {
      kind: "spacing";
      axis: "horizontal" | "vertical"; // direction of the spacing
      gap: number;
      // Two gap segments shown as ⟷ between three rects
      // For horizontal axis: segments are between left/right edges; pos is the y level
      // For vertical axis: segments are between top/bottom edges; pos is the x level
      pos: number;
      segments: Array<{ from: number; to: number }>;
    };

const SNAP_THRESHOLD = 10;
const RESIZE_SNAP_THRESHOLD = 6;

/** Merge alignment guides that share orientation+pos by extending from/to. */
function mergeGuides(guides: GuideLine[]): GuideLine[] {
  const merged = new Map<string, GuideLine>();
  const others: GuideLine[] = [];
  for (const g of guides) {
    if (g.kind !== "alignment") {
      others.push(g);
      continue;
    }
    const key = `${g.orientation}:${g.pos}`;
    const existing = merged.get(key);
    if (existing && existing.kind === "alignment") {
      existing.from = Math.min(existing.from, g.from);
      existing.to = Math.max(existing.to, g.to);
    } else {
      merged.set(key, { ...g });
    }
  }
  return [...merged.values(), ...others];
}

type Bounds = { left: number; centerX: number; right: number; top: number; centerY: number; bottom: number; width: number; height: number };

/** Detect equal-spacing snap for the dragged node along the X axis.
 *  Looks for a "left anchor" and "right anchor" pair where:
 *   - left anchor is to the left of dragged
 *   - right anchor is to the right of dragged
 *   - both anchors vertically overlap with dragged
 *   - dragged would be horizontally centered between them (gap left = gap right)
 *  Returns the snapped left x and the spacing guide info, or null. */
function detectSpacingX(
  draggedLeft: number,
  draggedW: number,
  draggedTop: number,
  draggedBottom: number,
  others: Bounds[]
): { x: number; gap: number; leftAnchor: Bounds; rightAnchor: Bounds } | null {
  const draggedRight = draggedLeft + draggedW;
  let best: { x: number; gap: number; leftAnchor: Bounds; rightAnchor: Bounds; dist: number } | null = null;
  for (const la of others) {
    if (la.right > draggedLeft) continue;
    if (la.bottom < draggedTop || la.top > draggedBottom) continue; // need vertical overlap
    for (const ra of others) {
      if (ra === la) continue;
      if (ra.left < draggedRight) continue;
      if (ra.bottom < draggedTop || ra.top > draggedBottom) continue;
      // ideal position: gap on each side equal
      const totalGap = ra.left - la.right - draggedW;
      if (totalGap < 0) continue;
      const gap = totalGap / 2;
      const idealLeft = la.right + gap;
      const dist = Math.abs(draggedLeft - idealLeft);
      if (dist < SNAP_THRESHOLD && (!best || dist < best.dist)) {
        best = { x: idealLeft, gap, leftAnchor: la, rightAnchor: ra, dist };
      }
    }
  }
  return best;
}

/** Extend an existing horizontal gap pattern. Look for an existing pair (P, Q)
 *  with a known gap, then snap the dragged node to extend that gap on either side. */
function detectExtendSpacingX(
  draggedLeft: number,
  draggedW: number,
  draggedTop: number,
  draggedBottom: number,
  others: Bounds[]
): { x: number; gap: number; segments: Array<{ from: number; to: number }>; anchors: Bounds[] } | null {
  let best: { x: number; gap: number; segments: Array<{ from: number; to: number }>; anchors: Bounds[]; dist: number } | null = null;
  for (const p of others) {
    if (p.bottom < draggedTop || p.top > draggedBottom) continue;
    for (const q of others) {
      if (q === p) continue;
      if (q.bottom < draggedTop || q.top > draggedBottom) continue;
      if (q.left <= p.right) continue;
      const existingGap = q.left - p.right;
      if (existingGap <= 0) continue;

      // Extend to the right of q
      const idealLeftR = q.right + existingGap;
      const distR = Math.abs(draggedLeft - idealLeftR);
      if (distR < SNAP_THRESHOLD && (!best || distR < best.dist)) {
        best = {
          x: idealLeftR,
          gap: existingGap,
          dist: distR,
          anchors: [p, q],
          segments: [
            { from: p.right, to: q.left },
            { from: q.right, to: idealLeftR },
          ],
        };
      }

      // Extend to the left of p
      const idealLeftL = p.left - existingGap - draggedW;
      const distL = Math.abs(draggedLeft - idealLeftL);
      if (distL < SNAP_THRESHOLD && (!best || distL < best.dist)) {
        best = {
          x: idealLeftL,
          gap: existingGap,
          dist: distL,
          anchors: [p, q],
          segments: [
            { from: idealLeftL + draggedW, to: p.left },
            { from: p.right, to: q.left },
          ],
        };
      }
    }
  }
  return best;
}

function detectExtendSpacingY(
  draggedTop: number,
  draggedH: number,
  draggedLeft: number,
  draggedRight: number,
  others: Bounds[]
): { y: number; gap: number; segments: Array<{ from: number; to: number }>; anchors: Bounds[] } | null {
  let best: { y: number; gap: number; segments: Array<{ from: number; to: number }>; anchors: Bounds[]; dist: number } | null = null;
  for (const p of others) {
    if (p.right < draggedLeft || p.left > draggedRight) continue;
    for (const q of others) {
      if (q === p) continue;
      if (q.right < draggedLeft || q.left > draggedRight) continue;
      if (q.top <= p.bottom) continue;
      const existingGap = q.top - p.bottom;
      if (existingGap <= 0) continue;

      const idealTopB = q.bottom + existingGap;
      const distB = Math.abs(draggedTop - idealTopB);
      if (distB < SNAP_THRESHOLD && (!best || distB < best.dist)) {
        best = {
          y: idealTopB,
          gap: existingGap,
          dist: distB,
          anchors: [p, q],
          segments: [
            { from: p.bottom, to: q.top },
            { from: q.bottom, to: idealTopB },
          ],
        };
      }

      const idealTopT = p.top - existingGap - draggedH;
      const distT = Math.abs(draggedTop - idealTopT);
      if (distT < SNAP_THRESHOLD && (!best || distT < best.dist)) {
        best = {
          y: idealTopT,
          gap: existingGap,
          dist: distT,
          anchors: [p, q],
          segments: [
            { from: idealTopT + draggedH, to: p.top },
            { from: p.bottom, to: q.top },
          ],
        };
      }
    }
  }
  return best;
}

function detectSpacingY(
  draggedTop: number,
  draggedH: number,
  draggedLeft: number,
  draggedRight: number,
  others: Bounds[]
): { y: number; gap: number; topAnchor: Bounds; bottomAnchor: Bounds } | null {
  const draggedBottom = draggedTop + draggedH;
  let best: { y: number; gap: number; topAnchor: Bounds; bottomAnchor: Bounds; dist: number } | null = null;
  for (const ta of others) {
    if (ta.bottom > draggedTop) continue;
    if (ta.right < draggedLeft || ta.left > draggedRight) continue;
    for (const ba of others) {
      if (ba === ta) continue;
      if (ba.top < draggedBottom) continue;
      if (ba.right < draggedLeft || ba.left > draggedRight) continue;
      const totalGap = ba.top - ta.bottom - draggedH;
      if (totalGap < 0) continue;
      const gap = totalGap / 2;
      const idealTop = ta.bottom + gap;
      const dist = Math.abs(draggedTop - idealTop);
      if (dist < SNAP_THRESHOLD && (!best || dist < best.dist)) {
        best = { y: idealTop, gap, topAnchor: ta, bottomAnchor: ba, dist };
      }
    }
  }
  return best;
}

function getNodeBounds(node: FlowNode) {
  // Prefer node.width/height (authoritative for this project) over measured/style
  const w = node.width ?? node.measured?.width ?? (node.style as Record<string, number>)?.width ?? 100;
  const h = node.height ?? node.measured?.height ?? (node.style as Record<string, number>)?.height ?? 50;
  return {
    left: node.position.x,
    centerX: node.position.x + w / 2,
    right: node.position.x + w,
    top: node.position.y,
    centerY: node.position.y + h / 2,
    bottom: node.position.y + h,
    width: w,
    height: h,
  };
}

export function useSnapGuides(nodes: FlowNode[], gridSnap = false) {
  const [guides, setGuides] = useState<GuideLine[]>([]);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, dragNode: FlowNode) => {
      // React Flow passes dragNode with the pre-applySnap position.
      // Look up the latest snapped position from the store so the guide
      // endpoints align with the visible node.
      const storeNodes = useFlowStore.getState().nodes;
      const latestDragNode = storeNodes.find((n) => n.id === dragNode.id) ?? dragNode;
      const dragBounds = getNodeBounds(latestDragNode);
      const newGuides: GuideLine[] = [];

      const otherNodes = storeNodes.filter((n) => !n.selected && n.id !== dragNode.id);

      // For X axis: find the (drag edge, ref edge) pair with the smallest distance
      // across all other nodes. Show only ONE vertical guide.
      const dragXs = [dragBounds.left, dragBounds.centerX, dragBounds.right];
      const dragYs = [dragBounds.top, dragBounds.centerY, dragBounds.bottom];

      let bestXDist = SNAP_THRESHOLD;
      let bestXPos: number | null = null;
      for (const other of otherNodes) {
        const ob = getNodeBounds(other);
        const refXs = [ob.left, ob.centerX, ob.right];
        for (const dx of dragXs) {
          for (const rx of refXs) {
            const d = Math.abs(dx - rx);
            if (d < bestXDist) {
              bestXDist = d;
              bestXPos = rx;
            }
          }
        }
      }

      let bestYDist = SNAP_THRESHOLD;
      let bestYPos: number | null = null;
      for (const other of otherNodes) {
        const ob = getNodeBounds(other);
        const refYs = [ob.top, ob.centerY, ob.bottom];
        for (const dy of dragYs) {
          for (const ry of refYs) {
            const d = Math.abs(dy - ry);
            if (d < bestYDist) {
              bestYDist = d;
              bestYPos = ry;
            }
          }
        }
      }

      const EPS = 0.5;
      const near = (a: number, b: number) => Math.abs(a - b) < EPS;
      if (bestXPos !== null) {
        let minY = dragBounds.top;
        let maxY = dragBounds.bottom;
        for (const other of otherNodes) {
          const ob = getNodeBounds(other);
          if (near(ob.left, bestXPos) || near(ob.centerX, bestXPos) || near(ob.right, bestXPos)) {
            minY = Math.min(minY, ob.top);
            maxY = Math.max(maxY, ob.bottom);
          }
        }
        newGuides.push({ kind: "alignment", orientation: "vertical", pos: bestXPos, from: minY, to: maxY });
      }
      if (bestYPos !== null) {
        let minX = dragBounds.left;
        let maxX = dragBounds.right;
        for (const other of otherNodes) {
          const ob = getNodeBounds(other);
          if (near(ob.top, bestYPos) || near(ob.centerY, bestYPos) || near(ob.bottom, bestYPos)) {
            minX = Math.min(minX, ob.left);
            maxX = Math.max(maxX, ob.right);
          }
        }
        newGuides.push({ kind: "alignment", orientation: "horizontal", pos: bestYPos, from: minX, to: maxX });
      }

      // Equal-spacing detection
      const otherBounds = otherNodes.map(getNodeBounds);
      const avgCenterY = (...bs: Bounds[]) => bs.reduce((s, b) => s + b.centerY, 0) / bs.length;
      const avgCenterX = (...bs: Bounds[]) => bs.reduce((s, b) => s + b.centerX, 0) / bs.length;
      const spacingX = detectSpacingX(dragBounds.left, dragBounds.width, dragBounds.top, dragBounds.bottom, otherBounds);
      if (spacingX) {
        const draggedRight = spacingX.x + dragBounds.width;
        newGuides.push({
          kind: "spacing",
          axis: "horizontal",
          gap: spacingX.gap,
          pos: avgCenterY(spacingX.leftAnchor, spacingX.rightAnchor),
          segments: [
            { from: spacingX.leftAnchor.right, to: spacingX.x },
            { from: draggedRight, to: spacingX.rightAnchor.left },
          ],
        });
      } else {
        const extX = detectExtendSpacingX(dragBounds.left, dragBounds.width, dragBounds.top, dragBounds.bottom, otherBounds);
        if (extX) {
          newGuides.push({
            kind: "spacing",
            axis: "horizontal",
            gap: extX.gap,
            pos: avgCenterY(...extX.anchors),
            segments: extX.segments,
          });
        }
      }
      const spacingY = detectSpacingY(dragBounds.top, dragBounds.height, dragBounds.left, dragBounds.right, otherBounds);
      if (spacingY) {
        const draggedBottom = spacingY.y + dragBounds.height;
        newGuides.push({
          kind: "spacing",
          axis: "vertical",
          gap: spacingY.gap,
          pos: avgCenterX(spacingY.topAnchor, spacingY.bottomAnchor),
          segments: [
            { from: spacingY.topAnchor.bottom, to: spacingY.y },
            { from: draggedBottom, to: spacingY.bottomAnchor.top },
          ],
        });
      } else {
        const extY = detectExtendSpacingY(dragBounds.top, dragBounds.height, dragBounds.left, dragBounds.right, otherBounds);
        if (extY) {
          newGuides.push({
            kind: "spacing",
            axis: "vertical",
            gap: extY.gap,
            pos: avgCenterX(...extY.anchors),
            segments: extY.segments,
          });
        }
      }

      setGuides(newGuides);
    },
    []
  );

  const gridSnapRef = useRef(gridSnap);
  gridSnapRef.current = gridSnap;

  const applySnap = useCallback(
    (changes: NodeChange<FlowNode>[]): NodeChange<FlowNode>[] => {
      const currentNodes = nodesRef.current;
      const grid = gridSnapRef.current ? GRID_SNAP_SIZE : SNAP_GRID_SIZE;

      // Detect resize: find ids that have a "dimensions" change with resizing=true.
      // Skip all resize snap when Shift is held (aspect-ratio lock mode).
      const resizeIds = new Set<string>();
      if (!isShiftPressed()) {
        for (const c of changes) {
          if (c.type === "dimensions" && "resizing" in c && c.resizing) {
            resizeIds.add(c.id);
          }
        }
      }

      // For each resize id, compute snapped {x, y, width, height} from the pair of changes
      const resizeSnapResults = new Map<string, { x: number; y: number; width: number; height: number }>();
      if (resizeIds.size > 0) {
        const newGuides: GuideLine[] = [];
        for (const id of resizeIds) {
          const node = currentNodes.find((n) => n.id === id);
          if (!node) continue;
          const posChange = changes.find(
            (c) => c.type === "position" && "id" in c && c.id === id && c.position
          ) as NodePositionChange | undefined;
          const dimChange = changes.find(
            (c) => c.type === "dimensions" && "id" in c && c.id === id && "dimensions" in c
          ) as Extract<NodeChange<FlowNode>, { type: "dimensions" }> | undefined;

          const startX = posChange?.position?.x ?? node.position.x;
          const startY = posChange?.position?.y ?? node.position.y;
          const startW = dimChange?.dimensions?.width
            ?? node.width
            ?? node.measured?.width
            ?? (node.style as Record<string, number>)?.width
            ?? 100;
          const startH = dimChange?.dimensions?.height
            ?? node.height
            ?? node.measured?.height
            ?? (node.style as Record<string, number>)?.height
            ?? 50;

          // Detect which edges are being dragged (the moving edges).
          // If the original node.position.x equals startX, left edge is fixed → right edge is moving.
          const leftMoving = startX !== node.position.x;
          const topMoving = startY !== node.position.y;
          const rightMoving = !leftMoving;
          const bottomMoving = !topMoving;

          // Start from raw values — alignment snap runs first, grid is fallback.
          // This avoids flicker when grid rounding pushes values in/out of snap threshold.
          let x = startX;
          let y = startY;
          let right = startX + startW;
          let bottom = startY + startH;

          const otherNodes = currentNodes.filter((n) => n.id !== id && !n.data?.componentParentId);

          // Pass 1: determine snap target for each edge by finding the closest match
          // across all other nodes. Only ONE snap per edge.
          const findClosest = (val: number, refsByNode: Array<number[]>): number | null => {
            let best: number | null = null;
            let bestDist = RESIZE_SNAP_THRESHOLD;
            for (const refs of refsByNode) {
              for (const r of refs) {
                const d = Math.abs(val - r);
                if (d < bestDist) {
                  bestDist = d;
                  best = r;
                }
              }
            }
            return best;
          };
          // Resize snaps only to edges, not to centers
          const refXsByNode = otherNodes.map((n) => {
            const ob = getNodeBounds(n);
            return [ob.left, ob.right];
          });
          const refYsByNode = otherNodes.map((n) => {
            const ob = getNodeBounds(n);
            return [ob.top, ob.bottom];
          });

          // Only snap moving edges (the fixed edges shouldn't trigger guides)
          const snapLeft = leftMoving ? findClosest(x, refXsByNode) : null;
          if (snapLeft !== null) x = snapLeft;
          else if (leftMoving) x = Math.round(x / grid) * grid;
          const snapRight = rightMoving ? findClosest(right, refXsByNode) : null;
          if (snapRight !== null) right = snapRight;
          else if (rightMoving) right = Math.round(right / grid) * grid;
          const snapTop = topMoving ? findClosest(y, refYsByNode) : null;
          if (snapTop !== null) y = snapTop;
          else if (topMoving) y = Math.round(y / grid) * grid;
          const snapBottom = bottomMoving ? findClosest(bottom, refYsByNode) : null;
          if (snapBottom !== null) bottom = snapBottom;
          else if (bottomMoving) bottom = Math.round(bottom / grid) * grid;

          // Pass 2: build a single guide per snapped edge, spanning all matching nodes
          const EPS = 0.5;
          const near = (a: number, b: number) => Math.abs(a - b) < EPS;
          const pushVerticalGuide = (pos: number) => {
            let minY = y;
            let maxY = bottom;
            for (const other of otherNodes) {
              const ob = getNodeBounds(other);
              if (near(ob.left, pos) || near(ob.centerX, pos) || near(ob.right, pos)) {
                minY = Math.min(minY, ob.top);
                maxY = Math.max(maxY, ob.bottom);
              }
            }
            newGuides.push({ kind: "alignment", orientation: "vertical", pos, from: minY, to: maxY });
          };
          const pushHorizontalGuide = (pos: number) => {
            let minX = x;
            let maxX = right;
            for (const other of otherNodes) {
              const ob = getNodeBounds(other);
              if (near(ob.top, pos) || near(ob.centerY, pos) || near(ob.bottom, pos)) {
                minX = Math.min(minX, ob.left);
                maxX = Math.max(maxX, ob.right);
              }
            }
            newGuides.push({ kind: "alignment", orientation: "horizontal", pos, from: minX, to: maxX });
          };
          if (snapLeft !== null) pushVerticalGuide(snapLeft);
          if (snapRight !== null && snapRight !== snapLeft) pushVerticalGuide(snapRight);
          if (snapTop !== null) pushHorizontalGuide(snapTop);
          if (snapBottom !== null && snapBottom !== snapTop) pushHorizontalGuide(snapBottom);

          // Equal-size snap: match width/height to other nodes' dimensions
          // Adjust the moving edge so the dimension matches.
          let curW = right - x;
          let curH = bottom - y;
          for (const other of otherNodes) {
            const ob = getNodeBounds(other);
            if (Math.abs(curW - ob.width) < RESIZE_SNAP_THRESHOLD) {
              if (rightMoving) {
                right = x + ob.width;
              } else if (leftMoving) {
                x = right - ob.width;
              }
              curW = ob.width;
              newGuides.push({
                kind: "size-match",
                dimension: "width",
                value: ob.width,
                a: { x, y, w: right - x, h: bottom - y },
                b: { x: ob.left, y: ob.top, w: ob.width, h: ob.height },
              });
              break;
            }
          }
          for (const other of otherNodes) {
            const ob = getNodeBounds(other);
            if (Math.abs(curH - ob.height) < RESIZE_SNAP_THRESHOLD) {
              if (bottomMoving) {
                bottom = y + ob.height;
              } else if (topMoving) {
                y = bottom - ob.height;
              }
              curH = ob.height;
              newGuides.push({
                kind: "size-match",
                dimension: "height",
                value: ob.height,
                a: { x, y, w: right - x, h: bottom - y },
                b: { x: ob.left, y: ob.top, w: ob.width, h: ob.height },
              });
              break;
            }
          }

          resizeSnapResults.set(id, { x, y, width: Math.max(grid, right - x), height: Math.max(grid, bottom - y) });
        }
        setGuides(mergeGuides(newGuides));
      }

      return changes.map((change) => {
        // Resize: rewrite position/dimensions changes with snapped values
        if ("id" in change && resizeSnapResults.has(change.id)) {
          const r = resizeSnapResults.get(change.id)!;
          if (change.type === "position" && change.position) {
            return { ...change, position: { x: r.x, y: r.y } } as NodeChange<FlowNode>;
          }
          if (change.type === "dimensions" && "dimensions" in change && change.dimensions) {
            return { ...change, dimensions: { width: r.width, height: r.height } } as NodeChange<FlowNode>;
          }
          return change;
        }

        // Move (non-resize position change)
        if (change.type !== "position" || !change.position) return change;

        const posChange = change as NodePositionChange;
        const node = currentNodes.find((n) => n.id === posChange.id);
        if (!node) return change;

        const w = node.width ?? node.measured?.width ?? (node.style as Record<string, number>)?.width ?? 100;
        const h = node.height ?? node.measured?.height ?? (node.style as Record<string, number>)?.height ?? 50;

        let x = Math.round(posChange.position!.x / grid) * grid;
        let y = Math.round(posChange.position!.y / grid) * grid;
        const otherNodes = currentNodes.filter((n) => !n.selected && n.id !== posChange.id);

        // Snap X
        let snappedX = false;
        for (const other of otherNodes) {
          if (snappedX) break;
          const ob = getNodeBounds(other);
          const dragXs = [x, x + w / 2, x + w];
          const refXs = [ob.left, ob.centerX, ob.right];
          for (const dx of dragXs) {
            if (snappedX) break;
            for (const rx of refXs) {
              if (Math.abs(dx - rx) < SNAP_THRESHOLD) {
                x = x + (rx - dx);
                snappedX = true;
                break;
              }
            }
          }
        }

        // Snap Y
        let snappedY = false;
        for (const other of otherNodes) {
          if (snappedY) break;
          const ob = getNodeBounds(other);
          const dragYs = [y, y + h / 2, y + h];
          const refYs = [ob.top, ob.centerY, ob.bottom];
          for (const dy of dragYs) {
            if (snappedY) break;
            for (const ry of refYs) {
              if (Math.abs(dy - ry) < SNAP_THRESHOLD) {
                y = y + (ry - dy);
                snappedY = true;
                break;
              }
            }
          }
        }

        // Equal-spacing snap (only when alignment didn't snap that axis)
        const otherBounds = otherNodes.map(getNodeBounds);
        if (!snappedX) {
          const sx = detectSpacingX(x, w, y, y + h, otherBounds);
          if (sx) x = sx.x;
          else {
            const ex = detectExtendSpacingX(x, w, y, y + h, otherBounds);
            if (ex) x = ex.x;
          }
        }
        if (!snappedY) {
          const sy = detectSpacingY(y, h, x, x + w, otherBounds);
          if (sy) y = sy.y;
          else {
            const ey = detectExtendSpacingY(y, h, x, x + w, otherBounds);
            if (ey) y = ey.y;
          }
        }

        return { ...change, position: { x, y } } as NodeChange<FlowNode>;
      });
    },
    []
  );

  const clearGuides = useCallback(() => {
    setGuides([]);
  }, []);

  clearGuidesRef.current = clearGuides;

  return { guides, onNodeDrag, applySnap, clearGuides };
}
