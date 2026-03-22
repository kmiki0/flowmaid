"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { perfCount } from "@/lib/perf";
import {
  Palette,
  Square,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowUp,
  ArrowDown,
  GripHorizontal,
  GripVertical,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  Layers,
  Spline,
  MoveRight,
  Pin,
  PinOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { computeColor } from "@/lib/color";
import { useTheme } from "next-themes";
import { useFlowStore } from "@/store/useFlowStore";
import { useLocale } from "@/lib/i18n/useLocale";
import type { TranslationKey } from "@/lib/i18n/locales";
import type { EdgeType, MarkerStyle, BorderStyle, TextAlign, TextVerticalAlign, StrokeStyle } from "@/types/flow";

const COLORS: { key: TranslationKey; value: string }[] = [
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

const BORDER_WIDTHS: { key: TranslationKey; value: number }[] = [
  { key: "thin", value: 1 },
  { key: "normal", value: 2 },
  { key: "thick", value: 4 },
];

const BORDER_STYLES: { key: TranslationKey; value: BorderStyle }[] = [
  { key: "solid", value: "solid" },
  { key: "dashed", value: "dashed" },
  { key: "dotted", value: "dotted" },
];

const FONT_SIZES: { key: TranslationKey; value: number }[] = [
  { key: "fontSizeSmall", value: 10 },
  { key: "fontSizeNormal", value: 14 },
  { key: "fontSizeLarge", value: 18 },
  { key: "fontSizeXLarge", value: 24 },
];

const STROKE_STYLES: { key: TranslationKey; value: StrokeStyle; dash?: string }[] = [
  { key: "edgeSolid", value: "solid" },
  { key: "edgeDashed", value: "dashed", dash: "6 3" },
  { key: "edgeDotted", value: "dotted", dash: "2 2" },
];

const EDGE_TYPES: { key: TranslationKey; value: EdgeType }[] = [
  { key: "bezier", value: "bezier" },
  { key: "straight", value: "straight" },
  { key: "step", value: "step" },
];

const MARKER_STYLES: { key: TranslationKey; value: MarkerStyle }[] = [
  { key: "arrow", value: "arrowclosed" },
  { key: "openArrow", value: "arrow" },
  { key: "none", value: "none" },
];

function ColorSwatch({ color, opacity, lightness, defaultClass }: { color: string; opacity?: number; lightness?: number; defaultClass?: string }) {
  if (!color) {
    return (
      <span className={`w-3.5 h-3.5 rounded-sm border border-border inline-block ${defaultClass ?? "bg-background"}`} />
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

function ColorDropdown({
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
  // Local slider state for live preview; synced from stored values when dropdown opens
  const [localOpacity, setLocalOpacity] = useState(storedOpacity ?? 10);
  const [localLightness, setLocalLightness] = useState(storedLightness ?? 5);
  const opacity = localOpacity;
  const lightness = localLightness;

  const displayColor = computeColor(currentColor, opacity, lightness);
  return (
    <DropdownMenu onOpenChange={(open) => {
      if (open) {
        setLocalOpacity(storedOpacity ?? 10);
        setLocalLightness(storedLightness ?? 5);
      }
    }}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-1.5 gap-1">
              {icon}
              <span
                className={`w-3.5 h-3.5 rounded-full border border-border block ${!displayColor && defaultSwatchClass ? defaultSwatchClass : ""}`}
                style={displayColor ? { background: displayColor } : !defaultSwatchClass ? { background: "currentColor" } : undefined}
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
            <ColorSwatch color={c.value} opacity={opacity} lightness={lightness} defaultClass={defaultSwatchClass} />
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

// Stable selector: returns comma-joined selected node/edge IDs (string)
// Only triggers re-render when selection actually changes, not on position drag
const selectSelectedNodeIds = (s: { nodes: { id: string; selected?: boolean }[] }) =>
  s.nodes.filter((n) => n.selected).map((n) => n.id).join(",");
const selectSelectedEdgeIds = (s: { edges: { id: string; selected?: boolean }[] }) =>
  s.edges.filter((e) => e.selected).map((e) => e.id).join(",");

export function FormatBar() {
  perfCount("FormatBar");
  const selectedNodeIdStr = useFlowStore(selectSelectedNodeIds);
  const selectedEdgeIdStr = useFlowStore(selectSelectedEdgeIds);
  const selectedNodeIds = useMemo(() => selectedNodeIdStr ? selectedNodeIdStr.split(",") : [], [selectedNodeIdStr]);
  const selectedEdgeIds = useMemo(() => selectedEdgeIdStr ? selectedEdgeIdStr.split(",") : [], [selectedEdgeIdStr]);

  const updateNodeColors = useFlowStore((s) => s.updateNodeColors);
  const updateNodeBorder = useFlowStore((s) => s.updateNodeBorder);
  const reorderNodes = useFlowStore((s) => s.reorderNodes);
  const alignNodes = useFlowStore((s) => s.alignNodes);
  const distributeNodes = useFlowStore((s) => s.distributeNodes);
  const updateNodeTextStyle = useFlowStore((s) => s.updateNodeTextStyle);
  const updateNodeColorAdjust = useFlowStore((s) => s.updateNodeColorAdjust);
  const updateEdgeType = useFlowStore((s) => s.updateEdgeType);
  const updateEdgeMarkers = useFlowStore((s) => s.updateEdgeMarkers);
  const updateEdgeStyle = useFlowStore((s) => s.updateEdgeStyle);
  const updateEdgeColorAdjust = useFlowStore((s) => s.updateEdgeColorAdjust);
  const { t } = useLocale();
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme !== "dark";
  const hideFillColors = isLight ? ["#ffffff"] : ["#000000"];
  const hideFgColors = isLight ? ["#000000"] : ["#ffffff"];

  const hasNodes = selectedNodeIds.length > 0;
  const hasEdges = selectedEdgeIds.length > 0;
  const hasSelection = hasNodes || hasEdges;

  const [pinned, setPinned] = useState(true);
  const isVisible = hasSelection || pinned;

  const contentRef = useRef<HTMLDivElement>(null);
  const firstRowRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (isVisible && firstRowRef.current) {
      setHeight(firstRowRef.current.scrollHeight);
    } else if (isVisible && contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    } else {
      setHeight(0);
    }
  }, [isVisible, selectedNodeIds.length, selectedEdgeIds.length]);

  const multipleNodes = selectedNodeIds.length >= 2;
  const threeOrMoreNodes = selectedNodeIds.length >= 3;

  // Stable selectors: node.data / edge.data references don't change during drag
  // (React Flow only updates position), so these won't cause re-renders while dragging
  const allComponentChildren = useFlowStore((s) => {
    if (!selectedNodeIds.length) return false;
    return selectedNodeIds.every((id) => {
      const n = s.nodes.find((node) => node.id === id);
      return !!n?.data.componentParentId;
    });
  });

  const firstNodeData = useFlowStore((s) => {
    if (!selectedNodeIds.length) return undefined;
    return s.nodes.find((n) => n.id === selectedNodeIds[0])?.data;
  });

  const firstEdgeData = useFlowStore((s) => {
    if (!selectedEdgeIds.length) return undefined;
    return s.edges.find((e) => e.id === selectedEdgeIds[0])?.data;
  });

  return (
    <div
      className={`relative overflow-visible transition-[height,opacity] duration-200 ease-in-out ${isVisible ? "border-b border-border" : ""}`}
      style={{ height, opacity: isVisible ? 1 : 0 }}
    >
    <div ref={contentRef} className="flex flex-col bg-muted/30 text-sm">
      {!hasSelection && pinned && (
        <div ref={firstRowRef} className="flex items-center justify-center gap-0.5 px-3 py-1">
          <span className="text-xs text-muted-foreground">{t("selectElement")}</span>
          <div className="ml-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={pinned ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-1.5"
                  onClick={() => setPinned((p) => !p)}
                >
                  {pinned ? <PinOff size={14} /> : <Pin size={14} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {pinned ? t("unpinFormatBar") : t("pinFormatBar")}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}
      {hasNodes && !allComponentChildren && (
        <div ref={firstRowRef} className="flex items-center gap-0.5 px-3 py-1 overflow-x-auto">
          <span className="text-xs text-muted-foreground font-medium mr-1">Node</span>
          <Separator orientation="vertical" className="h-5 mx-0.5" />
          {/* Fill Color */}
          <ColorDropdown
            label={t("fillColor")}
            icon={<Palette size={14} />}
            currentColor={firstNodeData?.fillColor}
            hideColors={hideFillColors}
            opacity={firstNodeData?.fillOpacity}
            lightness={firstNodeData?.fillLightness}
            onSelect={(color, op, lt) =>
              selectedNodeIds.forEach((id) => {
                updateNodeColors(id, color ?? null, undefined);
                updateNodeColorAdjust(id, "fill", op, lt);
              })
            }
            onOpacityChange={(v) =>
              selectedNodeIds.forEach((id) =>
                updateNodeColorAdjust(id, "fill", v, undefined)
              )
            }
            onLightnessChange={(v) =>
              selectedNodeIds.forEach((id) =>
                updateNodeColorAdjust(id, "fill", undefined, v)
              )
            }
          />

          {/* Border Color */}
          <ColorDropdown
            label={t("borderColor")}
            icon={<Square size={14} />}
            currentColor={firstNodeData?.borderColor}
            defaultSwatchClass="bg-muted-foreground"
            hideColors={hideFgColors}
            opacity={firstNodeData?.borderOpacity}
            lightness={firstNodeData?.borderLightness}
            onSelect={(color, op, lt) =>
              selectedNodeIds.forEach((id) => {
                updateNodeColors(id, undefined, color ?? null);
                updateNodeColorAdjust(id, "border", op, lt);
              })
            }
            onOpacityChange={(v) =>
              selectedNodeIds.forEach((id) =>
                updateNodeColorAdjust(id, "border", v, undefined)
              )
            }
            onLightnessChange={(v) =>
              selectedNodeIds.forEach((id) =>
                updateNodeColorAdjust(id, "border", undefined, v)
              )
            }
          />

          <Separator orientation="vertical" className="h-5 mx-0.5" />

          {/* Border Width */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-1.5 gap-1">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                      <rect x="2" y="2" width="12" height="12" strokeWidth={firstNodeData?.borderWidth ?? 2} rx="1" />
                    </svg>
                    <span className="text-xs">{t("borderWidth")}</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{t("borderWidth")}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent>
              {BORDER_WIDTHS.map((w) => (
                <DropdownMenuItem
                  key={w.value}
                  className="flex items-center gap-2"
                  onClick={() =>
                    selectedNodeIds.forEach((id) =>
                      updateNodeBorder(id, w.value, undefined)
                    )
                  }
                >
                  <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor">
                    <rect x="2" y={7 - w.value / 2} width="16" height={w.value} fill="currentColor" />
                  </svg>
                  {t(w.key)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Border Style */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-1.5 gap-1">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="2" y1="8" x2="14" y2="8"
                        strokeDasharray={
                          (firstNodeData?.borderStyle ?? "solid") === "dashed" ? "4 2" :
                          (firstNodeData?.borderStyle ?? "solid") === "dotted" ? "1.5 1.5" : undefined
                        }
                      />
                    </svg>
                    <span className="text-xs">{t("borderLineStyle")}</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{t("borderLineStyle")}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent>
              {BORDER_STYLES.map((s) => (
                <DropdownMenuItem
                  key={s.value}
                  className="flex items-center gap-2"
                  onClick={() =>
                    selectedNodeIds.forEach((id) =>
                      updateNodeBorder(id, undefined, s.value)
                    )
                  }
                >
                  <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="2">
                    <line
                      x1="2" y1="7" x2="18" y2="7"
                      strokeDasharray={
                        s.value === "dashed" ? "4 2" : s.value === "dotted" ? "1.5 1.5" : undefined
                      }
                    />
                  </svg>
                  {t(s.key)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-5 mx-0.5" />

          {/* Font Size */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-1.5 gap-1">
                    <Type size={14} />
                    <span className="text-xs">{firstNodeData?.fontSize ?? 14}</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{t("fontSize")}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent>
              {FONT_SIZES.map((fs) => (
                <DropdownMenuItem
                  key={fs.value}
                  onClick={() =>
                    selectedNodeIds.forEach((id) =>
                      updateNodeTextStyle(id, { fontSize: fs.value })
                    )
                  }
                >
                  <span style={{ fontSize: fs.value }}>{t(fs.key)}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Text Color */}
          <ColorDropdown
            label={t("textColor")}
            icon={<span className="text-xs font-bold">A</span>}
            currentColor={firstNodeData?.textColor}
            defaultSwatchClass="bg-foreground"
            hideColors={hideFgColors}
            opacity={firstNodeData?.textOpacity}
            lightness={firstNodeData?.textLightness}
            onSelect={(color, op, lt) =>
              selectedNodeIds.forEach((id) => {
                updateNodeTextStyle(id, { textColor: color ?? "" });
                updateNodeColorAdjust(id, "text", op, lt);
              })
            }
            onOpacityChange={(v) =>
              selectedNodeIds.forEach((id) =>
                updateNodeColorAdjust(id, "text", v, undefined)
              )
            }
            onLightnessChange={(v) =>
              selectedNodeIds.forEach((id) =>
                updateNodeColorAdjust(id, "text", undefined, v)
              )
            }
          />

          {/* Text Align */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-1.5">
                    {(firstNodeData?.textAlign ?? "center") === "left" ? (
                      <AlignLeft size={14} />
                    ) : (firstNodeData?.textAlign ?? "center") === "right" ? (
                      <AlignRight size={14} />
                    ) : (
                      <AlignCenter size={14} />
                    )}
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{t("textAlign")}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent>
              <DropdownMenuItem
                className="flex items-center gap-2"
                onClick={() =>
                  selectedNodeIds.forEach((id) =>
                    updateNodeTextStyle(id, { textAlign: "left" })
                  )
                }
              >
                <AlignLeft size={14} />
                {t("alignLeft")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-2"
                onClick={() =>
                  selectedNodeIds.forEach((id) =>
                    updateNodeTextStyle(id, { textAlign: "center" })
                  )
                }
              >
                <AlignCenter size={14} />
                {t("alignCenter")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-2"
                onClick={() =>
                  selectedNodeIds.forEach((id) =>
                    updateNodeTextStyle(id, { textAlign: "right" })
                  )
                }
              >
                <AlignRight size={14} />
                {t("alignRight")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Vertical Text Align */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-1.5">
                    {(firstNodeData?.textVerticalAlign ?? "middle") === "top" ? (
                      <AlignStartHorizontal size={14} />
                    ) : (firstNodeData?.textVerticalAlign ?? "middle") === "bottom" ? (
                      <AlignEndHorizontal size={14} />
                    ) : (
                      <AlignCenterHorizontal size={14} />
                    )}
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{t("textVerticalAlign")}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent>
              <DropdownMenuItem
                className="flex items-center gap-2"
                onClick={() =>
                  selectedNodeIds.forEach((id) =>
                    updateNodeTextStyle(id, { textVerticalAlign: "top" })
                  )
                }
              >
                <AlignStartHorizontal size={14} />
                {t("alignTop")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-2"
                onClick={() =>
                  selectedNodeIds.forEach((id) =>
                    updateNodeTextStyle(id, { textVerticalAlign: "middle" })
                  )
                }
              >
                <AlignCenterHorizontal size={14} />
                {t("alignMiddle")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-2"
                onClick={() =>
                  selectedNodeIds.forEach((id) =>
                    updateNodeTextStyle(id, { textVerticalAlign: "bottom" })
                  )
                }
              >
                <AlignEndHorizontal size={14} />
                {t("alignBottom")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Bold / Italic / Underline */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={firstNodeData?.bold ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-1.5"
                onClick={() =>
                  selectedNodeIds.forEach((id) =>
                    updateNodeTextStyle(id, { bold: !firstNodeData?.bold })
                  )
                }
              >
                <Bold size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("bold")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={firstNodeData?.italic ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-1.5"
                onClick={() =>
                  selectedNodeIds.forEach((id) =>
                    updateNodeTextStyle(id, { italic: !firstNodeData?.italic })
                  )
                }
              >
                <Italic size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("italic")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={firstNodeData?.underline ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-1.5"
                onClick={() =>
                  selectedNodeIds.forEach((id) =>
                    updateNodeTextStyle(id, { underline: !firstNodeData?.underline })
                  )
                }
              >
                <Underline size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("underlineText")}</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5 mx-0.5" />

          {/* Z-Order */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-1.5 gap-1">
                    <Layers size={14} />
                    <span className="text-xs">{t("order")}</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{t("order")}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent>
              <DropdownMenuItem
                className="flex items-center gap-2"
                onClick={() => reorderNodes(selectedNodeIds, "front")}
              >
                <ArrowUpToLine size={14} />
                {t("bringToFront")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-2"
                onClick={() => reorderNodes(selectedNodeIds, "forward")}
              >
                <ArrowUp size={14} />
                {t("bringForward")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="flex items-center gap-2"
                onClick={() => reorderNodes(selectedNodeIds, "backward")}
              >
                <ArrowDown size={14} />
                {t("sendBackward")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-2"
                onClick={() => reorderNodes(selectedNodeIds, "back")}
              >
                <ArrowDownToLine size={14} />
                {t("sendToBack")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Alignment (multi-select) */}
          {multipleNodes && (
            <>
              <Separator orientation="vertical" className="h-5 mx-0.5" />
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 px-1.5 gap-1">
                        <AlignCenterVertical size={14} />
                        <span className="text-xs">{t("align")}</span>
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>{t("align")}</TooltipContent>
                </Tooltip>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    className="flex items-center gap-2"
                    onClick={() => alignNodes(selectedNodeIds, "left")}
                  >
                    <AlignStartVertical size={14} />
                    {t("left")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex items-center gap-2"
                    onClick={() => alignNodes(selectedNodeIds, "center")}
                  >
                    <AlignCenterVertical size={14} />
                    {t("center")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex items-center gap-2"
                    onClick={() => alignNodes(selectedNodeIds, "right")}
                  >
                    <AlignEndVertical size={14} />
                    {t("right")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="flex items-center gap-2"
                    onClick={() => alignNodes(selectedNodeIds, "top")}
                  >
                    <AlignStartHorizontal size={14} />
                    {t("top")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex items-center gap-2"
                    onClick={() => alignNodes(selectedNodeIds, "middle")}
                  >
                    <AlignCenterHorizontal size={14} />
                    {t("middle")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex items-center gap-2"
                    onClick={() => alignNodes(selectedNodeIds, "bottom")}
                  >
                    <AlignEndHorizontal size={14} />
                    {t("bottom")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Distribute (3+ nodes) */}
              {threeOrMoreNodes && (
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 px-1.5 gap-1">
                          <GripHorizontal size={14} />
                          <span className="text-xs">{t("distribute")}</span>
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>{t("distribute")}</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      className="flex items-center gap-2"
                      onClick={() => distributeNodes(selectedNodeIds, "horizontal")}
                    >
                      <GripHorizontal size={14} />
                      {t("horizontal")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="flex items-center gap-2"
                      onClick={() => distributeNodes(selectedNodeIds, "vertical")}
                    >
                      <GripVertical size={14} />
                      {t("vertical")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          )}

          {/* Pin (right end of node row) */}
          <div className="ml-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={pinned ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-1.5"
                  onClick={() => setPinned((p) => !p)}
                >
                  {pinned ? <PinOff size={14} /> : <Pin size={14} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {pinned ? t("unpinFormatBar") : t("pinFormatBar")}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Edge editing */}
      {hasEdges && (() => {
        const isSecondRow = hasNodes && !allComponentChildren;
        return (
        <div
          ref={isSecondRow ? undefined : firstRowRef}
          className={`flex items-center gap-0.5 px-3 py-1 overflow-x-auto ${isSecondRow ? "absolute left-0 right-0 bg-background border-b border-border shadow-sm z-10" : ""}`}
          style={isSecondRow ? { top: "100%" } : undefined}
        >
          <span className="text-xs text-muted-foreground font-medium mr-1">Edge</span>
          <Separator orientation="vertical" className="h-5 mx-0.5" />
          {/* Line Type */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-1.5 gap-1">
                    <Spline size={14} />
                    <span className="text-xs">{t("lineType")}</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{t("lineType")}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent>
              <DropdownMenuItem
                className="flex items-center gap-2"
                onClick={() => selectedEdgeIds.forEach((id) => updateEdgeType(id, "bezier"))}
              >
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M 2 12 C 8 12, 12 2, 18 2" />
                </svg>
                {t("bezier")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-2"
                onClick={() => selectedEdgeIds.forEach((id) => updateEdgeType(id, "straight"))}
              >
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="2" y1="12" x2="18" y2="2" />
                </svg>
                {t("straight")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-2"
                onClick={() => selectedEdgeIds.forEach((id) => updateEdgeType(id, "step"))}
              >
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="2,12 2,7 18,7 18,2" />
                </svg>
                {t("step")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Arrow End */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-1.5 gap-1">
                    <svg width="16" height="14" viewBox="0 0 16 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <line x1="1" y1="7" x2="10" y2="7" />
                      <polygon points="10,3 16,7 10,11" fill="currentColor" stroke="none" />
                    </svg>
                    <span className="text-xs">{t("arrowEnd")}</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{t("arrowEnd")}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent>
              <DropdownMenuItem className="flex items-center gap-2" onClick={() => selectedEdgeIds.forEach((id) => updateEdgeMarkers(id, undefined, "arrowclosed"))}>
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="2" y1="7" x2="14" y2="7" />
                  <polygon points="14,3 20,7 14,11" fill="currentColor" stroke="none" />
                </svg>
                {t("arrow")}
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2" onClick={() => selectedEdgeIds.forEach((id) => updateEdgeMarkers(id, undefined, "arrow"))}>
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="2" y1="7" x2="18" y2="7" />
                  <polyline points="14,3 20,7 14,11" />
                </svg>
                {t("openArrow")}
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2" onClick={() => selectedEdgeIds.forEach((id) => updateEdgeMarkers(id, undefined, "none"))}>
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="2" y1="7" x2="18" y2="7" />
                </svg>
                {t("none")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Arrow Start */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-1.5 gap-1">
                    <svg width="16" height="14" viewBox="0 0 16 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <line x1="6" y1="7" x2="15" y2="7" />
                      <polygon points="6,3 0,7 6,11" fill="currentColor" stroke="none" />
                    </svg>
                    <span className="text-xs">{t("arrowStart")}</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{t("arrowStart")}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent>
              <DropdownMenuItem className="flex items-center gap-2" onClick={() => selectedEdgeIds.forEach((id) => updateEdgeMarkers(id, "arrowclosed", undefined))}>
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="6" y1="7" x2="18" y2="7" />
                  <polygon points="6,3 0,7 6,11" fill="currentColor" stroke="none" />
                </svg>
                {t("arrow")}
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2" onClick={() => selectedEdgeIds.forEach((id) => updateEdgeMarkers(id, "arrow", undefined))}>
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="2" y1="7" x2="18" y2="7" />
                  <polyline points="6,3 0,7 6,11" />
                </svg>
                {t("openArrow")}
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2" onClick={() => selectedEdgeIds.forEach((id) => updateEdgeMarkers(id, "none", undefined))}>
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="2" y1="7" x2="18" y2="7" />
                </svg>
                {t("none")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-5 mx-0.5" />

          {/* Edge Line Style */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-1.5 gap-1">
                    <svg width="14" height="14" viewBox="0 0 16 14" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="1" y1="7" x2="15" y2="7"
                        strokeDasharray={
                          (firstEdgeData?.strokeStyle ?? "solid") === "dashed" ? "4 2" :
                          (firstEdgeData?.strokeStyle ?? "solid") === "dotted" ? "1.5 1.5" : undefined
                        }
                      />
                    </svg>
                    <span className="text-xs">{t("edgeLineStyle")}</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{t("edgeLineStyle")}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent>
              {STROKE_STYLES.map((s) => (
                <DropdownMenuItem
                  key={s.value}
                  className="flex items-center gap-2"
                  onClick={() =>
                    selectedEdgeIds.forEach((id) =>
                      updateEdgeStyle(id, undefined, undefined, s.value)
                    )
                  }
                >
                  <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="2" y1="7" x2="18" y2="7" strokeDasharray={s.dash} />
                  </svg>
                  {t(s.key)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Line Width */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-1.5 gap-1">
                    <svg width="14" height="14" viewBox="0 0 16 14" fill="none" stroke="currentColor">
                      <line x1="1" y1="7" x2="15" y2="7" strokeWidth={firstEdgeData?.strokeWidth ?? 2} />
                    </svg>
                    <span className="text-xs">{t("lineWidth")}</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{t("lineWidth")}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent>
              {BORDER_WIDTHS.map((w) => (
                <DropdownMenuItem
                  key={w.value}
                  className="flex items-center gap-2"
                  onClick={() =>
                    selectedEdgeIds.forEach((id) =>
                      updateEdgeStyle(id, w.value, undefined)
                    )
                  }
                >
                  <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor">
                    <line x1="2" y1="7" x2="18" y2="7" strokeWidth={w.value} />
                  </svg>
                  {t(w.key)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Line Color */}
          <ColorDropdown
            label={t("lineColor")}
            icon={<Palette size={14} />}
            currentColor={firstEdgeData?.strokeColor}
            defaultSwatchClass="bg-foreground"
            hideColors={hideFgColors}
            opacity={firstEdgeData?.strokeOpacity}
            lightness={firstEdgeData?.strokeLightness}
            onSelect={(color, op, lt) =>
              selectedEdgeIds.forEach((id) => {
                updateEdgeStyle(id, undefined, color ?? "");
                updateEdgeColorAdjust(id, op, lt);
              })
            }
            onOpacityChange={(v) =>
              selectedEdgeIds.forEach((id) =>
                updateEdgeColorAdjust(id, v, undefined)
              )
            }
            onLightnessChange={(v) =>
              selectedEdgeIds.forEach((id) =>
                updateEdgeColorAdjust(id, undefined, v)
              )
            }
          />

          {/* Pin (right end of edge row, or only row if no nodes) */}
          {(!hasNodes || allComponentChildren) && (
            <div className="ml-auto">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={pinned ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-1.5"
                    onClick={() => setPinned((p) => !p)}
                  >
                    {pinned ? <PinOff size={14} /> : <Pin size={14} />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {pinned ? t("unpinFormatBar") : t("pinFormatBar")}
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
        );
      })()}
    </div>
    </div>
  );
}
