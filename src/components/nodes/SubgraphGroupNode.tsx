"use client";

import { memo, useState } from "react";
import { NodeResizer, Position, type NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "@/types/flow";
import { ConnectHandle } from "./ConnectHandle";

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
        lineStyle={{ borderColor: "var(--color-primary)" }}
        handleStyle={{ backgroundColor: "var(--color-primary)" }}
      />
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
