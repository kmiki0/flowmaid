"use client";

import { useState } from "react";
import { useDnD } from "@/hooks/useDnD";
import { useLocale } from "@/lib/i18n/useLocale";
import { useFlowStore } from "@/store/useFlowStore";
import type { TranslationKey } from "@/lib/i18n/locales";
import { ComponentManagerPanel } from "@/components/flowComponent/ComponentManagerPanel";

const shapes: { type: string; key: TranslationKey; tooltipKey: TranslationKey; icon: React.ReactNode }[] = [
  { type: "rectangle", key: "rectangle", tooltipKey: "rectangleDesc", icon: <rect x="4" y="8" width="24" height="16" rx="0" /> },
  { type: "roundedRect", key: "roundedRect", tooltipKey: "roundedRectDesc", icon: <rect x="4" y="8" width="24" height="16" rx="6" /> },
  { type: "diamond", key: "diamond", tooltipKey: "diamondDesc", icon: <polygon points="16 4, 28 16, 16 28, 4 16" /> },
  { type: "circle", key: "circle", tooltipKey: "circleDesc", icon: <circle cx="16" cy="16" r="12" /> },
  { type: "stadium", key: "stadium", tooltipKey: "stadiumDesc", icon: <rect x="4" y="8" width="24" height="16" rx="8" /> },
  { type: "parallelogram", key: "parallelogram", tooltipKey: "parallelogramDesc", icon: <polygon points="8 8, 28 8, 24 24, 4 24" /> },
  { type: "cylinder", key: "cylinder", tooltipKey: "cylinderDesc", icon: (
    <>
      <path d="M 6 12 Q 6 8 16 8 Q 26 8 26 12 L 26 22 Q 26 26 16 26 Q 6 26 6 22 Z" />
      <path d="M 6 12 Q 6 16 16 16 Q 26 16 26 12" />
    </>
  )},
  { type: "hexagon", key: "hexagon", tooltipKey: "hexagonDesc", icon: <polygon points="10 6, 22 6, 28 16, 22 26, 10 26, 4 16" /> },
  { type: "trapezoid", key: "trapezoid", tooltipKey: "trapezoidDesc", icon: <polygon points="10 8, 22 8, 28 24, 4 24" /> },
  { type: "document", key: "document", tooltipKey: "documentDesc", icon: (
    <path d="M 4 8 L 28 8 L 28 22 Q 22 26 16 22 Q 10 18 4 22 Z" />
  )},
  { type: "manualInput", key: "manualInput", tooltipKey: "manualInputDesc", icon: <polygon points="4 12, 28 8, 28 24, 4 24" /> },
  { type: "internalStorage", key: "internalStorage", tooltipKey: "internalStorageDesc", icon: (
    <>
      <rect x="4" y="8" width="24" height="16" rx="0" />
      <line x1="8" y1="8" x2="8" y2="24" />
      <line x1="4" y1="12" x2="28" y2="12" />
    </>
  )},
  { type: "display", key: "display", tooltipKey: "displayDesc", icon: (
    <path d="M 9 8 L 22 8 Q 28 16 22 24 L 9 24 Q 4 16 9 8 Z" />
  )},
  { type: "text", key: "freeText", tooltipKey: "freeTextDesc", icon: <text x="16" y="20" textAnchor="middle" fill="currentColor" stroke="none" fontSize="16" fontWeight="bold">T</text> },
];

type Tab = "nodes" | "components";

export function NodePalette() {
  const { onDragStart, onDragEnd } = useDnD();
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<Tab>("nodes");
  const isEditingComponent = useFlowStore((s) => !!s.editingComponentId);
  const displayedTab = isEditingComponent ? "nodes" : activeTab;

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Tab bar — hide during component editing to prevent nesting */}
      {!isEditingComponent && (
        <div className="flex border-b border-border shrink-0">
          <button
            className={`flex-1 px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
              activeTab === "nodes"
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("nodes")}
          >
            {t("nodes")}
          </button>
          <button
            className={`flex-1 px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
              activeTab === "components"
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("components")}
          >
            {t("component")}
          </button>
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3">
        {displayedTab === "nodes" ? (
          <div className="grid grid-cols-2 gap-2">
            {shapes.map(({ type, key, tooltipKey, icon }) => (
              <button
                key={type}
                className="flex flex-col items-center gap-1 p-2 rounded-md border border-border hover:bg-muted cursor-grab active:cursor-grabbing transition-colors"
                draggable
                onDragStart={(e) => onDragStart(e, type)}
                onDragEnd={onDragEnd}
                title={t(tooltipKey)}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 32 32"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  {icon}
                </svg>
                <span className="text-[10px] text-muted-foreground leading-tight text-center">
                  {t(key)}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <ComponentManagerPanel />
        )}
      </div>
    </div>
  );
}
