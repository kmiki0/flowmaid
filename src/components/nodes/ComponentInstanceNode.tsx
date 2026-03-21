"use client";

import { memo, useMemo, useState, useRef, useEffect, useCallback } from "react";
import { Handle, Position, NodeResizer, type NodeProps } from "@xyflow/react";
import { Minus, Plus } from "lucide-react";
import { ConnectHandle } from "./ConnectHandle";
import { useFlowStore } from "@/store/useFlowStore";
import { computeColor } from "@/lib/color";
import { calculateMinComponentSize } from "@/lib/component-children";
import { strokeDasharray } from "./svgBorderUtils";
import type { FlowNode } from "@/store/types";

export const ComponentInstanceNode = memo(function ComponentInstanceNode({ id, data, selected }: NodeProps<FlowNode>) {
  const collapsed = data.collapsed ?? false;
  const toggleComponentCollapse = useFlowStore((s) => s.toggleComponentCollapse);
  const updateComponentInstanceName = useFlowStore((s) => s.updateComponentInstanceName);
  const direction = data.componentDefinitionDirection ?? useFlowStore((s) => s.direction);
  const componentDef = useFlowStore((s) => {
    const defId = data.componentDefinitionId;
    return defId ? s.componentDefinitions.find((d) => d.id === defId) : undefined;
  });
  const minSize = useMemo(
    () => componentDef ? calculateMinComponentSize(componentDef) : { minWidth: 180, minHeight: 80 },
    [componentDef],
  );

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(data.componentInstanceName ?? "");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [hovered, setHovered] = useState(false);
  const handleVisible = hovered || !!selected;

  // Compute style colors
  const computedFill = computeColor(data.fillColor, data.fillOpacity, data.fillLightness);
  const computedBorder = computeColor(data.borderColor, data.borderOpacity, data.borderLightness);
  const computedText = computeColor(data.textColor, data.textOpacity, data.textLightness);
  const borderWidth = data.borderWidth ?? 2;
  const borderStyle = data.borderStyle ?? "solid";
  const fontSize = data.fontSize ?? 14;
  const textStyle: React.CSSProperties = {
    color: computedText ?? "var(--foreground)",
    fontWeight: data.bold ? "bold" : undefined,
    fontStyle: data.italic ? "italic" : undefined,
    textDecoration: data.underline ? "underline" : undefined,
  };

  // Direction-aware: TD → top=target, bottom=source; LR → left=target, right=source
  const entryPos = direction === "LR" ? Position.Left : Position.Top;
  const exitPos = direction === "LR" ? Position.Right : Position.Bottom;

  useEffect(() => {
    setNameValue(data.componentInstanceName ?? "");
  }, [data.componentInstanceName]);

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  const commitName = useCallback(() => {
    setEditingName(false);
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== (data.componentInstanceName ?? "")) {
      updateComponentInstanceName(id, trimmed);
    } else {
      setNameValue(data.componentInstanceName ?? "");
    }
  }, [nameValue, data.componentInstanceName, id, updateComponentInstanceName]);

  // Hidden handles for bridge edge internal connections (entry-incoming + exit-outgoing only)
  const bridgeHandles = (
    <>
      <Handle
        type="source"
        position={entryPos}
        id="bridge-entry-source"
        isConnectable={false}
        style={{ width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        type="target"
        position={exitPos}
        id="bridge-exit-target"
        isConnectable={false}
        style={{ width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
      />
    </>
  );

  // Collapsed view — predefined process shape (rectangle with vertical lines on sides)
  if (collapsed) {
    return (
      <div
        className="relative w-full h-full"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <rect
            x="0" y="0" width="100" height="100"
            fill={computedFill ?? "var(--muted)"}
            stroke={computedBorder ?? "var(--color-muted-foreground)"}
            strokeWidth={borderWidth}
            vectorEffect="non-scaling-stroke"
            strokeDasharray={strokeDasharray(borderStyle)}
          />
          <line
            x1="8" y1="0" x2="8" y2="100"
            stroke={computedBorder ?? "var(--color-muted-foreground)"}
            strokeWidth={borderWidth}
            vectorEffect="non-scaling-stroke"
            strokeDasharray={strokeDasharray(borderStyle)}
          />
          <line
            x1="92" y1="0" x2="92" y2="100"
            stroke={computedBorder ?? "var(--color-muted-foreground)"}
            strokeWidth={borderWidth}
            vectorEffect="non-scaling-stroke"
            strokeDasharray={strokeDasharray(borderStyle)}
          />
        </svg>
        <div className="relative flex items-center w-full h-full px-5" style={textStyle}>
          {editingName ? (
            <input
              ref={nameInputRef}
              className="nodrag bg-transparent outline-none border-b border-foreground/30 flex-1 min-w-0 text-center"
              style={{ color: "inherit", fontSize }}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") { setNameValue(data.componentInstanceName ?? ""); setEditingName(false); }
              }}
            />
          ) : (
            <span
              className="flex-1 font-medium truncate text-center cursor-default"
              style={{ fontSize }}
              onDoubleClick={(e) => { e.stopPropagation(); setEditingName(true); }}
            >
              {data.componentInstanceName ?? data.label}
            </span>
          )}
          <button
            className="nodrag shrink-0 flex items-center justify-center w-5 h-5 rounded border cursor-pointer"
            style={{ background: "var(--background)", borderColor: "color-mix(in srgb, var(--foreground) 50%, transparent)" }}
            onClick={() => toggleComponentCollapse(id)}
            title="Expand"
          >
            <Plus size={12} />
          </button>
        </div>
        <ConnectHandle pos={entryPos} type="target" visible={handleVisible} nodeId={id} />
        <ConnectHandle pos={entryPos} type="source" visible={handleVisible} nodeId={id} />
        <ConnectHandle pos={exitPos} type="target" visible={handleVisible} nodeId={id} />
        <ConnectHandle pos={exitPos} type="source" visible={handleVisible} nodeId={id} />
        {bridgeHandles}
      </div>
    );
  }

  // Expanded view - just a container with header; child nodes are rendered by React Flow
  return (
    <div
      className="w-full h-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <NodeResizer
        isVisible={!!selected}
        minWidth={minSize.minWidth}
        minHeight={minSize.minHeight}
        lineClassName="!border-primary"
        handleClassName="!w-2 !h-2 !bg-primary !border-primary"
      />
      <ConnectHandle pos={entryPos} type="target" visible={handleVisible} nodeId={id} />
      <ConnectHandle pos={entryPos} type="source" visible={handleVisible} nodeId={id} />
      <ConnectHandle pos={exitPos} type="target" visible={handleVisible} nodeId={id} />
      <ConnectHandle pos={exitPos} type="source" visible={handleVisible} nodeId={id} />
      {bridgeHandles}
      <div
        className="w-full h-full rounded-md overflow-hidden flex flex-col"
        style={{
          border: `${borderWidth}px ${borderStyle} ${computedBorder ?? "var(--color-muted-foreground)"}`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 shrink-0"
          style={{ background: computedFill ?? "var(--muted)", ...textStyle }}
        >
          {editingName ? (
            <input
              ref={nameInputRef}
              className="nodrag bg-transparent outline-none border-b border-foreground/30 flex-1 min-w-0"
              style={{ color: "inherit", fontSize }}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") { setNameValue(data.componentInstanceName ?? ""); setEditingName(false); }
              }}
            />
          ) : (
            <span
              className="font-semibold truncate flex-1 cursor-default"
              style={{ fontSize }}
              onDoubleClick={(e) => { e.stopPropagation(); setEditingName(true); }}
            >
              {data.componentInstanceName ?? data.label}
            </span>
          )}
          <button
            className="nodrag shrink-0 flex items-center justify-center w-5 h-5 rounded border cursor-pointer"
            style={{ background: "var(--background)", borderColor: "color-mix(in srgb, var(--foreground) 50%, transparent)" }}
            onClick={() => toggleComponentCollapse(id)}
            title="Collapse"
          >
            <Minus size={12} />
          </button>
        </div>

        {/* Body area - child nodes are rendered by React Flow as real nodes */}
        <div className="flex-1" style={{ background: "var(--background)" }} />
      </div>
    </div>
  );
});
