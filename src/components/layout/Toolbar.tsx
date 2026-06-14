"use client";

import {
  Undo2,
  Redo2,
  Sun,
  Moon,
  Download,
  Upload,
  FileCode2,
  Trash2,
  Table2,
  GitCompareArrows,
  Grid3x3,
  SquareDashed,
  Ellipsis,
  SquarePen,
  ChevronDown,
  Check,
  MoveDown,
  MoveRight,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { useFlowStore } from "@/store/useFlowStore";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import { useLocale } from "@/lib/i18n/useLocale";

interface ToolbarProps {
  onExport?: () => void;
  onImport?: () => void;
  onImportMermaid?: () => void;
  onFitView?: () => void;
  isBulkEditMode?: boolean;
  onEnterBulkEdit?: () => void;
  onExitBulkEdit?: () => void;
  isDiffMode?: boolean;
  onEnterDiffMode?: () => void;
  onExitDiffMode?: () => void;
  /** Rendered in the toolbar's right area when in diff compare mode */
  diffFilterBar?: React.ReactNode;
  gridSnap?: boolean;
  onToggleGridSnap?: () => void;
  ghostEnabled?: boolean;
  onToggleGhost?: () => void;
  /** Called when user clicks title to switch to node editor mode */
  onSwitchToNodeEditor?: () => void;
  /** Title slot (ModeTitle component) */
  titleSlot?: React.ReactNode;
}

export function Toolbar({ onExport, onImport, onImportMermaid, onFitView, isBulkEditMode, onEnterBulkEdit, onExitBulkEdit, isDiffMode, onEnterDiffMode, onExitDiffMode, diffFilterBar, gridSnap, onToggleGridSnap, ghostEnabled, onToggleGhost, onSwitchToNodeEditor, titleSlot }: ToolbarProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const { undo, redo, canUndo, canRedo } = useUndoRedo();
  const direction = useFlowStore((s) => s.direction);
  const setDirection = useFlowStore((s) => s.setDirection);
  const clearAll = useFlowStore((s) => s.clearAll);
  const hasContent = useFlowStore((s) => s.nodes.length > 0 || s.edges.length > 0);
  const { locale, setLocale, t } = useLocale();

  return (
    <div className="toolbar-pills relative z-40 shrink-0 flex items-stretch gap-2 px-2 pt-2">
      {/* Title group */}
      <div className="glass-panel flex items-center px-3 py-1.5">
        {titleSlot ?? <span className="font-semibold text-sm">Flowmaid</span>}
      </div>

      {!isDiffMode && (
        <>
          {/* Edit + View group: undo / redo / direction / grid snap / ghost */}
          <div className="glass-panel flex items-center gap-1 px-2 py-1.5">
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

          {/* Direction: single toggle button (TD ⇄ LR) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 px-2 text-xs font-semibold"
                onClick={() => setDirection(direction === "TD" ? "LR" : "TD")}
              >
                {direction === "TD" ? <MoveDown size={14} /> : <MoveRight size={14} />}
                {direction === "TD" ? t("dirTD") : t("dirLR")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("toggleDirection")}</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={gridSnap ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={onToggleGridSnap}
              >
                <Grid3x3 size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("snapToGrid")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={ghostEnabled ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={onToggleGhost}
              >
                <SquareDashed size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("ghostNodes")}</TooltipContent>
          </Tooltip>
          </div>
        </>
      )}

      <div className="flex-1" />

      {/* Mode menu: normal edit / bulk edit / diff compare */}
      {!isBulkEditMode && !isDiffMode && (onEnterBulkEdit || onEnterDiffMode) && (
        <div className="glass-panel flex items-center px-2 py-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs px-3">
                <SquarePen size={14} />
                {t("editorModeMenu")}
                <ChevronDown size={12} className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuItem disabled>
                <Check size={14} />
                {t("normalEdit")}
              </DropdownMenuItem>
              {onEnterBulkEdit && (
                <DropdownMenuItem onClick={onEnterBulkEdit} disabled={!hasContent}>
                  <Table2 size={14} />
                  {t("bulkEdit")}
                </DropdownMenuItem>
              )}
              {onEnterDiffMode && (
                <DropdownMenuItem onClick={onEnterDiffMode}>
                  <GitCompareArrows size={14} />
                  {t("diffCompare")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {isDiffMode && diffFilterBar && (
        <div className="glass-panel flex items-center gap-1 px-3 py-1.5">
          {diffFilterBar}
        </div>
      )}

      <div className="flex-1" />

      {/* File + Settings group: export / import / theme / locale / ⋯メニュー */}
      <div className="glass-panel flex items-center gap-1 px-2 py-1.5">
      {onExport && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onExport}
            >
              <Upload size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("exportFile")}</TooltipContent>
        </Tooltip>
      )}

      {onImport && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onImport}
            >
              <Download size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("importFile")}</TooltipContent>
        </Tooltip>
      )}

      {(onExport || onImport) && <Separator orientation="vertical" className="h-6" />}

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

      {/* ⋯ overflow menu: 使用頻度の低い操作を集約 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Ellipsis size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onImportMermaid && (
            <DropdownMenuItem onClick={onImportMermaid}>
              <FileCode2 size={14} />
              {t("importMermaid")}
            </DropdownMenuItem>
          )}
          {!isDiffMode && (
            <DropdownMenuItem
              variant="destructive"
              disabled={!hasContent}
              onClick={() => {
                if (window.confirm(t("clearAllConfirm"))) clearAll();
              }}
            >
              <Trash2 size={14} />
              {t("clearAll")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </div>
  );
}
