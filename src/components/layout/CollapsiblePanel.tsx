"use client";

import { PanelRibbon } from "./PanelRibbon";

interface CollapsiblePanelProps {
  side: "left" | "right";
  isOpen: boolean;
  onToggle: () => void;
  width: number;
  ribbonLabel?: string;
  children: React.ReactNode;
}

export function CollapsiblePanel({
  side,
  isOpen,
  onToggle,
  width,
  ribbonLabel,
  children,
}: CollapsiblePanelProps) {
  return (
    <div className="flex h-full shrink-0">
      {side === "right" && (
        <PanelRibbon
          side="right"
          isOpen={isOpen}
          onClick={onToggle}
          label={ribbonLabel}
        />
      )}
      <div
        className="overflow-hidden transition-[width] duration-200 ease-in-out"
        style={{ width: isOpen ? width : 0 }}
      >
        <div className="h-full" style={{ width }}>
          {children}
        </div>
      </div>
      {side === "left" && (
        <PanelRibbon
          side="left"
          isOpen={isOpen}
          onClick={onToggle}
          label={ribbonLabel}
        />
      )}
    </div>
  );
}
