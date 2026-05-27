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
import { useNodeEditorStore } from "../store/useNodeEditorStore";
import { useNodeEditorUndoRedo } from "../hooks/useNodeEditorUndoRedo";
import { useLocale } from "@/lib/i18n/useLocale";
import type { NodeEditorSubMode } from "../types";

interface NodeEditorToolbarProps {
  onSwitchMode: () => void;
  titleSlot?: React.ReactNode;
  onExport?: () => void;
  onImport?: () => void;
}

const SUB_MODE_LABELS: Record<NodeEditorSubMode, { en: string; ja: string }> = {
  generic: { en: "Generic", ja: "汎用" },
  "api-diagram": { en: "API", ja: "API" },
  "er-diagram": { en: "ER", ja: "ER" },
};

export function NodeEditorToolbar({ onSwitchMode, titleSlot, onExport, onImport }: NodeEditorToolbarProps) {
  const { theme, setTheme } = useTheme();
  const { undo, redo, canUndo, canRedo } = useNodeEditorUndoRedo();
  const subMode = useNodeEditorStore((s) => s.subMode);
  const setSubMode = useNodeEditorStore((s) => s.setSubMode);
  const clearAll = useNodeEditorStore((s) => s.clearAll);
  const hasContent = useNodeEditorStore((s) => s.nodes.length > 0);
  const showLogicalName = useNodeEditorStore((s) => s.showLogicalName);
  const toggleShowLogicalName = useNodeEditorStore((s) => s.toggleShowLogicalName);
  const { locale, setLocale, t } = useLocale();

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-background">
      {titleSlot ?? <span className="font-semibold text-sm mr-2">Nodemaid</span>}

      <Separator orientation="vertical" className="h-6" />

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

      <div className="flex-1" />

      {/* Export */}
      {onExport && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onExport}>
              <Upload size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("neExport")}</TooltipContent>
        </Tooltip>
      )}

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
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
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
  );
}
