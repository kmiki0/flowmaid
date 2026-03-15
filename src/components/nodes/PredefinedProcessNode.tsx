"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { NodeWrapper } from "./NodeWrapper";
import type { FlowNode } from "@/store/types";
import { strokeDasharray } from "./svgBorderUtils";
import { computeColor } from "@/lib/color";

export const PredefinedProcessNode = memo(function PredefinedProcessNode({ id, data, selected }: NodeProps<FlowNode>) {
  const sw = data.borderWidth ?? 2;
  const dash = strokeDasharray(data.borderStyle);
  const fill = computeColor(data.fillColor, data.fillOpacity, data.fillLightness) ?? "var(--background)";
  const stroke = computeColor(data.borderColor, data.borderOpacity, data.borderLightness) ?? undefined;
  return (
    <div className="relative w-full h-full">
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <rect
          x="0" y="0" width="100" height="100"
          fill={fill}
          stroke={stroke ?? "var(--color-muted-foreground)"}
          className={!stroke ? "stroke-muted-foreground" : ""}
          strokeWidth={sw}
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1="10" y1="0" x2="10" y2="100"
          stroke={stroke ?? "var(--color-muted-foreground)"}
          className={!stroke ? "stroke-muted-foreground" : ""}
          strokeWidth={sw}
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1="90" y1="0" x2="90" y2="100"
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
        bold={data.bold}
        italic={data.italic}
        underline={data.underline}
        isLocked={data.isLocked}
        isComponentChild={!!data.componentParentId}
        className="relative px-6 py-2"
      />
    </div>
  );
});
