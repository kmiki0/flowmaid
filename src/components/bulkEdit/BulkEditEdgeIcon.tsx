"use client";

import { memo } from "react";
import type { MarkerStyle, StrokeStyle } from "@/types/flow";
import { computeColor } from "@/lib/color";

const ICON_WIDTH = 40;
const ICON_HEIGHT = 20;
const DEFAULT_STROKE_WIDTH = 2;
const DEFAULT_MARKER_END = "arrowclosed";

interface BulkEditEdgeIconProps {
  strokeColor?: string;
  strokeOpacity?: number;
  strokeLightness?: number;
  strokeWidth?: number;
  strokeStyle?: StrokeStyle;
  markerEnd?: MarkerStyle;
  markerStart?: MarkerStyle;
}

function getStrokeDasharray(style?: StrokeStyle): string | undefined {
  switch (style) {
    case "dashed":
      return "4 2";
    case "dotted":
      return "1.5 1.5";
    default:
      return undefined;
  }
}

export const BulkEditEdgeIcon = memo(function BulkEditEdgeIcon({
  strokeColor,
  strokeOpacity,
  strokeLightness,
  strokeWidth,
  strokeStyle,
  markerEnd,
  markerStart,
}: BulkEditEdgeIconProps) {
  const stroke =
    computeColor(strokeColor, strokeOpacity, strokeLightness) ?? "currentColor";
  const sw = strokeWidth ?? DEFAULT_STROKE_WIDTH;
  const dashArray = getStrokeDasharray(strokeStyle);

  const lineY = ICON_HEIGHT / 2;
  const effectiveMarkerEnd = markerEnd ?? DEFAULT_MARKER_END;
  const startX = markerStart && markerStart !== "none" ? 8 : 2;
  const endX = effectiveMarkerEnd !== "none" ? ICON_WIDTH - 8 : ICON_WIDTH - 2;

  return (
    <svg
      width={ICON_WIDTH}
      height={ICON_HEIGHT}
      viewBox={`0 0 ${ICON_WIDTH} ${ICON_HEIGHT}`}
      className="shrink-0"
    >
      {/* Line */}
      <line
        x1={startX}
        y1={lineY}
        x2={endX}
        y2={lineY}
        stroke={stroke}
        strokeWidth={sw}
        strokeDasharray={dashArray}
      />

      {/* Start marker */}
      {markerStart === "arrowclosed" && (
        <polygon
          points={`${startX},${lineY} ${startX + 6},${lineY - 4} ${startX + 6},${lineY + 4}`}
          fill={stroke}
          stroke="none"
        />
      )}
      {markerStart === "arrow" && (
        <polyline
          points={`${startX + 6},${lineY - 4} ${startX},${lineY} ${startX + 6},${lineY + 4}`}
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
        />
      )}

      {/* End marker */}
      {effectiveMarkerEnd === "arrowclosed" && (
        <polygon
          points={`${endX},${lineY} ${endX - 6},${lineY - 4} ${endX - 6},${lineY + 4}`}
          fill={stroke}
          stroke="none"
        />
      )}
      {effectiveMarkerEnd === "arrow" && (
        <polyline
          points={`${endX - 6},${lineY - 4} ${endX},${lineY} ${endX - 6},${lineY + 4}`}
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
        />
      )}
    </svg>
  );
});
