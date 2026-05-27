"use client";

import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { Box, Zap, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useNodeEditorStore } from "../store/useNodeEditorStore";
import { useLocale } from "@/lib/i18n/useLocale";
import type { NodeEditorNodeKind } from "../types";

const NODE_KINDS: { kind: NodeEditorNodeKind; icon: typeof Box; labelKey: string }[] = [
  { kind: "generic", icon: Box, labelKey: "neGenericNode" },
  { kind: "service", icon: Zap, labelKey: "neServiceNode" },
  { kind: "table", icon: Database, labelKey: "neTableNode" },
];

export function NodeEditorPalette() {
  const addNode = useNodeEditorStore((s) => s.addNode);
  const { screenToFlowPosition } = useReactFlow();
  const { t } = useLocale();

  const handleAddNode = useCallback(
    (kind: NodeEditorNodeKind) => {
      // Place at center of visible viewport using screenToFlowPosition
      // which correctly accounts for panel offsets
      const center = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      addNode(kind, { x: center.x - 140, y: center.y - 80 });
    },
    [addNode, screenToFlowPosition]
  );

  return (
    <div className="flex flex-col gap-2 p-3">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {t("neAddNode")}
      </span>
      <Separator />
      <div className="flex flex-col gap-1">
        {NODE_KINDS.map(({ kind, icon: Icon, labelKey }) => (
          <Button
            key={kind}
            variant="ghost"
            size="sm"
            className="justify-start gap-2 h-9"
            onClick={() => handleAddNode(kind)}
          >
            <Icon size={16} />
            {t(labelKey as never)}
          </Button>
        ))}
      </div>
    </div>
  );
}
