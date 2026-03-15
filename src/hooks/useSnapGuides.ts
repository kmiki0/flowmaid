"use client";

import { useCallback, useRef, useState } from "react";
import type { NodeChange, NodePositionChange } from "@xyflow/react";
import type { FlowNode } from "@/store/types";

export interface GuideLine {
  orientation: "horizontal" | "vertical";
  pos: number; // x for vertical, y for horizontal
  from: number;
  to: number;
}

const SNAP_THRESHOLD = 5;

function getNodeBounds(node: FlowNode) {
  const w = node.measured?.width ?? (node.style as Record<string, number>)?.width ?? 100;
  const h = node.measured?.height ?? (node.style as Record<string, number>)?.height ?? 50;
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

export function useSnapGuides(nodes: FlowNode[]) {
  const [guides, setGuides] = useState<GuideLine[]>([]);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, dragNode: FlowNode) => {
      const dragBounds = getNodeBounds(dragNode);
      const newGuides: GuideLine[] = [];

      const otherNodes = nodesRef.current.filter((n) => !n.selected && n.id !== dragNode.id);

      for (const other of otherNodes) {
        const ob = getNodeBounds(other);

        // Vertical guides (X axis alignment)
        const xChecks: { drag: number; ref: number }[] = [
          { drag: dragBounds.left, ref: ob.left },
          { drag: dragBounds.left, ref: ob.centerX },
          { drag: dragBounds.left, ref: ob.right },
          { drag: dragBounds.centerX, ref: ob.left },
          { drag: dragBounds.centerX, ref: ob.centerX },
          { drag: dragBounds.centerX, ref: ob.right },
          { drag: dragBounds.right, ref: ob.left },
          { drag: dragBounds.right, ref: ob.centerX },
          { drag: dragBounds.right, ref: ob.right },
        ];

        for (const { drag, ref } of xChecks) {
          if (Math.abs(drag - ref) < SNAP_THRESHOLD) {
            const minY = Math.min(dragBounds.top, ob.top);
            const maxY = Math.max(dragBounds.bottom, ob.bottom);
            newGuides.push({ orientation: "vertical", pos: ref, from: minY, to: maxY });
          }
        }

        // Horizontal guides (Y axis alignment)
        const yChecks: { drag: number; ref: number }[] = [
          { drag: dragBounds.top, ref: ob.top },
          { drag: dragBounds.top, ref: ob.centerY },
          { drag: dragBounds.top, ref: ob.bottom },
          { drag: dragBounds.centerY, ref: ob.top },
          { drag: dragBounds.centerY, ref: ob.centerY },
          { drag: dragBounds.centerY, ref: ob.bottom },
          { drag: dragBounds.bottom, ref: ob.top },
          { drag: dragBounds.bottom, ref: ob.centerY },
          { drag: dragBounds.bottom, ref: ob.bottom },
        ];

        for (const { drag, ref } of yChecks) {
          if (Math.abs(drag - ref) < SNAP_THRESHOLD) {
            const minX = Math.min(dragBounds.left, ob.left);
            const maxX = Math.max(dragBounds.right, ob.right);
            newGuides.push({ orientation: "horizontal", pos: ref, from: minX, to: maxX });
          }
        }
      }

      setGuides(newGuides);
    },
    []
  );

  const applySnap = useCallback(
    (changes: NodeChange<FlowNode>[]): NodeChange<FlowNode>[] => {
      const currentNodes = nodesRef.current;
      return changes.map((change) => {
        if (change.type !== "position" || !change.position) return change;

        const posChange = change as NodePositionChange;
        const node = currentNodes.find((n) => n.id === posChange.id);
        if (!node) return change;

        const w = node.measured?.width ?? (node.style as Record<string, number>)?.width ?? 100;
        const h = node.measured?.height ?? (node.style as Record<string, number>)?.height ?? 50;

        const GRID = 5;
        let x = Math.round(posChange.position!.x / GRID) * GRID;
        let y = Math.round(posChange.position!.y / GRID) * GRID;
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

        return { ...change, position: { x, y } } as NodeChange<FlowNode>;
      });
    },
    []
  );

  const clearGuides = useCallback(() => {
    setGuides([]);
  }, []);

  return { guides, onNodeDrag, applySnap, clearGuides };
}
