"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { NodeWrapper } from "./NodeWrapper";
import type { FlowNode } from "@/store/types";
import { strokeDasharray } from "./svgBorderUtils";
import { computeColor } from "@/lib/color";

export const CylinderNode = memo(function CylinderNode({ id, data, selected }: NodeProps<FlowNode>) {
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
        <path
          d="M 0,15 Q 0,0 50,0 Q 100,0 100,15 L 100,85 Q 100,100 50,100 Q 0,100 0,85 Z"
          fill={fill}
          stroke={stroke ?? "var(--color-muted-foreground)"}
          className={!stroke ? "stroke-muted-foreground" : ""}
          strokeWidth={sw}
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M 0,15 Q 0,30 50,30 Q 100,30 100,15"
          fill="none"
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
      ghostTargetHandle={data.ghostTargetHandle as string | undefined}
        className="relative px-4 py-6"
      />
    </div>
  );
});
