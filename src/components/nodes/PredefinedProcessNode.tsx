"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { NodeWrapper } from "./NodeWrapper";
import type { FlowNode } from "@/store/types";
import { strokeDasharray } from "./svgBorderUtils";
import { computeColor } from "@/lib/color";

/** Fixed offset (px) for the side lines */
const SIDE_LINE_OFFSET = 12;

export const PredefinedProcessNode = memo(function PredefinedProcessNode({ id, data, selected, width, height }: NodeProps<FlowNode>) {
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
          x1={SIDE_LINE_OFFSET} y1="0" x2={SIDE_LINE_OFFSET} y2={h}
          stroke={stroke ?? "var(--color-muted-foreground)"}
          className={!stroke ? "stroke-muted-foreground" : ""}
          strokeWidth={sw}
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={w - SIDE_LINE_OFFSET} y1="0" x2={w - SIDE_LINE_OFFSET} y2={h}
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
        className="relative px-6 py-2"
      />
    </div>
  );
});
