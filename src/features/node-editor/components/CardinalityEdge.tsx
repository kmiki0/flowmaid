"use client";

import { memo } from "react";
import {
  BaseEdge,
  getBezierPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from "@xyflow/react";
import type { NodeEditorEdge } from "../store/types";

function CardinalityEdgeInner({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
  style,
}: EdgeProps<NodeEditorEdge>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const cardinality = data?.cardinality;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected ? "var(--color-primary)" : undefined,
          strokeWidth: selected ? 2.5 : 1.5,
        }}
      />
      {cardinality && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            <span className="bg-background border border-border rounded px-1.5 py-0.5 text-[10px] font-semibold text-foreground shadow-sm">
              {cardinality}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const CardinalityEdge = memo(CardinalityEdgeInner);
