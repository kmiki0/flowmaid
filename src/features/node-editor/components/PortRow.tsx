"use client";

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { Handle, Position } from "@xyflow/react";
import { Trash2 } from "lucide-react";
import type { NodeEditorPort, NodeEditorNodeKind } from "../types";
import { useNodeEditorStore } from "../store/useNodeEditorStore";

interface PortRowProps {
  port: NodeEditorPort;
  nodeId: string;
  nodeKind: NodeEditorNodeKind;
}

// Inline editable text field
function InlineEdit({
  value,
  onCommit,
  className,
  placeholder,
}: {
  value: string;
  onCommit: (val: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback(() => {
    setEditValue(value);
    setIsEditing(true);
  }, [value]);

  const commitEdit = useCallback(() => {
    setIsEditing(false);
    const trimmed = editValue.trim();
    if (trimmed !== value) {
      onCommit(trimmed);
    }
  }, [editValue, value, onCommit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      setIsEditing(false);
    }
  }, []);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`bg-transparent border border-border rounded px-0.5 outline-none focus:border-primary ${className ?? ""}`}
      />
    );
  }

  return (
    <span
      className={`cursor-pointer hover:text-primary ${className ?? ""}`}
      onDoubleClick={startEdit}
    >
      {value || placeholder || "—"}
    </span>
  );
}

// Constraint badge (clickable toggle for table nodes)
function ConstraintBadge({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`text-[9px] font-bold px-1 rounded cursor-pointer transition-all shrink-0 ${
        active
          ? `${color} opacity-100`
          : "text-muted-foreground/30 opacity-0 group-hover:opacity-60 hover:!opacity-100"
      }`}
      title={`Toggle ${label}`}
    >
      {label}
    </button>
  );
}

function PortRowInner({ port, nodeId, nodeKind }: PortRowProps) {
  const isInput = port.direction === "input" || port.direction === "bidirectional";
  const isOutput = port.direction === "output" || port.direction === "bidirectional";
  const isTable = nodeKind === "table";

  const updatePort = useNodeEditorStore((s) => s.updatePort);
  const removePort = useNodeEditorStore((s) => s.removePort);
  const showLogicalName = useNodeEditorStore((s) => s.showLogicalName);

  // Display name based on logical/physical toggle
  const displayName = (isTable && showLogicalName && port.logicalName) ? port.logicalName : port.name;

  // Check if this specific port's handle has a connected edge
  const targetHandleId = `port-${port.id}-target`;
  const sourceHandleId = `port-${port.id}-source`;
  const isLeftConnected = useNodeEditorStore((s) =>
    s.edges.some((e) => e.target === nodeId && e.targetHandle === targetHandleId)
  );
  const isRightConnected = useNodeEditorStore((s) =>
    s.edges.some((e) => e.source === nodeId && e.sourceHandle === sourceHandleId)
  );

  const handleNameCommit = useCallback(
    (val: string) => {
      if (isTable && showLogicalName) {
        updatePort(nodeId, port.id, { logicalName: val || undefined });
      } else {
        updatePort(nodeId, port.id, { name: val || port.name });
      }
    },
    [nodeId, port.id, port.name, isTable, showLogicalName, updatePort]
  );

  const handleTypeCommit = useCallback(
    (val: string) => updatePort(nodeId, port.id, { dataType: val || undefined }),
    [nodeId, port.id, updatePort]
  );

  // Handle positioned at card edge (half visible), using relative position within the row
  const handleBaseStyle = { top: "50%", transform: "translateY(-50%)" } as const;
  const handleLeftOpacity = isLeftConnected ? "!opacity-100" : "!opacity-0 group-hover:!opacity-100";
  const handleRightOpacity = isRightConnected ? "!opacity-100" : "!opacity-0 group-hover:!opacity-100";

  return (
    <div className="relative flex items-center px-3 py-1 text-xs min-h-[28px] group hover:bg-muted/50">
      {/* Input handle (left side) */}
      {isInput && (
        <Handle
          type="target"
          position={Position.Left}
          id={`port-${port.id}-target`}
          className={`!w-3 !h-3 !bg-primary !border-background !border-2 !-left-[7px] !transition-opacity ${handleLeftOpacity}`}
          style={handleBaseStyle}
        />
      )}

      {/* Port content */}
      <div className="flex items-center gap-1 flex-1 min-w-0">
        {isTable ? (
          /* Table nodes: read-only display (edit via modal only) */
          <>
            <span className="w-[18px] text-[9px] font-bold shrink-0 text-center">
              {port.isPrimaryKey ? <span className="text-amber-500">PK</span> : port.isForeignKey ? <span className="text-blue-500">FK</span> : null}
            </span>
            <span className="truncate flex-1 min-w-0 text-xs">{displayName}</span>
            <span className="text-muted-foreground text-[10px] shrink-0 w-[90px] text-right">{port.dataType ?? ""}</span>
            <span className="w-[16px] text-[9px] font-bold shrink-0 text-center">
              {port.isNotNull ? <span className="text-orange-500">NN</span> : null}
            </span>
            <span className="w-[16px] text-[9px] font-bold shrink-0 text-center">
              {port.isUnique ? <span className="text-green-500">UQ</span> : null}
            </span>
          </>
        ) : (
          /* Non-table nodes: interactive editing */
          <>
            {/* Port name (double-click to edit) */}
            <InlineEdit
              value={displayName}
              onCommit={handleNameCommit}
              className="truncate flex-1 min-w-0 text-xs"
            />

            {/* Data type (double-click to edit) */}
            <InlineEdit
              value={port.dataType ?? ""}
              onCommit={handleTypeCommit}
              className="text-muted-foreground text-[10px] shrink-0"
              placeholder="type"
            />

            {/* Delete button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removePort(nodeId, port.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0 ml-0.5"
            >
              <Trash2 size={10} />
            </button>
          </>
        )}
      </div>

      {/* Output handle (right side) */}
      {isOutput && (
        <Handle
          type="source"
          position={Position.Right}
          id={`port-${port.id}-source`}
          className={`!w-3 !h-3 !bg-primary !border-background !border-2 !-right-[7px] !transition-opacity ${handleRightOpacity}`}
          style={handleBaseStyle}
        />
      )}
    </div>
  );
}

export const PortRow = memo(PortRowInner);
