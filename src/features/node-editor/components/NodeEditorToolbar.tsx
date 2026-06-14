"use client";

import {
  Undo2,
  Redo2,
  Sun,
  Moon,
  Trash2,
  BookType,
  Upload,
  Download,
  FileText,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNodeEditorStore, composePages } from "../store/useNodeEditorStore";
import { useNodeEditorUndoRedo } from "../hooks/useNodeEditorUndoRedo";
import { useLocale } from "@/lib/i18n/useLocale";
import type { NodeEditorSubMode } from "../types";

interface NodeEditorToolbarProps {
  onSwitchMode: () => void;
  titleSlot?: React.ReactNode;
  onExportAll?: () => void;
  onExportPage?: (pageId: string) => void;
  onImport?: () => void;
}

const SUB_MODE_LABELS: Record<NodeEditorSubMode, { en: string; ja: string }> = {
  generic: { en: "Generic", ja: "汎用" },
  "api-diagram": { en: "API", ja: "API" },
  "er-diagram": { en: "ER", ja: "ER" },
};

export function NodeEditorToolbar({ onSwitchMode, titleSlot, onExportAll, onExportPage, onImport }: NodeEditorToolbarProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const { undo, redo, canUndo, canRedo } = useNodeEditorUndoRedo();
  const subMode = useNodeEditorStore((s) => s.subMode);
  const setSubMode = useNodeEditorStore((s) => s.setSubMode);
  const clearAll = useNodeEditorStore((s) => s.clearAll);
  const hasContent = useNodeEditorStore((s) => s.nodes.length > 0);
  const showLogicalName = useNodeEditorStore((s) => s.showLogicalName);
  const toggleShowLogicalName = useNodeEditorStore((s) => s.toggleShowLogicalName);
  const { locale, setLocale, t } = useLocale();

  return (
    <div className="toolbar-pills relative z-40 shrink-0 flex items-stretch gap-2 px-2 pt-2">
      {/* Title group */}
      <div className="glass-panel flex items-center px-3 py-1.5">
        {titleSlot ?? <span className="font-semibold text-sm">Nodemaid</span>}
      </div>

      {/* Edit group: undo / redo / sub-mode / logical name */}
      <div className="glass-panel flex items-center gap-1 px-2 py-1.5">
      {/* Undo / Redo */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={undo}
            disabled={!canUndo}
          >
            <Undo2 size={16} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("undo")}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={redo}
            disabled={!canRedo}
          >
            <Redo2 size={16} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("redo")}</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="h-6" />

      {/* Sub-mode toggle */}
      <ToggleGroup
        type="single"
        value={subMode}
        onValueChange={(val) => {
          if (val) setSubMode(val as NodeEditorSubMode);
        }}
        className="h-8"
      >
        {(Object.keys(SUB_MODE_LABELS) as NodeEditorSubMode[]).map((mode) => (
          <ToggleGroupItem key={mode} value={mode} className="h-8 px-2 text-xs">
            {locale === "ja" ? SUB_MODE_LABELS[mode].ja : SUB_MODE_LABELS[mode].en}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Separator orientation="vertical" className="h-6" />

      {/* Logical/Physical name toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={showLogicalName ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={toggleShowLogicalName}
          >
            <BookType size={16} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("neLogicalName")}</TooltipContent>
      </Tooltip>
      </div>

      <div className="flex-1" />

      {/* File + Settings group: export / import / clear / theme / locale */}
      <div className="glass-panel flex items-center gap-1 px-2 py-1.5">
      {/* Export */}
      {onExportAll && <ExportButton onExportAll={onExportAll} onExportPage={onExportPage} />}

      {/* Import */}
      {onImport && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onImport}>
              <Download size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("neImport")}</TooltipContent>
        </Tooltip>
      )}

      {(onExportAll || onImport) && <Separator orientation="vertical" className="h-6" />}

      {/* Clear all */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={!hasContent}
            onClick={() => {
              if (window.confirm(t("clearAllConfirm"))) clearAll();
            }}
          >
            <Trash2 size={16} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("clearAll")}</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="h-6" />

      {/* Theme toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            {resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("toggleTheme")}</TooltipContent>
      </Tooltip>

      {/* Language toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 px-2 text-xs font-semibold"
            onClick={() => setLocale(locale === "ja" ? "en" : "ja")}
          >
            {locale === "ja" ? "JP" : "EN"}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{locale === "ja" ? "English" : "日本語"}</TooltipContent>
      </Tooltip>
      </div>
    </div>
  );
}

/* ── Export button: direct export for single page, dropdown for multiple ── */

function ExportButton({
  onExportAll,
  onExportPage,
}: {
  onExportAll: () => void;
  onExportPage?: (pageId: string) => void;
}) {
  const pages = useNodeEditorStore((s) => s.pages);
  const { t } = useLocale();

  // Single page → direct export (no dropdown)
  if (pages.length <= 1) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onExportAll}>
            <Upload size={16} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("neExport")}</TooltipContent>
      </Tooltip>
    );
  }

  // Multiple pages → dropdown with "All pages" + individual pages
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Upload size={16} />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("neExport")}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onExportAll}>
          <Upload size={14} className="mr-2 shrink-0" />
          {t("neExportAll")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {composePages(useNodeEditorStore.getState()).map((page) => (
          <DropdownMenuItem key={page.id} onClick={() => onExportPage?.(page.id)}>
            <FileText size={14} className="mr-2 shrink-0" />
            {page.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
