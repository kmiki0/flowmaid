"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, FileText, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/useLocale";
import { useFlowStore } from "@/store/useFlowStore";
import { serialize } from "@/lib/flowmaid/serialize";
import { parseLayoutOnly } from "@/lib/flowmaid/deserialize";
import type { FlowmaidLayout } from "@/lib/flowmaid/schema";

/** File metadata displayed after selection */
interface FileMeta {
  fileSize: number;
  lastModified: Date;
  nodeCount: number;
  edgeCount: number;
}

const BYTES_PER_KB = 1024;

function formatFileSize(bytes: number): string {
  if (bytes < BYTES_PER_KB) return `${bytes} B`;
  return `${(bytes / BYTES_PER_KB).toFixed(1)} KB`;
}

function formatDate(date: Date): string {
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getLayoutCounts(layout: FlowmaidLayout): { nodeCount: number; edgeCount: number } {
  return {
    nodeCount: Object.keys(layout.nodes).length,
    edgeCount: Object.keys(layout.edges).length,
  };
}

interface FileSlotProps {
  label: string;
  layout: FlowmaidLayout | null;
  fileName: string | null;
  fileMeta: FileMeta | null;
  onFileSelect: (layout: FlowmaidLayout, fileName: string, meta: FileMeta) => void;
  onClear: () => void;
  showUseCurrentCanvas?: boolean;
}

function FileSlot({ label, layout, fileName, fileMeta, onFileSelect, onClear, showUseCurrentCanvas }: FileSlotProps) {
  const { t } = useLocale();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const hasContent = useFlowStore((s) => s.nodes.length > 0 || s.edges.length > 0);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string;
        const parsed = parseLayoutOnly(content);
        const counts = getLayoutCounts(parsed);
        const meta: FileMeta = {
          fileSize: file.size,
          lastModified: new Date(file.lastModified),
          ...counts,
        };
        onFileSelect(parsed, file.name, meta);
      } catch {
        // Parse error — ignore silently
      }
    };
    reader.readAsText(file);
  }, [onFileSelect]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }, [handleFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".flowmaid")) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleUseCurrentCanvas = useCallback(() => {
    const { nodes, edges, direction, componentDefinitions } = useFlowStore.getState();
    const content = serialize(nodes, edges, direction, componentDefinitions);
    const parsed = parseLayoutOnly(content);
    const counts = getLayoutCounts(parsed);
    const meta: FileMeta = {
      fileSize: new Blob([content]).size,
      lastModified: new Date(),
      ...counts,
    };
    onFileSelect(parsed, t("diffUseCurrentCanvas"), meta);
  }, [onFileSelect, t]);

  if (layout && fileName && fileMeta) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground">{label}</h3>
        <div className="flex flex-col items-center gap-2 px-6 py-4 rounded-lg border border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium">{fileName}</span>
          </div>
          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            <span>{formatFileSize(fileMeta.fileSize)} &middot; {formatDate(fileMeta.lastModified)}</span>
            <span>{fileMeta.nodeCount} nodes &middot; {fileMeta.edgeCount} edges</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear} className="gap-1.5 text-xs">
          <X size={14} />
          {t("diffClear")}
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center h-full gap-4 transition-colors ${
        isDragOver ? "bg-primary/5" : ""
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <h3 className="text-sm font-semibold text-muted-foreground">{label}</h3>

      <div
        className={`flex flex-col items-center gap-3 p-8 rounded-lg border-2 border-dashed transition-colors ${
          isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30"
        }`}
      >
        <Upload size={24} className="text-muted-foreground" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          {t("diffSelectFile")}
        </Button>
        <span className="text-xs text-muted-foreground">{t("diffDropFile")}</span>
      </div>

      {showUseCurrentCanvas && hasContent && (
        <Button
          variant="secondary"
          size="sm"
          onClick={handleUseCurrentCanvas}
          className="gap-1.5 text-xs"
        >
          {t("diffUseCurrentCanvas")}
        </Button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".flowmaid"
        className="hidden"
        onChange={handleFileInputChange}
      />
    </div>
  );
}

interface DiffImportPanelProps {
  baseLayout: FlowmaidLayout | null;
  baseFileName: string | null;
  baseMeta: FileMeta | null;
  compareLayout: FlowmaidLayout | null;
  compareFileName: string | null;
  compareMeta: FileMeta | null;
  onBaseSelect: (layout: FlowmaidLayout, fileName: string, meta: FileMeta) => void;
  onCompareSelect: (layout: FlowmaidLayout, fileName: string, meta: FileMeta) => void;
  onBaseClear: () => void;
  onCompareClear: () => void;
  onRunCompare: () => void;
  onExit: () => void;
}

export function DiffImportPanel({
  baseLayout,
  baseFileName,
  baseMeta,
  compareLayout,
  compareFileName,
  compareMeta,
  onBaseSelect,
  onCompareSelect,
  onBaseClear,
  onCompareClear,
  onRunCompare,
  onExit,
}: DiffImportPanelProps) {
  const { t } = useLocale();
  const canCompare = baseLayout !== null && compareLayout !== null;

  return (
    <div className="relative flex flex-col h-full w-full">
      {/* Back button — same style as BulkEditCanvas */}
      <div className="absolute z-10" style={{ top: 10, left: 10 }}>
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-background/80 border border-border text-xs text-foreground backdrop-blur-sm hover:bg-accent cursor-pointer"
        >
          <ArrowLeft size={14} />
          {t("diffBack")}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 border-r border-border">
          <FileSlot
            label={t("diffSelectBase")}
            layout={baseLayout}
            fileName={baseFileName}
            fileMeta={baseMeta}
            onFileSelect={onBaseSelect}
            onClear={onBaseClear}
            showUseCurrentCanvas
          />
        </div>
        <div className="flex-1">
          <FileSlot
            label={t("diffSelectCompare")}
            layout={compareLayout}
            fileName={compareFileName}
            fileMeta={compareMeta}
            onFileSelect={onCompareSelect}
            onClear={onCompareClear}
          />
        </div>
      </div>
      <div className="flex justify-center py-4 border-t border-border">
        <Button
          onClick={onRunCompare}
          disabled={!canCompare}
          className="px-8"
        >
          {t("diffRunCompare")}
        </Button>
      </div>
    </div>
  );
}

export type { FileMeta };
