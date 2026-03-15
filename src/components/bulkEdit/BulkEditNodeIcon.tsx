"use client";

import { memo } from "react";
import type { NodeShape, BorderStyle } from "@/types/flow";
import { computeColor } from "@/lib/color";

const ICON_SIZE = 24;
const ICON_VIEWBOX = "0 0 32 32";
const DEFAULT_STROKE_WIDTH = 2;

interface BulkEditNodeIconProps {
  shape: NodeShape;
  fillColor?: string;
  fillOpacity?: number;
  fillLightness?: number;
  borderColor?: string;
  borderOpacity?: number;
  borderLightness?: number;
  borderWidth?: number;
  borderStyle?: BorderStyle;
}

function getStrokeDasharray(style?: BorderStyle): string | undefined {
  switch (style) {
    case "dashed":
      return "4 2";
    case "dotted":
      return "1.5 1.5";
    default:
      return undefined;
  }
}

function getShapeSvg(shape: NodeShape): React.ReactNode {
  switch (shape) {
    case "rectangle":
      return <rect x="4" y="8" width="24" height="16" rx="0" />;
    case "roundedRect":
      return <rect x="4" y="8" width="24" height="16" rx="6" />;
    case "diamond":
      return <polygon points="16 4, 28 16, 16 28, 4 16" />;
    case "circle":
      return <circle cx="16" cy="16" r="12" />;
    case "stadium":
      return <rect x="4" y="8" width="24" height="16" rx="8" />;
    case "parallelogram":
      return <polygon points="8 8, 28 8, 24 24, 4 24" />;
    case "cylinder":
      return (
        <>
          <path d="M 6 12 Q 6 8 16 8 Q 26 8 26 12 L 26 22 Q 26 26 16 26 Q 6 26 6 22 Z" />
          <path d="M 6 12 Q 6 16 16 16 Q 26 16 26 12" />
        </>
      );
    case "hexagon":
      return <polygon points="10 6, 22 6, 28 16, 22 26, 10 26, 4 16" />;
    case "trapezoid":
      return <polygon points="10 8, 22 8, 28 24, 4 24" />;
    case "document":
      return <path d="M 4 8 L 28 8 L 28 22 Q 22 26 16 22 Q 10 18 4 22 Z" />;
    case "predefinedProcess":
      return (
        <>
          <rect x="4" y="8" width="24" height="16" rx="0" />
          <line x1="8" y1="8" x2="8" y2="24" />
          <line x1="24" y1="8" x2="24" y2="24" />
        </>
      );
    case "manualInput":
      return <polygon points="4 12, 28 8, 28 24, 4 24" />;
    case "internalStorage":
      return (
        <>
          <rect x="4" y="8" width="24" height="16" rx="0" />
          <line x1="8" y1="8" x2="8" y2="24" />
          <line x1="4" y1="12" x2="28" y2="12" />
        </>
      );
    case "display":
      return <path d="M 9 8 L 22 8 Q 28 16 22 24 L 9 24 Q 4 16 9 8 Z" />;
    case "text":
      return (
        <text
          x="16"
          y="20"
          textAnchor="middle"
          fill="currentColor"
          stroke="none"
          fontSize="16"
          fontWeight="bold"
        >
          T
        </text>
      );
    default:
      return <rect x="4" y="8" width="24" height="16" rx="0" />;
  }
}

export const BulkEditNodeIcon = memo(function BulkEditNodeIcon({
  shape,
  fillColor,
  fillOpacity,
  fillLightness,
  borderColor,
  borderOpacity,
  borderLightness,
  borderWidth,
  borderStyle,
}: BulkEditNodeIconProps) {
  const fill = computeColor(fillColor, fillOpacity, fillLightness) ?? "none";
  const stroke =
    computeColor(borderColor, borderOpacity, borderLightness) ?? "currentColor";
  const sw = borderWidth ?? DEFAULT_STROKE_WIDTH;
  const dashArray = getStrokeDasharray(borderStyle);

  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox={ICON_VIEWBOX}
      fill={shape === "text" ? "none" : fill}
      stroke={stroke}
      strokeWidth={sw}
      strokeDasharray={dashArray}
      className="shrink-0"
    >
      {getShapeSvg(shape)}
    </svg>
  );
});
