"use client";

import { useStore } from "@xyflow/react";
import type { GuideLine } from "@/hooks/useSnapGuides";

export function SnapGuides({ guides }: { guides: GuideLine[] }) {
  const transform = useStore((s) => s.transform);

  if (guides.length === 0) return null;

  const [tx, ty, scale] = transform;

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1000,
      }}
    >
      <g transform={`translate(${tx}, ${ty}) scale(${scale})`}>
        {guides.map((g, i) =>
          g.orientation === "vertical" ? (
            <line
              key={i}
              x1={g.pos}
              y1={g.from - 20}
              x2={g.pos}
              y2={g.to + 20}
              stroke="var(--handle-color)"
              strokeWidth={1 / scale}
              strokeDasharray={`${4 / scale} ${2 / scale}`}
            />
          ) : (
            <line
              key={i}
              x1={g.from - 20}
              y1={g.pos}
              x2={g.to + 20}
              y2={g.pos}
              stroke="var(--handle-color)"
              strokeWidth={1 / scale}
              strokeDasharray={`${4 / scale} ${2 / scale}`}
            />
          )
        )}
      </g>
    </svg>
  );
}
