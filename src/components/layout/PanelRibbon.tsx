"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale } from "@/lib/i18n/useLocale";

interface PanelRibbonProps {
  side: "left" | "right";
  isOpen: boolean;
  onClick: () => void;
  label?: string;
}

export function PanelRibbon({ side, isOpen, onClick, label }: PanelRibbonProps) {
  const { t } = useLocale();

  const showChevron = () => {
    if (side === "left") {
      return isOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />;
    }
    return isOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />;
  };

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center w-6 h-full bg-muted/50 hover:bg-muted border-x border-border cursor-pointer shrink-0"
      title={isOpen ? t("closePanel") : t("openPanel")}
    >
      {showChevron()}
      {label && (
        <span
          className="text-[10px] text-muted-foreground"
          style={{
            writingMode: "vertical-rl",
            textOrientation: "mixed",
          }}
        >
          {label}
        </span>
      )}
    </button>
  );
}
