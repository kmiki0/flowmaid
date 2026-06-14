"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { perfCount } from "@/lib/perf";
import { ReactFlowProvider } from "@xyflow/react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { FileCode2 } from "lucide-react";
import { DnDProvider } from "@/components/canvas/DnDContext";
import { FlowCanvas } from "@/components/canvas/FlowCanvas";
import { Toolbar } from "./Toolbar";
import { FormatBar } from "./FormatBar";
import { NodePalette } from "./NodePalette";
import { MermaidPreview } from "./MermaidPreview";
import { MermaidImportDialog } from "./MermaidImportDialog";
import { ExportDialog } from "./ExportDialog";
import { GlobalSearchPanel } from "@/components/search/GlobalSearchPanel";
import { BetaNoticeDialog } from "./BetaNoticeDialog";
import { ComponentEditingHeader } from "@/components/flowComponent/ComponentEditingHeader";
import { usePanelState } from "@/hooks/usePanelState";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useFlowStore } from "@/store/useFlowStore";
import { deserialize } from "@/lib/flowmaid/deserialize";
import { useLocale, useLocaleStore } from "@/lib/i18n/useLocale";
import { locales } from "@/lib/i18n/locales";
import { toast } from "sonner";
import { BulkEditCanvas } from "@/components/bulkEdit/BulkEditCanvas";
import { BulkEditTable } from "@/components/bulkEdit/BulkEditTable";
import { DiffImportPanel, DiffCanvas, DiffTextPanel, DiffTextPanelHeader, DiffFilterBar } from "@/components/diffComparison";
import type { FileMeta } from "@/components/diffComparison/DiffImportPanel";
import { computeDiff } from "@/lib/diff/computeDiff";
import { DEFAULT_DIFF_FILTERS } from "@/lib/diff/types";
import type { DiffFilters, DiffResult } from "@/lib/diff/types";
import type { FlowmaidLayout } from "@/lib/flowmaid/schema";
import { GRID_SNAP_STORAGE_KEY, GHOST_ENABLED_STORAGE_KEY, FLOW_TABS_POSITION_KEY } from "@/lib/constants";
import { FlowPageTabs } from "./FlowPageTabs";
import type { PageTabsPosition } from "@/shared/components/PageTabsDock";
import { NodeEditorLayout } from "@/features/node-editor/components/NodeEditorLayout";
import { ModeTitle } from "@/shared/components/ModeTitle";
import { EDITOR_MODE_STORAGE_KEY } from "@/features/node-editor/lib/constants";
import type { EditorMode } from "@/features/node-editor/types";

const BULK_EDIT_CANVAS_DEFAULT_SIZE = 60;
const BULK_EDIT_CANVAS_MIN_SIZE = 30;
const BULK_EDIT_TABLE_DEFAULT_SIZE = 40;
const BULK_EDIT_TABLE_MIN_SIZE = 25;

const DIFF_CANVAS_DEFAULT_SIZE = 65;
const DIFF_CANVAS_MIN_SIZE = 30;
const DIFF_TEXT_DEFAULT_SIZE = 35;
const DIFF_TEXT_MIN_SIZE = 15;

