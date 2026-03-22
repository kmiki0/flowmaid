"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { NodeWrapper } from "./NodeWrapper";
import type { FlowNode } from "@/store/types";
import { strokeDasharray } from "./svgBorderUtils";
import { computeColor } from "@/lib/color";

export const ManualInputNode = memo(function ManualInputNode({ id, data, selected }: NodeProps<FlowNode>) {
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
          points="0,20 100,0 100,100 0,100"
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
        className="relative px-4 pt-4 pb-2"
      />
    </div>
  );
});
