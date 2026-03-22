"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { NodeWrapper } from "./NodeWrapper";
import type { FlowNode } from "@/store/types";
import { strokeDasharray } from "./svgBorderUtils";
import { computeColor } from "@/lib/color";

/** Fixed offset (px) for the internal cross lines */
const CROSS_LINE_OFFSET = 15;

export const InternalStorageNode = memo(function InternalStorageNode({ id, data, selected, width, height }: NodeProps<FlowNode>) {
  const sw = data.borderWidth ?? 2;
  const dash = strokeDasharray(data.borderStyle);
  const fill = computeColor(data.fillColor, data.fillOpacity, data.fillLightness) ?? "var(--background)";
  const stroke = computeColor(data.borderColor, data.borderOpacity, data.borderLightness) ?? undefined;
  const w = width ?? 150;
  const h = height ?? 50;
  return (
    <div className="relative w-full h-full">
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 ${w} ${h}`}
      >
        <rect
          x="0" y="0" width={w} height={h}
          fill={fill}
          stroke={stroke ?? "var(--color-muted-foreground)"}
          className={!stroke ? "stroke-muted-foreground" : ""}
          strokeWidth={sw}
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={CROSS_LINE_OFFSET} y1="0" x2={CROSS_LINE_OFFSET} y2={h}
          stroke={stroke ?? "var(--color-muted-foreground)"}
          className={!stroke ? "stroke-muted-foreground" : ""}
          strokeWidth={sw}
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1="0" y1={CROSS_LINE_OFFSET} x2={w} y2={CROSS_LINE_OFFSET}
          stroke={stroke ?? "var(--color-muted-foreground)"}
          className={!stroke ? "stroke-muted-foreground" : ""}
          strokeWidth={sw}
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <NodeWrapper
        id={id}
        label={data.label}
        selected={selected}
        fontSize={data.fontSize}
        textColor={data.textColor}
        textOpacity={data.textOpacity}
        textLightness={data.textLightness}
        textAlign={data.textAlign}
        textVerticalAlign={data.textVerticalAlign}
        bold={data.bold}
        italic={data.italic}
        underline={data.underline}
        isLocked={data.isLocked}
        isComponentChild={!!data.componentParentId}
      ghostTargetHandle={data.ghostTargetHandle as string | undefined}
        className="relative px-5 pt-4 pb-2"
      />
    </div>
  );
});
