"use client";

import { memo } from "react";
import type { PredictiveDirection } from "@/store/types";

interface PredictiveArrowHandleProps {
  nodeId: string;
  direction: PredictiveDirection;
  visible: boolean;
  onEnter: (nodeId: string, dir: PredictiveDirection) => void;
  onLeave: () => void;
  onClick: () => void;
}

const ARROW_SIZE = 16;

const positionStyles: Record<PredictiveDirection, React.CSSProperties> = {
  bottom: { bottom: `calc(-${ARROW_SIZE + 12}px / var(--rf-zoom, 1))`, left: "50%", transform: "translateX(-50%)" },
  top:    { top:    `calc(-${ARROW_SIZE + 12}px / var(--rf-zoom, 1))`, left: "50%", transform: "translateX(-50%)" },
  right:  { right:  `calc(-${ARROW_SIZE + 12}px / var(--rf-zoom, 1))`, top:  "50%", transform: "translateY(-50%)" },
  left:   { left:   `calc(-${ARROW_SIZE + 12}px / var(--rf-zoom, 1))`, top:  "50%", transform: "translateY(-50%)" },
};

const arrowPaths: Record<PredictiveDirection, string> = {
  bottom: "M 2 2 L 8 12 L 14 2",
  top:    "M 2 12 L 8 2 L 14 12",
  right:  "M 2 2 L 12 8 L 2 14",
  left:   "M 14 2 L 4 8 L 14 14",
};

export const PredictiveArrowHandle = memo(function PredictiveArrowHandle({
  nodeId,
  direction,
  visible,
  onEnter,
  onLeave,
  onClick,
}: PredictiveArrowHandleProps) {
  return (
    <div
      className="predictive-arrow-handle absolute z-[5]"
      style={{
        ...positionStyles[direction],
        opacity: visible ? 0.7 : 0,
        pointerEvents: visible ? "auto" : "none",
        cursor: "pointer",
        transition: "opacity 0.15s, transform 0.15s",
        width: `calc(${ARROW_SIZE}px / var(--rf-zoom, 1))`,
        height: `calc(${ARROW_SIZE}px / var(--rf-zoom, 1))`,
      }}
      onMouseEnter={() => onEnter(nodeId, direction)}
      onMouseLeave={onLeave}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 16 16"
        className="text-primary drop-shadow-sm"
      >
        <path
          d={arrowPaths[direction]}
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
});
