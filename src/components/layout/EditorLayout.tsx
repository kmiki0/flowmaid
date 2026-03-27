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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DnDProvider } from "@/components/canvas/DnDContext";
import { FlowCanvas } from "@/components/canvas/FlowCanvas";
import { Toolbar } from "./Toolbar";
import { FormatBar } from "./FormatBar";
import { NodePalette } from "./NodePalette";
import { MermaidPreview } from "./MermaidPreview";
import { MermaidImportDialog } from "./MermaidImportDialog";
import { ExportDialog } from "./ExportDialog";
import { BetaNoticeDialog } from "./BetaNoticeDialog";
import { CollapsiblePanel } from "./CollapsiblePanel";
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

const BULK_EDIT_CANVAS_DEFAULT_SIZE = 60;
const BULK_EDIT_CANVAS_MIN_SIZE = 30;
const BULK_EDIT_TABLE_DEFAULT_SIZE = 40;
const BULK_EDIT_TABLE_MIN_SIZE = 25;

const DIFF_CANVAS_DEFAULT_SIZE = 65;
const DIFF_CANVAS_MIN_SIZE = 30;
const DIFF_TEXT_DEFAULT_SIZE = 35;
const DIFF_TEXT_MIN_SIZE = 15;

/** Resizable handle with click-to-toggle. Drag = resize, click = collapse panel.
 *  Design matches PanelRibbon (w-6, bg-muted/50, border-x, chevron + vertical label). */
function ToggleResizeHandle({ onClick }: { onClick: () => void }) {
  const draggedRef = useRef(false);
  return (
    <div
      className="relative shrink-0 flex flex-col items-center justify-center gap-1 bg-muted/50 hover:bg-muted border-x border-border cursor-pointer transition-colors"
      style={{ width: 24 }}
      onPointerDown={() => { draggedRef.current = false; }}
      onPointerMove={() => { draggedRef.current = true; }}
      onPointerUp={() => {
        if (!draggedRef.current) onClick();
      }}
    >
      <ResizableHandle bare className="absolute inset-0 z-10 cursor-pointer" />
      <ChevronRight size={14} className="text-muted-foreground" />
      <span
        className="text-[10px] text-muted-foreground"
        style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
      >
        Output
      </span>
    </div>
  );
}

/** Thin ribbon shown when panel is collapsed. Click to expand. Matches PanelRibbon design. */
function ToggleRibbon({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 flex flex-col items-center justify-center w-6 h-full bg-muted/50 hover:bg-muted border-x border-border cursor-pointer transition-colors"
    >
      <ChevronLeft size={14} className="text-muted-foreground" />
      <span
        className="text-[10px] text-muted-foreground"
        style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
      >
        Output
      </span>
    </button>
  );
}

export function EditorLayout() {
  perfCount("EditorLayout");
  const { leftOpen, rightOpen, leftWidth, toggleLeft, toggleRight } =
    usePanelState();
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

  const { t } = useLocale();
  const isEditingComponent = useFlowStore((s) => !!s.editingComponentId);

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

  return (
    <ReactFlowProvider>
      <DnDProvider>
        <div
          className="h-screen w-screen overflow-hidden flex flex-col transition-[padding,background-color] duration-500 ease-in-out"
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
          />
          {!isBulkEditMode && !isDiffMode && <FormatBar />}
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
          <div className="flex flex-1 overflow-hidden">
            <CollapsiblePanel
              side="left"
              isOpen={leftOpen}
              onToggle={toggleLeft}
              width={leftWidth}
              ribbonLabel="Nodes"
            >
              <NodePalette />
            </CollapsiblePanel>

            <ResizablePanelGroup orientation="horizontal" className="flex-1">
              <ResizablePanel defaultSize={rightOpen ? 70 : 100} minSize={30}>
                <FlowCanvas />
              </ResizablePanel>

              {rightOpen && (
                <>
                  <ToggleResizeHandle onClick={toggleRight} />
                  <ResizablePanel defaultSize={30} minSize={15}>
                    <MermaidPreview />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>

            {!rightOpen && (
              <ToggleRibbon onClick={toggleRight} />
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
  );
}
