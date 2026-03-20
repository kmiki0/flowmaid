"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/useLocale";
import { useFlowStore } from "@/store/useFlowStore";
import { serialize } from "@/lib/flowmaid/serialize";
import { toast } from "sonner";
import { locales } from "@/lib/i18n/locales";
import { useLocaleStore } from "@/lib/i18n/useLocale";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const { t } = useLocale();
  const [includeUnused, setIncludeUnused] = useState(true);

  const hasDefinitions = useFlowStore((s) => s.componentDefinitions.length > 0);

  const handleDownload = useCallback(() => {
    const { nodes, edges, direction, componentDefinitions } = useFlowStore.getState();
    const content = serialize(nodes, edges, direction, componentDefinitions, {
      includeUnusedDefinitions: includeUnused,
    });
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "flowchart.flowmaid";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(locales[useLocaleStore.getState().locale]["exportedSuccess"]);
    onOpenChange(false);
  }, [includeUnused, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("exportTitle")}</DialogTitle>
        </DialogHeader>
        {hasDefinitions && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={includeUnused}
              onChange={(e) => setIncludeUnused(e.target.checked)}
              className="rounded border-border"
            />
            {t("exportIncludeUnusedDefs")}
          </label>
        )}
        <DialogFooter>
          <Button onClick={handleDownload}>
            {t("exportDownload")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
