"use client";

import { useLocale } from "@/lib/i18n/useLocale";
import type { DiffFilters } from "@/lib/diff/types";

interface DiffFilterBarProps {
  filters: DiffFilters;
  onFiltersChange: (filters: DiffFilters) => void;
  flowOpacity: number;
  onFlowOpacityChange: (opacity: number) => void;
}

export function DiffFilterBar({ filters, onFiltersChange, flowOpacity, onFlowOpacityChange }: DiffFilterBarProps) {
  const { t } = useLocale();

  const toggle = (key: keyof DiffFilters) => {
    onFiltersChange({ ...filters, [key]: !filters[key] });
  };

  const items: { key: keyof DiffFilters; label: string }[] = [
    { key: "added", label: t("diffKindAdded") },
    { key: "deleted", label: t("diffKindDeleted") },
    { key: "modified", label: t("diffKindModified") },
  ];

  return (
    <div className="flex items-center gap-3">
      {/* Flow opacity slider */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground select-none">{t("diffOpacity")}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(flowOpacity * 100)}
          onChange={(e) => onFlowOpacityChange(Number(e.target.value) / 100)}
          className="w-16 h-3 accent-primary cursor-pointer"
        />
      </div>
      {/* Separator */}
      <span className="text-border">|</span>
      {/* Filter checkboxes */}
      {items.map(({ key, label }) => (
        <label key={key} className="flex items-center gap-1 text-xs cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filters[key]}
            onChange={() => toggle(key)}
            className="accent-primary h-3.5 w-3.5"
          />
          {label}
        </label>
      ))}
    </div>
  );
}
