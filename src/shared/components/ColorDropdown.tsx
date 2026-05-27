"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { computeColor } from "@/lib/color";
import { useLocale } from "@/lib/i18n/useLocale";
import type { TranslationKey } from "@/lib/i18n/locales";

export const COLORS: { key: TranslationKey; value: string }[] = [
  { key: "colorDefault", value: "" },
  { key: "colorRed", value: "#ef4444" },
  { key: "colorOrange", value: "#f97316" },
  { key: "colorYellow", value: "#eab308" },
  { key: "colorGreen", value: "#22c55e" },
  { key: "colorBlue", value: "#3b82f6" },
  { key: "colorPurple", value: "#a855f7" },
  { key: "colorPink", value: "#ec4899" },
  { key: "colorWhite", value: "#ffffff" },
  { key: "colorBlack", value: "#000000" },
];

export function ColorSwatch({
  color,
  opacity,
  lightness,
  defaultClass,
}: {
  color: string;
  opacity?: number;
  lightness?: number;
  defaultClass?: string;
}) {
  if (!color) {
    return (
      <span
        className={`w-3.5 h-3.5 rounded-sm border border-border inline-block ${defaultClass ?? "bg-background"}`}
      />
    );
  }
  const adjusted = computeColor(color, opacity, lightness) ?? color;
  return (
    <span
      className="w-3.5 h-3.5 rounded-sm border border-border inline-block"
      style={{ background: adjusted }}
    />
  );
}

export function ColorDropdown({
  label,
  icon,
  currentColor,
  opacity: storedOpacity,
  lightness: storedLightness,
  defaultSwatchClass,
  hideColors,
  onSelect,
  onOpacityChange,
  onLightnessChange,
}: {
  label: string;
  icon: React.ReactNode;
  currentColor?: string;
  opacity?: number;
  lightness?: number;
  defaultSwatchClass?: string;
  hideColors?: string[];
  onSelect: (color: string | undefined, opacity?: number, lightness?: number) => void;
  onOpacityChange?: (value: number) => void;
  onLightnessChange?: (value: number) => void;
}) {
  const { t } = useLocale();
  const [localOpacity, setLocalOpacity] = useState(storedOpacity ?? 10);
  const [localLightness, setLocalLightness] = useState(storedLightness ?? 5);
  const opacity = localOpacity;
  const lightness = localLightness;

  const displayColor = computeColor(currentColor, opacity, lightness);
  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) {
          setLocalOpacity(storedOpacity ?? 10);
          setLocalLightness(storedLightness ?? 5);
        }
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-1.5 gap-1">
              {icon}
              <span
                className={`w-3.5 h-3.5 rounded-full border border-border block ${!displayColor && defaultSwatchClass ? defaultSwatchClass : ""}`}
                style={
                  displayColor
                    ? { background: displayColor }
                    : !defaultSwatchClass
                      ? { background: "currentColor" }
                      : undefined
                }
              />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent className="w-48" onCloseAutoFocus={(e) => e.preventDefault()}>
        {COLORS.filter((c) => !hideColors?.includes(c.value)).map((c) => (
          <DropdownMenuItem
            key={c.key}
            className="flex items-center gap-2"
            onClick={() => {
              if (c.value) {
                onSelect(c.value, opacity, lightness);
              } else {
                setLocalOpacity(10);
                setLocalLightness(5);
                onSelect(undefined, 10, 5);
              }
            }}
          >
            <ColorSwatch
              color={c.value}
              opacity={opacity}
              lightness={lightness}
              defaultClass={defaultSwatchClass}
            />
            {t(c.key)}
          </DropdownMenuItem>
        ))}
        {(onOpacityChange || onLightnessChange) && (
          <>
            <DropdownMenuSeparator />
            {onOpacityChange && (
              <div className="px-2 py-1.5" onPointerDown={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">{t("transparency")}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{opacity}</span>
                </div>
                <Slider
                  min={0}
                  max={10}
                  step={1}
                  value={[opacity]}
                  onValueChange={([v]) => {
                    setLocalOpacity(v);
                    onOpacityChange(v);
                  }}
                />
              </div>
            )}
            {onLightnessChange && (
              <div className="px-2 py-1.5" onPointerDown={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">{t("brightness")}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{lightness}</span>
                </div>
                <Slider
                  min={0}
                  max={10}
                  step={1}
                  value={[lightness]}
                  onValueChange={([v]) => {
                    setLocalLightness(v);
                    onLightnessChange(v);
                  }}
                />
              </div>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
