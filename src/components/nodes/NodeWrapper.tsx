"use client";

import { memo, useState } from "react";
import { Position, NodeResizer } from "@xyflow/react";
import { NodeLabel } from "./NodeLabel";
import { ConnectHandle } from "./ConnectHandle";
import { computeColor } from "@/lib/color";
import type { TextAlign } from "@/types/flow";
import { perfCount } from "@/lib/perf";

interface NodeWrapperProps {
  id: string;
  label: string;
  selected?: boolean;
  className?: string;
  style?: React.CSSProperties;
  fillColor?: string;
  fillOpacity?: number;
  fillLightness?: number;
  borderColor?: string;
  borderOpacity?: number;
  borderLightness?: number;
  borderWidth?: number;
  borderStyle?: string;
  fontSize?: number;
  textColor?: string;
  textOpacity?: number;
  textLightness?: number;
  textAlign?: TextAlign;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  isLocked?: boolean;
  isComponentChild?: boolean;
}

const positions = [Position.Top, Position.Right, Position.Bottom, Position.Left];

export const NodeWrapper = memo(function NodeWrapper({
  id,
  label,
  selected,
  className = "",
  style,
  fillColor,
  fillOpacity,
  fillLightness,
  borderColor,
  borderOpacity,
  borderLightness,
  borderWidth,
  borderStyle,
  fontSize,
  textColor,
  textOpacity,
  textLightness,
  textAlign,
  bold,
  italic,
  underline,
  isLocked,
  isComponentChild,
}: NodeWrapperProps) {
  perfCount("NodeWrapper");
  const [hovered, setHovered] = useState(false);
  const visible = !isComponentChild && hovered;

  const colorStyle: React.CSSProperties = {};
  const computedFill = computeColor(fillColor, fillOpacity, fillLightness);
  const computedBorder = computeColor(borderColor, borderOpacity, borderLightness);
  const computedText = computeColor(textColor, textOpacity, textLightness);
  if (computedFill !== undefined) colorStyle.backgroundColor = computedFill;
  if (computedBorder !== undefined) colorStyle.borderColor = computedBorder;
  if (borderWidth) colorStyle.borderWidth = borderWidth;
  if (borderStyle) colorStyle.borderStyle = borderStyle;

  return (
    <>
      <NodeResizer
        isVisible={!isComponentChild && !!selected}
        minWidth={60}
        minHeight={30}
        lineClassName="!border-primary"
        handleClassName="!w-2 !h-2 !bg-primary !border-primary"
      />
      <div
        className={`relative flex items-center w-full h-full ${
          textAlign === "left" ? "justify-start" : textAlign === "right" ? "justify-end" : "justify-center"
        } ${className}`}
        style={{ ...style, ...colorStyle }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {positions.map((pos) => (
          <ConnectHandle key={`target-${pos}`} pos={pos} type="target" visible={isComponentChild ? false : visible} connectable={!isComponentChild} nodeId={id} />
        ))}
        {isLocked && (
          <span className="absolute top-1 right-2 text-amber-500 dark:text-yellow-400" title="Locked">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </span>
        )}
        <NodeLabel
          id={id}
          label={label}
          fontSize={fontSize}
          textColor={computedText}
          textAlign={textAlign}
          bold={bold}
          italic={italic}
          underline={underline}
          isLocked={isLocked}
        />
        {positions.map((pos) => (
          <ConnectHandle key={`source-${pos}`} pos={pos} type="source" visible={isComponentChild ? false : visible} connectable={!isComponentChild} nodeId={id} />
        ))}
      </div>
    </>
  );
});
