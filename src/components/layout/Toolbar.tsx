"use client";

import {
  Undo2,
  Redo2,
  Sun,
  Moon,
  Download,
  Upload,
  Maximize,
  Plus,
  Languages,
  FileCode2,
  Trash2,
  Table2,
  ArrowLeft,
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useFlowStore } from "@/store/useFlowStore";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import { useLocale } from "@/lib/i18n/useLocale";
import type { FlowDirection } from "@/types/flow";
import type { TranslationKey } from "@/lib/i18n/locales";

const SHAPE_KEYS: { type: string; key: TranslationKey }[] = [
  { type: "rectangle", key: "rectangle" },
  { type: "roundedRect", key: "roundedRect" },
  { type: "diamond", key: "diamond" },
  { type: "circle", key: "circle" },
  { type: "stadium", key: "stadium" },
  { type: "parallelogram", key: "parallelogram" },
  { type: "cylinder", key: "cylinder" },
  { type: "hexagon", key: "hexagon" },
  { type: "trapezoid", key: "trapezoid" },
];

interface ToolbarProps {
  onExport?: () => void;
  onImport?: () => void;
  onImportMermaid?: () => void;
  onFitView?: () => void;
  isBulkEditMode?: boolean;
  onEnterBulkEdit?: () => void;
  onExitBulkEdit?: () => void;
}

export function Toolbar({ onExport, onImport, onImportMermaid, onFitView, isBulkEditMode, onEnterBulkEdit, onExitBulkEdit }: ToolbarProps) {
  const { theme, setTheme } = useTheme();
  const { undo, redo, canUndo, canRedo } = useUndoRedo();
  const direction = useFlowStore((s) => s.direction);
  const setDirection = useFlowStore((s) => s.setDirection);
  const addNode = useFlowStore((s) => s.addNode);
  const clearAll = useFlowStore((s) => s.clearAll);
  const hasContent = useFlowStore((s) => s.nodes.length > 0 || s.edges.length > 0);
  const { locale, setLocale, t } = useLocale();

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-background">
      <span className="font-semibold text-sm mr-2">Flowmaid</span>

      <Separator orientation="vertical" className="h-6" />

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Plus size={16} />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{t("addNode")}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent>
          {SHAPE_KEYS.map(({ type, key }) => (
            <DropdownMenuItem key={type} onClick={() => addNode(type)}>
              {t(key)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="h-6" />

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

      <ToggleGroup
        type="single"
        value={direction}
        onValueChange={(val) => {
          if (val) setDirection(val as FlowDirection);
        }}
        className="h-8"
      >
        <ToggleGroupItem value="TD" className="h-8 px-2 text-xs">
          {t("dirTD")}
        </ToggleGroupItem>
        <ToggleGroupItem value="LR" className="h-8 px-2 text-xs">
          {t("dirLR")}
        </ToggleGroupItem>
      </ToggleGroup>

      {isBulkEditMode && onExitBulkEdit && (
        <>
          <Separator orientation="vertical" className="h-6" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={onExitBulkEdit}
              >
                <ArrowLeft size={14} />
                {t("exitBulkEdit")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("exitBulkEdit")}</TooltipContent>
          </Tooltip>
        </>
      )}

      <div className="flex-1" />

      {onEnterBulkEdit && !isBulkEditMode && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onEnterBulkEdit}
              disabled={!hasContent}
            >
              <Table2 size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("bulkEdit")}</TooltipContent>
        </Tooltip>
      )}

      {onFitView && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onFitView}
            >
              <Maximize size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("fitView")}</TooltipContent>
        </Tooltip>
      )}

      {onExport && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onExport}
            >
              <Download size={16} />
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
              <Upload size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("importFile")}</TooltipContent>
        </Tooltip>
      )}

      {onImportMermaid && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onImportMermaid}
            >
              <FileCode2 size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("importMermaid")}</TooltipContent>
        </Tooltip>
      )}

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

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
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
    </div>
  );
}
