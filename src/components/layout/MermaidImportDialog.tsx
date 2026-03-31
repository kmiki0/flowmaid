"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLocale } from "@/lib/i18n/useLocale";
import { parseMermaid } from "@/lib/mermaid/parse";
import { renderMermaidLayout } from "@/lib/mermaid/renderLayout";
import { useFlowStore } from "@/store/useFlowStore";
import { toast } from "sonner";
import type { EdgeType } from "@/types/flow";

const EDGE_TYPE_STORAGE_KEY = "flowmaid-mermaid-edge-type";

function getStoredEdgeType(): EdgeType {
  if (typeof window === "undefined") return "bezier";
  const stored = localStorage.getItem(EDGE_TYPE_STORAGE_KEY);
  if (stored === "bezier" || stored === "straight" || stored === "step") return stored;
  return "bezier";
}

interface MermaidImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function MermaidImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: MermaidImportDialogProps) {
  const [text, setText] = useState("");
  const [edgeType, setEdgeType] = useState<EdgeType>(getStoredEdgeType);
  const { t } = useLocale();
  const loadState = useFlowStore((s) => s.loadState);
  const hasContent = useFlowStore((s) => s.nodes.length > 0 || s.edges.length > 0);

  const handleEdgeTypeChange = (value: string) => {
    if (!value) return;
    const et = value as EdgeType;
    setEdgeType(et);
    localStorage.setItem(EDGE_TYPE_STORAGE_KEY, et);
  };

  const [loading, setLoading] = useState(false);

  const doConvert = async () => {
    setLoading(true);
    try {
      // Step 1: Try mermaid.js layout first for accurate positioning
      let layout: Awaited<ReturnType<typeof renderMermaidLayout>> | undefined;
      try {
        layout = await renderMermaidLayout(text);
      } catch (e) {
        console.warn("mermaid.js layout failed, falling back to autoLayout", e);
      }

      // Step 2: Parse with layout result
      const result = parseMermaid(text, edgeType, layout);
      loadState(result);
      toast.success(t("mermaidImportSuccess"));
      setText("");
      onOpenChange(false);
      onSuccess?.();
    } catch {
      toast.error(t("mermaidParseFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = async () => {
    if (hasContent) {
      if (!window.confirm(t("mermaidOverwriteConfirm"))) return;
    }
    await doConvert();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("importMermaid")}</DialogTitle>
          <DialogDescription>{t("mermaidImportDesc")}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t("edgeTypeLabel")}:</span>
          <ToggleGroup
            type="single"
            value={edgeType}
            onValueChange={handleEdgeTypeChange}
          >
            <ToggleGroupItem value="bezier" className="h-8 px-2 text-xs">
              {t("bezier")}
            </ToggleGroupItem>
            <ToggleGroupItem value="straight" className="h-8 px-2 text-xs">
              {t("straight")}
            </ToggleGroupItem>
            <ToggleGroupItem value="step" className="h-8 px-2 text-xs">
              {t("step")}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <textarea
          className="w-full h-48 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"graph TD\n    A[Start] --> B{Condition}\n    B -->|Yes| C[End]"}
        />
        <DialogFooter>
          <Button onClick={handleConvert} disabled={!text.trim() || loading}>
            {loading ? "..." : t("convert")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
