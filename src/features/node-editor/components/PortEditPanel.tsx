"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { Palette, Square, Type, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ColorDropdown } from "@/shared/components/ColorDropdown";
import { useNodeEditorStore } from "../store/useNodeEditorStore";
import { useLocale } from "@/lib/i18n/useLocale";
import type { NodeEditorPort, PortDirection } from "../types";

// Inline editable port name
function EditablePortName({
  port,
  nodeId,
}: {
  port: NodeEditorPort;
  nodeId: string;
}) {
  const updatePort = useNodeEditorStore((s) => s.updatePort);
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback(() => {
    setValue(port.name);
    setIsEditing(true);
  }, [port.name]);

  const commitEdit = useCallback(() => {
    setIsEditing(false);
    if (value.trim() && value !== port.name) {
      updatePort(nodeId, port.id, { name: value.trim() });
    }
  }, [nodeId, port.id, port.name, value, updatePort]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        (e.target as HTMLInputElement).blur();
      } else if (e.key === "Escape") {
        setIsEditing(false);
      }
    },
    []
  );

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
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={handleKeyDown}
        className="flex-1 min-w-0 text-xs bg-transparent border border-border rounded px-1 py-0.5 outline-none focus:border-primary"
      />
    );
  }

  return (
    <span
      className="flex-1 min-w-0 text-xs truncate cursor-pointer hover:text-primary"
      onDoubleClick={startEdit}
      title="Double-click to edit"
    >
      {port.name}
    </span>
  );
}

// Inline editable data type
function EditableDataType({
  port,
  nodeId,
}: {
  port: NodeEditorPort;
  nodeId: string;
}) {
  const updatePort = useNodeEditorStore((s) => s.updatePort);
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback(() => {
    setValue(port.dataType ?? "");
    setIsEditing(true);
  }, [port.dataType]);

  const commitEdit = useCallback(() => {
    setIsEditing(false);
    const trimmed = value.trim() || undefined;
    if (trimmed !== port.dataType) {
      updatePort(nodeId, port.id, { dataType: trimmed });
    }
  }, [nodeId, port.id, port.dataType, value, updatePort]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        (e.target as HTMLInputElement).blur();
      } else if (e.key === "Escape") {
        setIsEditing(false);
      }
    },
    []
  );

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
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={handleKeyDown}
        className="w-16 text-[10px] bg-transparent border border-border rounded px-1 py-0.5 outline-none focus:border-primary text-muted-foreground"
        placeholder="type"
      />
    );
  }

  return (
    <span
      className="text-[10px] text-muted-foreground cursor-pointer hover:text-primary shrink-0"
      onDoubleClick={startEdit}
      title="Double-click to edit type"
    >
      {port.dataType || "—"}
    </span>
  );
}

function PortList({
  ports,
  nodeId,
  direction,
  label,
}: {
  ports: NodeEditorPort[];
  nodeId: string;
  direction: "input" | "output";
  label: string;
}) {
  const addPort = useNodeEditorStore((s) => s.addPort);
  const removePort = useNodeEditorStore((s) => s.removePort);

  const directionPorts = ports.filter(
    (p) => p.direction === direction || p.direction === "bidirectional"
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => addPort(nodeId, direction as PortDirection)}
        >
          <Plus size={12} />
        </Button>
      </div>
      {directionPorts.length === 0 ? (
        <div className="text-[10px] text-muted-foreground/50 py-1 px-2">—</div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {directionPorts.map((port) => (
            <div key={port.id} className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-muted/50 group">
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              <EditablePortName port={port} nodeId={nodeId} />
              <EditableDataType port={port} nodeId={nodeId} />
              <button
                onClick={() => removePort(nodeId, port.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PortEditPanel() {
  const { t } = useLocale();

  // Get selected node
  const selectedNode = useNodeEditorStore((s) => {
    const sel = s.nodes.filter((n) => n.selected);
    return sel.length === 1 ? sel[0] : null;
  });

  const updateNodeStyle = useNodeEditorStore((s) => s.updateNodeStyle);

  if (!selectedNode) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        {t("neSelectNode")}
      </div>
    );
  }

  const { id, data } = selectedNode;

  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto">
      {/* Node name */}
      <div className="text-xs font-semibold truncate">{data.label}</div>

      <Separator />

      {/* Ports */}
      <PortList ports={data.ports} nodeId={id} direction="input" label={t("neInputPorts")} />
      <PortList ports={data.ports} nodeId={id} direction="output" label={t("neOutputPorts")} />

      <Separator />

      {/* Style */}
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
        {t("neStyle")}
      </span>
      <div className="flex items-center gap-1 flex-wrap">
        {/* Fill color */}
        <ColorDropdown
          label={t("neFillColor")}
          icon={<Palette size={14} />}
          currentColor={data.fillColor}
          opacity={data.fillOpacity}
          onSelect={(color) => updateNodeStyle(id, { fillColor: color ?? undefined })}
          onOpacityChange={(v) => updateNodeStyle(id, { fillOpacity: v })}
        />

        {/* Border color */}
        <ColorDropdown
          label={t("neBorderColor")}
          icon={<Square size={14} />}
          currentColor={data.borderColor}
          onSelect={(color) => updateNodeStyle(id, { borderColor: color ?? undefined })}
        />

        {/* Text color */}
        <ColorDropdown
          label={t("neTextColor")}
          icon={<Type size={14} />}
          currentColor={data.textColor}
          onSelect={(color) => updateNodeStyle(id, { textColor: color ?? undefined })}
        />
      </div>

      {/* Border style */}
      <div className="flex items-center gap-1">
        {([1, 2, 4] as const).map((w) => (
          <Button
            key={w}
            variant={data.borderWidth === w ? "secondary" : "ghost"}
            size="sm"
            className="h-6 w-6 p-0 text-[10px]"
            onClick={() => updateNodeStyle(id, { borderWidth: w })}
          >
            {w}
          </Button>
        ))}
        <Separator orientation="vertical" className="h-4 mx-1" />
        {(["solid", "dashed", "dotted"] as const).map((s) => (
          <Button
            key={s}
            variant={data.borderStyle === s ? "secondary" : "ghost"}
            size="sm"
            className="h-6 px-1.5 text-[10px]"
            onClick={() => updateNodeStyle(id, { borderStyle: s })}
          >
            {s === "solid" ? "—" : s === "dashed" ? "- -" : "···"}
          </Button>
        ))}
      </div>
    </div>
  );
}
