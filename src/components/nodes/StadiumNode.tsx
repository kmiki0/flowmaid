"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { NodeWrapper } from "./NodeWrapper";
import type { FlowNode } from "@/store/types";

export const StadiumNode = memo(function StadiumNode({ id, data, selected }: NodeProps<FlowNode>) {
  return (
    <NodeWrapper
      id={id}
      label={data.label}
      selected={selected}
      fillColor={data.fillColor}
      fillOpacity={data.fillOpacity}
      fillLightness={data.fillLightness}
      borderColor={data.borderColor}
      borderOpacity={data.borderOpacity}
      borderLightness={data.borderLightness}
      borderWidth={data.borderWidth}
      borderStyle={data.borderStyle}
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
      className="bg-background border-2 border-muted-foreground rounded-full px-6 py-2"
    />
  );
});
