"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { NodeWrapper } from "./NodeWrapper";
import type { FlowNode } from "@/store/types";
import { strokeDasharray } from "./svgBorderUtils";
import { computeColor } from "@/lib/color";

export const TrapezoidNode = memo(function TrapezoidNode({ id, data, selected }: NodeProps<FlowNode>) {
  const fill = computeColor(data.fillColor, data.fillOpacity, data.fillLightness) ?? "var(--background)";
  const stroke = computeColor(data.borderColor, data.borderOpacity, data.borderLightness) ?? undefined;
  return (
    <div className="relative w-full h-full">
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <polygon
          points="20,0 80,0 100,100 0,100"
          fill={fill}
          stroke={stroke ?? "var(--color-muted-foreground)"}
          className={!stroke ? "stroke-muted-foreground" : ""}
          strokeWidth={data.borderWidth ?? 2}
          strokeDasharray={strokeDasharray(data.borderStyle)}
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
