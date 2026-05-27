"use client";

import { useCallback } from "react";
import { Trash2 } from "lucide-react";
import { useNodeEditorStore } from "../store/useNodeEditorStore";
import { useLocale } from "@/lib/i18n/useLocale";
import type { Cardinality } from "../types";

const CARDINALITIES: { value: Cardinality; label: string }[] = [
  { value: "1:1", label: "1 : 1" },
  { value: "1:N", label: "1 : N" },
  { value: "N:M", label: "N : M" },
  { value: "0:1", label: "0 : 1" },
  { value: "0:N", label: "0 : N" },
];

interface EdgeContextMenuProps {
  edgeId: string;
  x: number;
  y: number;
  onClose: () => void;
}

export function EdgeContextMenu({ edgeId, x, y, onClose }: EdgeContextMenuProps) {
  const updateEdgeData = useNodeEditorStore((s) => s.updateEdgeData);
  const removeEdges = useNodeEditorStore((s) => s.removeEdges);
  const currentCardinality = useNodeEditorStore((s) =>
    s.edges.find((e) => e.id === edgeId)?.data?.cardinality
  );
  const { t } = useLocale();

  const handleSetCardinality = useCallback(
    (cardinality: Cardinality) => {
      updateEdgeData(edgeId, { cardinality });
      onClose();
    },
    [edgeId, updateEdgeData, onClose]
  );

  const handleClearCardinality = useCallback(() => {
    updateEdgeData(edgeId, { cardinality: undefined });
    onClose();
  }, [edgeId, updateEdgeData, onClose]);

  const handleDelete = useCallback(() => {
    removeEdges([edgeId]);
    onClose();
  }, [edgeId, removeEdges, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />

      {/* Menu */}
      <div
        className="fixed z-50 bg-popover border border-border rounded-md shadow-md py-1 min-w-[160px]"
        style={{ left: x, top: y }}
      >
        {/* Cardinality section */}
        <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          Cardinality
        </div>
        {CARDINALITIES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => handleSetCardinality(value)}
            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent cursor-pointer flex items-center justify-between ${
              currentCardinality === value ? "text-primary font-semibold" : ""
            }`}
          >
            {label}
            {currentCardinality === value && <span className="text-xs">✓</span>}
          </button>
        ))}
        {currentCardinality && (
          <button
            onClick={handleClearCardinality}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent cursor-pointer text-muted-foreground"
          >
            {t("colorDefault")}
          </button>
        )}

        <div className="border-t border-border my-1" />

        {/* Delete */}
        <button
          onClick={handleDelete}
          className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent cursor-pointer text-destructive flex items-center gap-2"
        >
          <Trash2 size={14} />
          {t("clearAll")}
        </button>
      </div>
    </>
  );
}
