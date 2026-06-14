"use client";

import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { Box, Zap, Database, Shapes } from "lucide-react";
import { useNodeEditorStore } from "../store/useNodeEditorStore";
import { useLocale } from "@/lib/i18n/useLocale";
import type { NodeEditorNodeKind } from "../types";

const NODE_KINDS: { kind: NodeEditorNodeKind; icon: typeof Box; labelKey: string; descKey: string }[] = [
  { kind: "generic", icon: Box, labelKey: "neGenericNode", descKey: "neGenericNodeDesc" },
  { kind: "service", icon: Zap, labelKey: "neServiceNode", descKey: "neServiceNodeDesc" },
  { kind: "table", icon: Database, labelKey: "neTableNode", descKey: "neTableNodeDesc" },
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
    // pointer-events-none: カード外（キャンバス）の操作を透過させるフローティングオーバーレイ
    <div className="h-full flex flex-col items-start justify-center pointer-events-none">
      {/* アイコンレール: 折りたたみ時はアイコンのみ。ホバーで幅が広がり説明付きカードに展開（Twilio Studioパターン） */}
      <div className="group pointer-events-auto glass-panel flex flex-col overflow-hidden w-[54px] hover:w-52 transition-[width] duration-200 ease-out [interpolate-size:allow-keywords]">
        <div className="pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0 flex items-center justify-center px-2">
          <Shapes size={12} />
        </div>
        <div className="flex flex-col gap-1 p-2">
          {NODE_KINDS.map(({ kind, icon: Icon, labelKey, descKey }) => (
            <button
              key={kind}
              className="flex w-full items-center justify-center gap-0 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors whitespace-nowrap group-hover:justify-start group-hover:gap-2.5"
              onClick={() => handleAddNode(kind)}
            >
              <Icon size={18} className="shrink-0 text-muted-foreground" />
              {/* 展開時: 名前 + 一言説明のカード */}
              <span className="hidden min-w-0 flex-col items-start group-hover:flex">
                <span className="text-xs font-medium text-foreground">{t(labelKey as never)}</span>
                <span className="w-full truncate text-left text-[10px] text-muted-foreground">
                  {t(descKey as never)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