export function EditorLayout() {
  perfCount("EditorLayout");

  // Top-level editor mode (flowchart vs node-editor)
  const [editorMode, setEditorMode] = useState<EditorMode>(() => {
    if (typeof window === "undefined") return "flowchart";
    return (localStorage.getItem(EDITOR_MODE_STORAGE_KEY) as EditorMode) ?? "flowchart";
  });

  const handleModeChange = useCallback((mode: EditorMode) => {
    setEditorMode(mode);
    localStorage.setItem(EDITOR_MODE_STORAGE_KEY, mode);
  }, []);

  const { rightOpen, toggleRight } = usePanelState();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mermaidImportOpen, setMermaidImportOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [isBulkEditMode, setIsBulkEditMode] = useState(false);
  const [bulkEditFocusTarget, setBulkEditFocusTarget] = useState<{
    type: "node" | "edge";
    id: string;
  } | null>(null);
  const [bulkEditHighlightId, setBulkEditHighlightId] = useState<string | null>(null);
  const [bulkEditSelectedIds, setBulkEditSelectedIds] = useState<string[]>([]);

  // Diff compare mode state
  const [isDiffMode, setIsDiffMode] = useState(false);
  const [diffStep, setDiffStep] = useState<"import" | "compare">("import");
  const [diffBaseLayout, setDiffBaseLayout] = useState<FlowmaidLayout | null>(null);
  const [diffBaseFileName, setDiffBaseFileName] = useState<string | null>(null);
  const [diffBaseMeta, setDiffBaseMeta] = useState<FileMeta | null>(null);
  const [diffCompareLayout, setDiffCompareLayout] = useState<FlowmaidLayout | null>(null);
  const [diffCompareFileName, setDiffCompareFileName] = useState<string | null>(null);
  const [diffCompareMeta, setDiffCompareMeta] = useState<FileMeta | null>(null);
  const [diffFilters, setDiffFilters] = useState<DiffFilters>(DEFAULT_DIFF_FILTERS);
  const [diffFlowOpacity, setDiffFlowOpacity] = useState(1);
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [diffViewMode, setDiffViewMode] = useState<"unified" | "sideBySide">("sideBySide");
  const [diffFlashTarget, setDiffFlashTarget] = useState<{ id: string; type: "node" | "edge"; seq: number } | null>(null);
  const [diffTextCollapsed, setDiffTextCollapsed] = useState(false);
  const diffFlashSeqRef = useRef(0);
  const diffTextPanelRef = useRef<PanelImperativeHandle>(null);

  // Global search
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const { t } = useLocale();
  const isEditingComponent = useFlowStore((s) => !!s.editingComponentId);

  // Grid snap state (persisted in localStorage, not in undo/redo)
  const [gridSnap, setGridSnap] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(GRID_SNAP_STORAGE_KEY) === "true";
  });
  const handleToggleGridSnap = useCallback(() => {
    setGridSnap((prev) => {
      const next = !prev;
      localStorage.setItem(GRID_SNAP_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  // Ghost nodes toggle (persisted in localStorage, default ON)
  const [ghostEnabled, setGhostEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem(GHOST_ENABLED_STORAGE_KEY);
    return v === null ? true : v === "true";
  });
  const handleToggleGhost = useCallback(() => {
    setGhostEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(GHOST_ENABLED_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  // ページタブの表示位置（left: 縦タブ / bottom: スプレッドシート風の横タブ）
  const [tabsPosition, setTabsPosition] = useState<PageTabsPosition>(() => {
    if (typeof window === "undefined") return "left";
    const stored = localStorage.getItem(FLOW_TABS_POSITION_KEY);
    return stored === "bottom" ? "bottom" : "left";
  });
  const toggleTabsPosition = useCallback(() => {
    setTabsPosition((prev) => {
      const next: PageTabsPosition = prev === "left" ? "bottom" : "left";
      localStorage.setItem(FLOW_TABS_POSITION_KEY, next);
      return next;
    });
  }, []);

  useAutoSave();
  useKeyboardShortcuts();

  // Listen for export/import events
  useEffect(() => {
    const handleExportEvent = () => {
      setExportDialogOpen(true);
    };

    const handleImportEvent = (e: Event) => {
      try {
        const content = (e as CustomEvent).detail as string;
        const result = deserialize(content);
        useFlowStore.getState().loadState(result);
        toast.success(locales[useLocaleStore.getState().locale]["importedSuccess"]);
      } catch (err) {
        toast.error(locales[useLocaleStore.getState().locale]["importFailed"]);
        console.error(err);
      }
    };

    window.addEventListener("flowmaid:export", handleExportEvent);
    window.addEventListener("flowmaid:import", handleImportEvent);
    return () => {
      window.removeEventListener("flowmaid:export", handleExportEvent);
      window.removeEventListener("flowmaid:import", handleImportEvent);
    };
  }, []);

  // Listen for global search open event
  useEffect(() => {
    const handler = () => {
      if (!isBulkEditMode && !isDiffMode && !isEditingComponent) {
        setIsSearchOpen(true);
      }
    };
    window.addEventListener("flowmaid:globalSearch:open", handler);
    return () => window.removeEventListener("flowmaid:globalSearch:open", handler);
  }, [isBulkEditMode, isDiffMode, isEditingComponent]);

  const handleCloseSearch = useCallback(() => setIsSearchOpen(false), []);

  const handleJumpTo = useCallback((type: "node" | "edge", id: string) => {
    window.dispatchEvent(new CustomEvent("flowmaid:jumpTo", { detail: { type, id } }));
  }, []);

  const handleExport = useCallback(() => {
    setExportDialogOpen(true);
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
        const content = ev.target?.result as string;
        window.dispatchEvent(
          new CustomEvent("flowmaid:import", { detail: content })
        );
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    []
  );

  const handleImportMermaid = useCallback(() => {
    setMermaidImportOpen(true);
  }, []);

  const handleFitView = useCallback(() => {
    window.dispatchEvent(new CustomEvent("flowmaid:fitview"));
  }, []);

  const handleEnterBulkEdit = useCallback(() => {
    setBulkEditFocusTarget(null);
    setBulkEditHighlightId(null);
    setBulkEditSelectedIds([]);
    setIsBulkEditMode(true);
  }, []);

  const handleExitBulkEdit = useCallback(() => {
    setIsBulkEditMode(false);
    setBulkEditFocusTarget(null);
    setBulkEditHighlightId(null);
    setBulkEditSelectedIds([]);
  }, []);

  // Table row click → highlight + zoom
  const handleBulkEditFocusNode = useCallback((nodeId: string) => {
    setBulkEditSelectedIds([]);
    setBulkEditFocusTarget({ type: "node", id: nodeId });
    setBulkEditHighlightId(nodeId);
  }, []);

  const handleBulkEditFocusEdge = useCallback((edgeId: string) => {
    setBulkEditSelectedIds([]);
    setBulkEditFocusTarget({ type: "edge", id: edgeId });
    setBulkEditHighlightId(edgeId);
  }, []);

  // Canvas click → highlight only (no zoom)
  const handleBulkEditCanvasNodeClick = useCallback((nodeId: string) => {
    setBulkEditSelectedIds([]);
    setBulkEditFocusTarget(null);
    setBulkEditHighlightId(nodeId);
  }, []);

  const handleBulkEditCanvasEdgeClick = useCallback((edgeId: string) => {
    setBulkEditSelectedIds([]);
    setBulkEditFocusTarget(null);
    setBulkEditHighlightId(edgeId);
  }, []);

  const handleBulkEditSelectionChange = useCallback((selectedIds: string[]) => {
    setBulkEditSelectedIds(selectedIds);
    if (selectedIds.length > 0) {
      setBulkEditHighlightId(null);
      setBulkEditFocusTarget(null);
    }
  }, []);

  const handleBulkEditPaneClick = useCallback(() => {
    setBulkEditSelectedIds([]);
    setBulkEditHighlightId(null);
    setBulkEditFocusTarget(null);
  }, []);

  const diffStepRef = useRef(diffStep);
  diffStepRef.current = diffStep;

  // --- Diff compare mode handlers ---
  const handleEnterDiffMode = useCallback(() => {
    setIsDiffMode(true);
    setDiffStep("import");
    setDiffBaseLayout(null);
    setDiffBaseFileName(null);
    setDiffBaseMeta(null);
    setDiffCompareLayout(null);
    setDiffCompareFileName(null);
    setDiffCompareMeta(null);
    setDiffResult(null);
    setDiffFilters(DEFAULT_DIFF_FILTERS);
  }, []);

  const handleExitDiffMode = useCallback(() => {
    if (diffStepRef.current === "compare") {
      setDiffStep("import");
      setDiffResult(null);
    } else {
      setIsDiffMode(false);
    }
  }, []);

  const handleDiffBaseSelect = useCallback((layout: FlowmaidLayout, fileName: string, meta: FileMeta) => {
    setDiffBaseLayout(layout);
    setDiffBaseFileName(fileName);
    setDiffBaseMeta(meta);
  }, []);

  const handleDiffCompareSelect = useCallback((layout: FlowmaidLayout, fileName: string, meta: FileMeta) => {
    setDiffCompareLayout(layout);
    setDiffCompareFileName(fileName);
    setDiffCompareMeta(meta);
  }, []);

  const handleDiffBaseClear = useCallback(() => {
    setDiffBaseLayout(null);
    setDiffBaseFileName(null);
    setDiffBaseMeta(null);
  }, []);

  const handleDiffCompareClear = useCallback(() => {
    setDiffCompareLayout(null);
    setDiffCompareFileName(null);
    setDiffCompareMeta(null);
  }, []);

  const handleRunDiff = useCallback(() => {
    if (diffBaseLayout && diffCompareLayout) {
      const result = computeDiff(diffBaseLayout, diffCompareLayout);
      setDiffResult(result);
      setDiffStep("compare");
    }
  }, [diffBaseLayout, diffCompareLayout]);

  const handleDiffTextToggle = useCallback(() => {
    const panel = diffTextPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
      setDiffTextCollapsed(false);
    } else {
      panel.collapse();
      setDiffTextCollapsed(true);
    }
  }, []);

  const handleDiffItemClick = useCallback((targetId: string, targetType: "node" | "edge") => {
    diffFlashSeqRef.current += 1;
    setDiffFlashTarget({ id: targetId, type: targetType, seq: diffFlashSeqRef.current });
  }, []);

  const isNodeEditorMode = editorMode === "node-editor";

  // Placeholder spacer matching ModeTitle width, used inside toolbars
  const modeTitleSpacer = <div className="w-[130px] shrink-0" />;

  return (
    <div className="aurora-bg relative h-screen w-screen overflow-hidden flex flex-col">
      {/* ModeTitle rendered at top level so it persists across mode switches (enables slide animation) */}
      <div className="absolute left-[20px] z-50 flex items-center" style={{ top: 8, height: 46 }}>
        <ModeTitle mode={editorMode} onModeChange={handleModeChange} />
      </div>

      {isNodeEditorMode ? (
        <NodeEditorLayout onSwitchMode={() => handleModeChange("flowchart")} titleSlot={modeTitleSpacer} />
      ) : (
    <ReactFlowProvider>
      <DnDProvider>
        <div
          className="h-full w-full flex flex-col transition-[padding,background-color] duration-500 ease-in-out"
          style={{
            padding: isEditingComponent ? '0.4% 1% 1% 1%' : '0',
            backgroundColor: isEditingComponent ? 'var(--foreground)' : 'transparent',
          }}
        >
          <div
            className="overflow-hidden transition-[max-height,opacity] duration-500 ease-in-out"
            style={{
              maxHeight: isEditingComponent ? '48px' : '0px',
              opacity: isEditingComponent ? 1 : 0,
            }}
          >
            <ComponentEditingHeader />
          </div>
          <div className={`flex-1 min-h-0 w-full flex flex-col transition-[border-radius] duration-500 ease-in-out overflow-hidden ${isEditingComponent ? 'rounded-lg bg-background' : ''}`}>
          <Toolbar
            onExport={isBulkEditMode || isDiffMode ? undefined : handleExport}
            onImport={isBulkEditMode || isDiffMode ? undefined : handleImport}
            onImportMermaid={isBulkEditMode || isDiffMode ? undefined : handleImportMermaid}
            onFitView={isBulkEditMode || isDiffMode ? undefined : handleFitView}
            isBulkEditMode={isBulkEditMode}
            onEnterBulkEdit={isEditingComponent || isDiffMode ? undefined : handleEnterBulkEdit}
            onExitBulkEdit={handleExitBulkEdit}
            isDiffMode={isDiffMode}
            onEnterDiffMode={isEditingComponent || isBulkEditMode ? undefined : handleEnterDiffMode}
            onExitDiffMode={isDiffMode ? handleExitDiffMode : undefined}
            diffFilterBar={isDiffMode && diffStep === "compare" ? (
              <DiffFilterBar filters={diffFilters} onFiltersChange={setDiffFilters} flowOpacity={diffFlowOpacity} onFlowOpacityChange={setDiffFlowOpacity} />
            ) : undefined}
            gridSnap={gridSnap}
            onToggleGridSnap={handleToggleGridSnap}
            ghostEnabled={ghostEnabled}
            onToggleGhost={handleToggleGhost}
            onSwitchToNodeEditor={isBulkEditMode || isDiffMode || isEditingComponent ? undefined : () => handleModeChange("node-editor")}
            titleSlot={modeTitleSpacer}
          />
          {isDiffMode ? (
            <div className="flex flex-1 overflow-hidden">
              {diffStep === "import" ? (
                <DiffImportPanel
                  baseLayout={diffBaseLayout}
                  baseFileName={diffBaseFileName}
                  baseMeta={diffBaseMeta}
                  compareLayout={diffCompareLayout}
                  compareFileName={diffCompareFileName}
                  compareMeta={diffCompareMeta}
                  onBaseSelect={handleDiffBaseSelect}
                  onCompareSelect={handleDiffCompareSelect}
                  onBaseClear={handleDiffBaseClear}
                  onCompareClear={handleDiffCompareClear}
                  onRunCompare={handleRunDiff}
                  onExit={handleExitDiffMode}
                />
              ) : diffResult && diffBaseLayout && diffCompareLayout ? (
                <div className="flex flex-col flex-1">
                  <ResizablePanelGroup orientation="vertical" className="flex-1">
                    <ResizablePanel defaultSize={DIFF_CANVAS_DEFAULT_SIZE} minSize={DIFF_CANVAS_MIN_SIZE}>
                      <DiffCanvas
                        baseLayout={diffBaseLayout}
                        compareLayout={diffCompareLayout}
                        diffResult={diffResult}
                        filters={diffFilters}
                        onExit={handleExitDiffMode}
                        baseFileName={diffBaseFileName!}
                        compareFileName={diffCompareFileName!}
                        flashTarget={diffFlashTarget}
                        flowOpacity={diffFlowOpacity}
                      />
                    </ResizablePanel>
                    <ResizableHandle bare className="h-px bg-border" />
                    {/* Header always visible above the collapsible panel */}
                    <DiffTextPanelHeader
                      viewMode={diffViewMode}
                      onViewModeChange={setDiffViewMode}
                      onExpand={handleDiffTextToggle}
                      isCollapsed={diffTextCollapsed}
                    />
                    <ResizablePanel panelRef={diffTextPanelRef} defaultSize={DIFF_TEXT_DEFAULT_SIZE} minSize={DIFF_TEXT_MIN_SIZE} collapsible>
                      <DiffTextPanel
                        diffResult={diffResult}
                        filters={diffFilters}
                        baseLayout={diffBaseLayout!}
                        compareLayout={diffCompareLayout!}
                        viewMode={diffViewMode}
                        onItemClick={handleDiffItemClick}
                      />
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </div>
              ) : null}
            </div>
          ) : isBulkEditMode ? (
            <div className="flex flex-1 overflow-hidden">
              <ResizablePanelGroup orientation="horizontal" className="flex-1">
                <ResizablePanel defaultSize={BULK_EDIT_CANVAS_DEFAULT_SIZE} minSize={BULK_EDIT_CANVAS_MIN_SIZE}>
                  <BulkEditCanvas
                    focusTarget={bulkEditFocusTarget}
                    highlightId={bulkEditHighlightId}
                    onNodeClick={handleBulkEditCanvasNodeClick}
                    onEdgeClick={handleBulkEditCanvasEdgeClick}
                    onSelectionChange={handleBulkEditSelectionChange}
                    onPaneClick={handleBulkEditPaneClick}
                    onExit={handleExitBulkEdit}
                  />
                </ResizablePanel>
                <ResizableHandle bare className="w-px bg-border" />
                <ResizablePanel defaultSize={BULK_EDIT_TABLE_DEFAULT_SIZE} minSize={BULK_EDIT_TABLE_MIN_SIZE}>
                  <BulkEditTable
                    onFocusNode={handleBulkEditFocusNode}
                    onFocusEdge={handleBulkEditFocusEdge}
                    highlightId={bulkEditHighlightId}
                    selectedIds={bulkEditSelectedIds}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          ) : (
          <div
            className={`flex flex-1 overflow-hidden ${!isEditingComponent ? "bg-zinc-900" : ""} ${
              tabsPosition === "bottom" ? "flex-col" : ""
            }`}
          >
            {/* Left dock: vertical page tabs (theme-inverted band, hidden during component editing) */}
            {!isEditingComponent && tabsPosition === "left" && (
              <FlowPageTabs position="left" onTogglePosition={toggleTabsPosition} />
            )}
            <div
              className={`relative flex-1 min-w-0 min-h-0 ${
                !isEditingComponent
                  ? `overflow-hidden bg-background ${tabsPosition === "left" ? "rounded-l-xl" : "rounded-b-xl"}`
                  : "h-full"
              }`}
              onClick={(e) => {
                // コードプレビュー表示中にキャンバス（空き領域）クリックで閉じる
                if (rightOpen && (e.target as HTMLElement).closest(".react-flow__pane")) {
                  toggleRight();
                }
              }}
            >
              <FlowCanvas gridSnap={gridSnap} ghostEnabled={ghostEnabled} />
              {/* Floating node palette overlay (Stitch-style, no docked panel) */}
              <div className="absolute left-6 top-2 bottom-2 z-10 pointer-events-none">
                <NodePalette />
              </div>
              {/* Floating Mermaid preview (right): closed = small code icon, open = full-height panel.
                  左パレットと同じく単一ボックスの width/height トランジションで伸縮（200ms ease-out） */}
              <div
                className="absolute right-6 top-2 z-10 glass-panel overflow-hidden transition-[width,height] duration-200 ease-out"
                style={{
                  width: rightOpen ? "min(480px, 45vw)" : 40,
                  height: rightOpen ? "calc(100% - 16px)" : 40,
                }}
              >
                {/* Closed: code icon button (box top-right corner) */}
                <button
                  onClick={toggleRight}
                  title="Output"
                  className={`absolute right-0 top-0 z-10 flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-opacity duration-200 ${
                    rightOpen ? "pointer-events-none opacity-0" : "opacity-100"
                  }`}
                >
                  <FileCode2 size={16} />
                </button>
                {/* Open: preview content (fixed inner width so text doesn't reflow during transition) */}
                <div
                  className={`h-full w-[min(480px,45vw)] transition-opacity duration-200 ${
                    rightOpen ? "opacity-100" : "pointer-events-none opacity-0"
                  }`}
                >
                  <MermaidPreview onClose={toggleRight} />
                </div>
              </div>
              {/* Floating format bar (bottom-center, above zoom controls) */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 max-w-[90%]">
                <FormatBar />
              </div>
              {/* Floating global search panel (top-center) */}
              {isSearchOpen && !isEditingComponent && (
                <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30">
                  <GlobalSearchPanel onClose={handleCloseSearch} onJump={handleJumpTo} />
                </div>
              )}
            </div>

            {/* Bottom dock: horizontal page tabs (spreadsheet-style) */}
            {!isEditingComponent && tabsPosition === "bottom" && (
              <FlowPageTabs position="bottom" onTogglePosition={toggleTabsPosition} />
            )}
          </div>
          )}
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".flowmaid"
          className="hidden"
          onChange={handleFileChange}
        />
        <MermaidImportDialog
          open={mermaidImportOpen}
          onOpenChange={setMermaidImportOpen}
          onSuccess={handleFitView}
        />
        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
        />
        <BetaNoticeDialog />
      </DnDProvider>
    </ReactFlowProvider>
      )}
    </div>
  );
}
