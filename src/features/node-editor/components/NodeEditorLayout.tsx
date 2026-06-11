"use client";

import { useCallback, useRef } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { NodeEditorCanvas } from "./NodeEditorCanvas";
import { NodeEditorPalette } from "./NodeEditorPalette";
import { NodeEditorToolbar } from "./NodeEditorToolbar";
import { NodeEditorFormatBar } from "./NodeEditorFormatBar";
import { useNodeEditorAutoSave } from "../hooks/useNodeEditorAutoSave";
import { useNodeEditorKeyboard } from "../hooks/useNodeEditorKeyboard";
import { useNodeEditorStore } from "../store/useNodeEditorStore";
import { serializeNodeEditor, deserializeNodeEditor } from "../lib/serialize";
import { toast } from "sonner";
import { useLocale } from "@/lib/i18n/useLocale";

interface NodeEditorLayoutProps {
  onSwitchMode: () => void;
  titleSlot?: React.ReactNode;
}

export function NodeEditorLayout({ onSwitchMode, titleSlot }: NodeEditorLayoutProps) {
  useNodeEditorAutoSave();
  useNodeEditorKeyboard();
  const { t } = useLocale();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(() => {
    const { nodes, edges, subMode } = useNodeEditorStore.getState();
    const content = serializeNodeEditor(nodes, edges, subMode);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diagram.nodeeditor";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const content = ev.target?.result as string;
          const result = deserializeNodeEditor(content);
          useNodeEditorStore.getState().loadState(result);
          toast.success(t("importedSuccess"));
        } catch (err) {
          console.error("Nodeeditor import failed:", err);
          toast.error(t("importFailed"));
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [t]
  );

  return (
    <ReactFlowProvider>
      <div className="h-full w-full flex flex-col">
        <NodeEditorToolbar
          onSwitchMode={onSwitchMode}
          titleSlot={titleSlot}
          onExport={handleExport}
          onImport={handleImport}
        />
        <NodeEditorFormatBar />
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel - palette */}
          <div className="w-56 border-r border-border bg-background shrink-0 overflow-y-auto">
            <NodeEditorPalette />
          </div>

          {/* Canvas */}
          <div className="flex-1 min-w-0">
            <NodeEditorCanvas />
          </div>

          {/* Right panel - output (hidden for now) */}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".nodeeditor"
        className="hidden"
        onChange={handleFileChange}
      />
    </ReactFlowProvider>
  );
}
