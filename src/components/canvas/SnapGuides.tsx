"use client";

import { useStore } from "@xyflow/react";
import type { GuideLine } from "@/hooks/useSnapGuides";

const COLOR = "#f97316";

export function SnapGuides({ guides }: { guides: GuideLine[] }) {
  const transform = useStore((s) => s.transform);

  if (guides.length === 0) return null;

  const [tx, ty, scale] = transform;
  const lineW = 1 / scale;
  const dotR = 3 / scale;

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
        {guides.map((g, i) => {
          if (g.kind === "alignment") {
            // Short line with dot markers at both endpoints
            if (g.orientation === "vertical") {
              return (
                <g key={i}>
                  <line
                    x1={g.pos}
                    y1={g.from}
                    x2={g.pos}
                    y2={g.to}
                    stroke={COLOR}
                    strokeWidth={lineW}
                  />
                  <circle cx={g.pos} cy={g.from} r={dotR} fill={COLOR} />
                  <circle cx={g.pos} cy={g.to} r={dotR} fill={COLOR} />
                </g>
              );
            }
            return (
              <g key={i}>
                <line
                  x1={g.from}
                  y1={g.pos}
                  x2={g.to}
                  y2={g.pos}
                  stroke={COLOR}
                  strokeWidth={lineW}
                />
                <circle cx={g.from} cy={g.pos} r={dotR} fill={COLOR} />
                <circle cx={g.to} cy={g.pos} r={dotR} fill={COLOR} />
              </g>
            );
          }

          if (g.kind !== "size-match") return null;
          // size-match
          const { a, b, dimension, value } = g;
          const fontSize = 11 / scale;
          const padX = 4 / scale;
          const padY = 2 / scale;
          const labelText = `${Math.round(value)}`;
          const charW = fontSize * 0.6;
          const labelW = labelText.length * charW + padX * 2;
          const labelH = fontSize + padY * 2;
          const gap = 6 / scale;

          const renderLabel = (cx: number, cy: number) => (
            <>
              <rect
                x={cx - labelW / 2}
                y={cy - labelH / 2}
                width={labelW}
                height={labelH}
                rx={2 / scale}
                fill={COLOR}
              />
              <text
                x={cx}
                y={cy + fontSize / 3}
                fontSize={fontSize}
                fill="white"
                textAnchor="middle"
                fontWeight="600"
                fontFamily="system-ui, sans-serif"
              >
                {labelText}
              </text>
            </>
          );

          const capLen = 5 / scale;
          const thickW = 2 / scale;
          if (dimension === "width") {
            // Highlight top edge of both nodes with dimension-style caps
            return (
              <g key={i}>
                {/* a: resizing node top edge */}
                <line x1={a.x} y1={a.y} x2={a.x + a.w} y2={a.y} stroke={COLOR} strokeWidth={thickW} />
                <line x1={a.x} y1={a.y - capLen} x2={a.x} y2={a.y + capLen} stroke={COLOR} strokeWidth={thickW} />
                <line x1={a.x + a.w} y1={a.y - capLen} x2={a.x + a.w} y2={a.y + capLen} stroke={COLOR} strokeWidth={thickW} />
                {/* b: matching node top edge */}
                <line x1={b.x} y1={b.y} x2={b.x + b.w} y2={b.y} stroke={COLOR} strokeWidth={thickW} />
                <line x1={b.x} y1={b.y - capLen} x2={b.x} y2={b.y + capLen} stroke={COLOR} strokeWidth={thickW} />
                <line x1={b.x + b.w} y1={b.y - capLen} x2={b.x + b.w} y2={b.y + capLen} stroke={COLOR} strokeWidth={thickW} />
                {renderLabel(a.x + a.w / 2, a.y - gap - labelH / 2)}
                {renderLabel(b.x + b.w / 2, b.y - gap - labelH / 2)}
              </g>
            );
          }

          // height match — highlight left edge of both nodes with dimension-style caps
          if (g.kind === "size-match") {
            return (
              <g key={i}>
                {/* a: resizing node left edge */}
                <line x1={a.x} y1={a.y} x2={a.x} y2={a.y + a.h} stroke={COLOR} strokeWidth={thickW} />
                <line x1={a.x - capLen} y1={a.y} x2={a.x + capLen} y2={a.y} stroke={COLOR} strokeWidth={thickW} />
                <line x1={a.x - capLen} y1={a.y + a.h} x2={a.x + capLen} y2={a.y + a.h} stroke={COLOR} strokeWidth={thickW} />
                {/* b: matching node left edge */}
                <line x1={b.x} y1={b.y} x2={b.x} y2={b.y + b.h} stroke={COLOR} strokeWidth={thickW} />
                <line x1={b.x - capLen} y1={b.y} x2={b.x + capLen} y2={b.y} stroke={COLOR} strokeWidth={thickW} />
                <line x1={b.x - capLen} y1={b.y + b.h} x2={b.x + capLen} y2={b.y + b.h} stroke={COLOR} strokeWidth={thickW} />
                {renderLabel(a.x - gap - labelW / 2, a.y + a.h / 2)}
                {renderLabel(b.x - gap - labelW / 2, b.y + b.h / 2)}
              </g>
            );
          }
          return null;
        })}
        {/* spacing guides rendered separately so they appear above */}
        {guides.map((g, i) => {
          if (g.kind !== "spacing") return null;
          const fontSize = 11 / scale;
          const padX = 4 / scale;
          const padY = 2 / scale;
          const labelText = `${Math.round(g.gap)}`;
          const charW = fontSize * 0.6;
          const labelW = labelText.length * charW + padX * 2;
          const labelH = fontSize + padY * 2;
          const arrowSize = 4 / scale;
          const lineW = 1.5 / scale;

          if (g.axis === "horizontal") {
            // pos is the y level; segments are x ranges
            return (
              <g key={`s${i}`}>
                {g.segments.map((seg, j) => {
                  const cx = (seg.from + seg.to) / 2;
                  return (
                    <g key={j}>
                      <line x1={seg.from} y1={g.pos} x2={seg.to} y2={g.pos} stroke={COLOR} strokeWidth={lineW} />
                      {/* arrow caps */}
                      <line x1={seg.from} y1={g.pos - arrowSize} x2={seg.from} y2={g.pos + arrowSize} stroke={COLOR} strokeWidth={lineW} />
                      <line x1={seg.to} y1={g.pos - arrowSize} x2={seg.to} y2={g.pos + arrowSize} stroke={COLOR} strokeWidth={lineW} />
                      <rect
                        x={cx - labelW / 2}
                        y={g.pos - labelH - 2 / scale}
                        width={labelW}
                        height={labelH}
                        rx={2 / scale}
                        fill={COLOR}
                      />
                      <text
                        x={cx}
                        y={g.pos - 2 / scale - padY}
                        fontSize={fontSize}
                        fill="white"
                        textAnchor="middle"
                        fontWeight="600"
                        fontFamily="system-ui, sans-serif"
                      >
                        {labelText}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          }
          // vertical axis: pos is x level, segments are y ranges
          return (
            <g key={`s${i}`}>
              {g.segments.map((seg, j) => {
                const cy = (seg.from + seg.to) / 2;
                return (
                  <g key={j}>
                    <line x1={g.pos} y1={seg.from} x2={g.pos} y2={seg.to} stroke={COLOR} strokeWidth={lineW} />
                    <line x1={g.pos - arrowSize} y1={seg.from} x2={g.pos + arrowSize} y2={seg.from} stroke={COLOR} strokeWidth={lineW} />
                    <line x1={g.pos - arrowSize} y1={seg.to} x2={g.pos + arrowSize} y2={seg.to} stroke={COLOR} strokeWidth={lineW} />
                    <rect
                      x={g.pos + 4 / scale}
                      y={cy - labelH / 2}
                      width={labelW}
                      height={labelH}
                      rx={2 / scale}
                      fill={COLOR}
                    />
                    <text
                      x={g.pos + 4 / scale + labelW / 2}
                      y={cy + fontSize / 3}
                      fontSize={fontSize}
                      fill="white"
                      textAnchor="middle"
                      fontWeight="600"
                      fontFamily="system-ui, sans-serif"
                    >
                      {labelText}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
