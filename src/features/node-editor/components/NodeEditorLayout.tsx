"use client";

import { useCallback, useRef, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { NodeEditorCanvas } from "./NodeEditorCanvas";
import { NodeEditorPalette } from "./NodeEditorPalette";
import { NodeEditorToolbar } from "./NodeEditorToolbar";
import { NodeEditorFormatBar } from "./NodeEditorFormatBar";
import { useNodeEditorAutoSave } from "../hooks/useNodeEditorAutoSave";
import { useNodeEditorKeyboard } from "../hooks/useNodeEditorKeyboard";
import { useNodeEditorStore, composePages } from "../store/useNodeEditorStore";
import { NodeEditorPageTabs, type PageTabsPosition } from "./NodeEditorPageTabs";
import { NODE_EDITOR_TABS_POSITION_KEY } from "../lib/constants";
import { serializeNodeEditor, serializeNodeEditorSinglePage, deserializeNodeEditor } from "../lib/serialize";
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

  // ページタブの表示位置（left: 縦タブ / bottom: スプレッドシート風の横タブ）
  const [tabsPosition, setTabsPosition] = useState<PageTabsPosition>(() => {
    if (typeof window === "undefined") return "left";
    const stored = localStorage.getItem(NODE_EDITOR_TABS_POSITION_KEY);
    return stored === "bottom" ? "bottom" : "left";
  });

  const toggleTabsPosition = useCallback(() => {
    setTabsPosition((prev) => {
      const next: PageTabsPosition = prev === "left" ? "bottom" : "left";
      try {
        localStorage.setItem(NODE_EDITOR_TABS_POSITION_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const downloadJson = useCallback((content: string, filename: string) => {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportAll = useCallback(() => {
    const state = useNodeEditorStore.getState();
    const content = serializeNodeEditor(composePages(state), state.activePageId, state.subMode);
    downloadJson(content, "diagram.nodeeditor");
  }, [downloadJson]);

  const handleExportPage = useCallback((pageId: string) => {
    const state = useNodeEditorStore.getState();
    const pages = composePages(state);
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;
    const content = serializeNodeEditorSinglePage(page, state.subMode);
    const safeName = page.name.replace(/[^a-zA-Z0-9_\-\u3000-\u9FFF\uF900-\uFAFF]/g, "_");
    downloadJson(content, `${safeName}.nodeeditor`);
  }, [downloadJson]);

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
          onExportAll={handleExportAll}
          onExportPage={handleExportPage}
          onImport={handleImport}
        />
        <div className={`flex flex-1 overflow-hidden bg-zinc-900 ${tabsPosition === "bottom" ? "flex-col" : ""}`}>
          {/* Left dock: vertical page tabs (theme-inverted band) */}
          {tabsPosition === "left" && (
            <NodeEditorPageTabs position="left" onTogglePosition={toggleTabsPosition} />
          )}

          {/* Canvas (rounded card seamlessly connected to the active tab) */}
          <div
            className={`relative flex-1 min-w-0 min-h-0 overflow-hidden bg-background ${
              tabsPosition === "left" ? "rounded-l-xl" : "rounded-b-xl"
            }`}
          >
            <NodeEditorCanvas />
            {/* Floating palette overlay (Stitch-style, no docked panel) */}
            <div className="absolute left-6 top-2 bottom-2 z-10 pointer-events-none">
              <NodeEditorPalette />
            </div>
            {/* Floating format bar (bottom-center) */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 max-w-[90%]">
              <NodeEditorFormatBar />
            </div>
          </div>

          {/* Bottom dock: horizontal page tabs (spreadsheet-style) */}
          {tabsPosition === "bottom" && (
            <NodeEditorPageTabs position="bottom" onTogglePosition={toggleTabsPosition} />
          )}
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
