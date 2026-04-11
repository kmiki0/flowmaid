"use client";

import { memo, useState } from "react";
import { NodeResizer, Position, type NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "@/types/flow";
import { ConnectHandle } from "./ConnectHandle";
import { useShiftKey } from "@/hooks/useShiftKey";

const HANDLE_POSITIONS = [Position.Top, Position.Right, Position.Bottom, Position.Left];

type SubgraphGroupNodeProps = NodeProps & {
  data: FlowNodeData;
};

export const SubgraphGroupNode = memo(function SubgraphGroupNode({
  id,
  data,
  selected,
}: SubgraphGroupNodeProps) {
  const label = data.label || id;
  const shiftPressed = useShiftKey();
  const [hovered, setHovered] = useState(false);
  const visible = hovered;

  return (
    <div
      className="relative w-full h-full rounded-lg border-2 border-dashed"
      style={{
        borderColor: selected
          ? "var(--color-primary)"
          : "var(--color-muted-foreground)",
        backgroundColor: "color-mix(in srgb, var(--color-muted) 30%, transparent)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <NodeResizer
        isVisible={!!selected}
        minWidth={100}
        minHeight={60}
        keepAspectRatio={shiftPressed}
        lineStyle={{ borderColor: "var(--color-primary)" }}
        handleStyle={{ backgroundColor: "var(--color-primary)" }}
      />
      {selected && shiftPressed && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
          <line x1="0" y1="0" x2="100%" y2="100%" stroke="#f97316" strokeWidth="1" strokeDasharray="4 3" strokeOpacity="0.6" />
        </svg>
      )}
      {HANDLE_POSITIONS.map((pos) => (
        <ConnectHandle key={`target-${pos}`} pos={pos} type="target" visible={visible} nodeId={id} />
      ))}
      {HANDLE_POSITIONS.map((pos) => (
        <ConnectHandle key={`source-${pos}`} pos={pos} type="source" visible={visible} nodeId={id} />
      ))}
      <div
        className="absolute top-1 left-2 text-xs font-semibold select-none pointer-events-none"
        style={{
          color: "var(--color-foreground)",
          opacity: 1,
        }}
      >
        {label}
      </div>
    </div>
  );
});
