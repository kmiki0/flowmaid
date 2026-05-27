"use client";

import { memo, useCallback, useState, useRef, useEffect } from "react";
import type { NodeProps } from "@xyflow/react";
import { NodeResizer } from "@xyflow/react";
import { Plus, Pencil } from "lucide-react";
import { PortRow } from "./PortRow";
import { TableEditDialog } from "./TableEditDialog";
import { useNodeEditorStore } from "../store/useNodeEditorStore";
import type { NodeEditorNode } from "../store/types";

const KIND_ICONS: Record<string, string> = {
  generic: "◆",
  service: "⚡",
  table: "🗃",
};

const KIND_DEFAULT_COLORS: Record<string, string> = {
  generic: "var(--color-primary)",
  service: "#3b82f6",
  table: "#8b5cf6",
};

function CardNodeInner({ id, data, selected }: NodeProps<NodeEditorNode>) {
  const updateNodeLabel = useNodeEditorStore((s) => s.updateNodeLabel);
  const updateNodeStyle = useNodeEditorStore((s) => s.updateNodeStyle);
  const addPort = useNodeEditorStore((s) => s.addPort);
  const showLogicalName = useNodeEditorStore((s) => s.showLogicalName);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const headerColor = data.fillColor ?? KIND_DEFAULT_COLORS[data.kind] ?? KIND_DEFAULT_COLORS.generic;
  const inputPorts = data.ports.filter((p) => p.direction === "input");
  const bidirectionalPorts = data.ports.filter((p) => p.direction === "bidirectional");
  const outputPorts = data.ports.filter((p) => p.direction === "output");

  // Determine which name to display and edit
  const isLogicalMode = showLogicalName && data.kind === "table";
  const displayName = isLogicalMode ? (data.logicalName || data.label) : data.label;
  const subName = isLogicalMode ? data.label : data.logicalName;

  const handleDoubleClick = useCallback(() => {
    setEditValue(displayName);
    setIsEditing(true);
  }, [displayName]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (editValue.trim() && editValue !== displayName) {
      if (isLogicalMode) {
        updateNodeStyle(id, { logicalName: editValue.trim() });
      } else {
        updateNodeLabel(id, editValue.trim());
      }
    }
  }, [id, editValue, displayName, isLogicalMode, updateNodeLabel, updateNodeStyle]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        (e.target as HTMLInputElement).blur();
      } else if (e.key === "Escape") {
        setEditValue(displayName);
        setIsEditing(false);
      }
    },
    [displayName]
  );

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleAddInput = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      addPort(id, data.kind === "table" ? "bidirectional" : "input");
    },
    [id, data.kind, addPort]
  );

  const handleAddOutput = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      addPort(id, "output");
    },
    [id, addPort]
  );

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={80}
        lineClassName="!border-primary !rounded-lg"
        handleClassName="!w-2 !h-2 !bg-primary !border-background !rounded-full"
      />
      <div
        className="relative flex flex-col bg-background border-2 rounded-lg shadow-md"
        style={{
          borderColor: data.borderColor ?? "var(--color-border)",
          borderWidth: data.borderWidth ?? 2,
          borderStyle: data.borderStyle ?? "solid",
          width: "100%",
          height: "100%",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white select-none rounded-t-md"
          style={{ backgroundColor: headerColor }}
          onDoubleClick={handleDoubleClick}
        >
          <span className="text-xs">{KIND_ICONS[data.kind] ?? "◆"}</span>
          {isEditing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="bg-transparent border-none outline-none text-white text-sm font-semibold w-full"
            />
          ) : (
            <span className="truncate flex-1">{displayName}</span>
          )}
          {/* Edit button for table nodes */}
          {data.kind === "table" && !isEditing && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsTableDialogOpen(true);
              }}
              className="shrink-0 w-6 h-6 rounded-md bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors cursor-pointer border border-white/30"
              title="Edit table"
            >
              <Pencil size={12} />
            </button>
          )}
        </div>

        {/* Service URL subtitle */}
        {data.kind === "service" && data.serviceUrl && (
          <div className="px-3 py-0.5 text-[10px] text-muted-foreground bg-muted/30 border-b border-border truncate">
            {data.serviceUrl}
          </div>
        )}

        {/* Ports */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Input ports */}
          {inputPorts.length > 0 && (
            <div className="border-b border-border">
              {inputPorts.map((port) => (
                <PortRow key={port.id} port={port} nodeId={id} nodeKind={data.kind} />
              ))}
            </div>
          )}

          {/* Bidirectional ports (table fields etc.) */}
          {bidirectionalPorts.length > 0 && (
            <div className={outputPorts.length > 0 ? "border-b border-border" : ""}>
              {bidirectionalPorts.map((port) => (
                <PortRow key={port.id} port={port} nodeId={id} nodeKind={data.kind} />
              ))}
            </div>
          )}

          {/* Output ports */}
          {outputPorts.length > 0 && (
            <div>
              {outputPorts.map((port) => (
                <PortRow key={port.id} port={port} nodeId={id} nodeKind={data.kind} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {data.ports.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground p-2">
              No ports
            </div>
          )}

          {/* Add port buttons (visible on hover) */}
          <div className="flex items-center justify-center gap-2 py-1 opacity-0 hover:opacity-100 transition-opacity border-t border-border/50">
            {data.kind === "table" ? (
              <button
                onClick={handleAddInput}
                className="flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-primary cursor-pointer"
              >
                <Plus size={10} /> Field
              </button>
            ) : (
              <>
                <button
                  onClick={handleAddInput}
                  className="flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-primary cursor-pointer"
                >
                  <Plus size={10} /> In
                </button>
                <span className="text-border">|</span>
                <button
                  onClick={handleAddOutput}
                  className="flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-primary cursor-pointer"
                >
                  <Plus size={10} /> Out
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table edit dialog */}
      {data.kind === "table" && (
        <TableEditDialog
          nodeId={id}
          open={isTableDialogOpen}
          onOpenChange={setIsTableDialogOpen}
        />
      )}
    </>
  );
}

export const CardNode = memo(CardNodeInner);
