"use client";

import { memo, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { useFlowStore } from "@/store/useFlowStore";
import { perfCount } from "@/lib/perf";

interface ConnectHandleProps {
  pos: Position;
  type: "source" | "target";
  visible: boolean;
  connectable?: boolean;
  nodeId?: string;
}

export const ConnectHandle = memo(function ConnectHandle({ pos, type, visible, connectable = true, nodeId }: ConnectHandleProps) {
  perfCount("ConnectHandle");
  const [near, setNear] = useState(false);
  const handleId = `${pos}-${type}`;

  // Check if any edge is connected to this handle
  const isConnected = useFlowStore((s) => {
    if (!nodeId) return false;
    return s.edges.some((e) => {
      if (e.data?.isBridgeEdge) return false;
      if (type === "source") return e.source === nodeId && e.sourceHandle === handleId;
      return e.target === nodeId && e.targetHandle === handleId;
    });
  });

  // Check if a selected edge is connected to this handle
  // Note: must NOT reference isConnected here — zustand selectors are independent subscriptions
  // and using a stale closure value causes ring display to fail intermittently
  const hasSelectedEdge = useFlowStore((s) => {
    if (!nodeId) return false;
    return s.edges.some((e) => {
      if (!e.selected || e.data?.isBridgeEdge) return false;
      if (type === "source") return e.source === nodeId && e.sourceHandle === handleId;
      return e.target === nodeId && e.targetHandle === handleId;
    });
  });

  // Ring shows when: selected edge on this handle, OR handle is visible and connected
  const isRing = hasSelectedEdge || (visible && isConnected);
  const size = near ? 16 : isRing ? 14 : 10;

  return (
    <Handle
      type={type}
      position={pos}
      id={handleId}
      isConnectable={connectable}
      onMouseEnter={() => setNear(true)}
      onMouseLeave={() => setNear(false)}
      style={{
        width: connectable ? `calc(${size}px / var(--rf-zoom, 1))` : 0,
        height: connectable ? `calc(${size}px / var(--rf-zoom, 1))` : 0,
        background: isRing ? "transparent" : "var(--handle-color)",
        border: !connectable ? "none" : isRing ? "3px solid var(--primary)" : "2px solid var(--background)",
        borderRadius: "50%",
        opacity: visible || isRing ? 1 : 0,
        pointerEvents: visible || isRing ? "auto" : "none",
        transition: "opacity 0.15s ease, width 0.1s ease, height 0.1s ease",
        boxShadow: isRing ? "0 0 6px var(--primary)" : undefined,
        cursor: isRing ? "grab" : undefined,
        zIndex: isRing ? 10 : undefined,
      }}
    />
  );
});
