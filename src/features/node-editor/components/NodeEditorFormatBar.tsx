"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import {
  Palette,
  Square,
  Type,
  Pin,
  PinOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { ColorDropdown } from "@/shared/components/ColorDropdown";
import { useNodeEditorStore } from "../store/useNodeEditorStore";
import { useLocale } from "@/lib/i18n/useLocale";
import { useTheme } from "next-themes";
import type { TranslationKey } from "@/lib/i18n/locales";

const BORDER_WIDTHS: { key: TranslationKey; value: number }[] = [
  { key: "thin", value: 1 },
  { key: "normal", value: 2 },
  { key: "thick", value: 4 },
];

const BORDER_STYLES: { key: TranslationKey; value: "solid" | "dashed" | "dotted" }[] = [
  { key: "solid", value: "solid" },
  { key: "dashed", value: "dashed" },
  { key: "dotted", value: "dotted" },
];

const selectSelectedNodeIds = (s: { nodes: { id: string; selected?: boolean }[] }) =>
  s.nodes.filter((n) => n.selected).map((n) => n.id).join(",");

export function NodeEditorFormatBar() {
  const selectedNodeIdStr = useNodeEditorStore(selectSelectedNodeIds);
  const selectedNodeIds = useMemo(
    () => (selectedNodeIdStr ? selectedNodeIdStr.split(",") : []),
    [selectedNodeIdStr]
  );

  const updateNodeStyle = useNodeEditorStore((s) => s.updateNodeStyle);
  const { t } = useLocale();
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme !== "dark";
  const hideFillColors = isLight ? ["#ffffff"] : ["#000000"];
  const hideFgColors = isLight ? ["#000000"] : ["#ffffff"];

  const hasNodes = selectedNodeIds.length > 0;

  const firstNodeData = useNodeEditorStore((s) => {
    if (!selectedNodeIds.length) return undefined;
    return s.nodes.find((n) => n.id === selectedNodeIds[0])?.data;
  });

  const [pinned, setPinned] = useState(true);
  const isVisible = hasNodes || pinned;

  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (isVisible && contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    } else {
      setHeight(0);
    }
  }, [isVisible, hasNodes]);

  return (
    <div
      className={`relative overflow-visible transition-[height,opacity] duration-200 ease-in-out ${isVisible ? "border-b border-border" : ""}`}
      style={{ height, opacity: isVisible ? 1 : 0 }}
    >
      <div ref={contentRef} className="flex flex-col bg-muted/30 text-sm">
        <div className="flex items-center gap-0.5 px-3 py-1 overflow-x-auto">
          {hasNodes ? (
            <>
              <span className="text-xs text-muted-foreground font-medium mr-1">Node</span>
              <Separator orientation="vertical" className="h-5 mx-0.5" />

            {/* Fill Color */}
            <ColorDropdown
              label={t("neFillColor")}
              icon={<Palette size={14} />}
              currentColor={firstNodeData?.fillColor}
              hideColors={hideFillColors}
              opacity={firstNodeData?.fillOpacity}
              onSelect={(color, op) =>
                selectedNodeIds.forEach((id) =>
                  updateNodeStyle(id, { fillColor: color ?? undefined, fillOpacity: op })
                )
              }
              onOpacityChange={(v) =>
                selectedNodeIds.forEach((id) =>
                  updateNodeStyle(id, { fillOpacity: v })
                )
              }
            />

            {/* Border Color */}
            <ColorDropdown
              label={t("neBorderColor")}
              icon={<Square size={14} />}
              currentColor={firstNodeData?.borderColor}
              defaultSwatchClass="bg-muted-foreground"
              hideColors={hideFgColors}
              onSelect={(color) =>
                selectedNodeIds.forEach((id) =>
                  updateNodeStyle(id, { borderColor: color ?? undefined })
                )
              }
            />

            {/* Text Color */}
            <ColorDropdown
              label={t("neTextColor")}
              icon={<Type size={14} />}
              currentColor={firstNodeData?.textColor}
              hideColors={hideFgColors}
              onSelect={(color) =>
                selectedNodeIds.forEach((id) =>
                  updateNodeStyle(id, { textColor: color ?? undefined })
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
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>{t("neBorderWidth")}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent>
                {BORDER_WIDTHS.map((w) => (
                  <DropdownMenuItem
                    key={w.value}
                    className="flex items-center gap-2"
                    onClick={() =>
                      selectedNodeIds.forEach((id) =>
                        updateNodeStyle(id, { borderWidth: w.value })
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
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                        <rect
                          x="2" y="2" width="12" height="12" strokeWidth="1.5" rx="1"
                          strokeDasharray={
                            firstNodeData?.borderStyle === "dashed" ? "4 2" :
                            firstNodeData?.borderStyle === "dotted" ? "1.5 1.5" : undefined
                          }
                        />
                      </svg>
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>{t("neBorderStyle")}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent>
                {BORDER_STYLES.map((s) => (
                  <DropdownMenuItem
                    key={s.value}
                    className="flex items-center gap-2"
                    onClick={() =>
                      selectedNodeIds.forEach((id) =>
                        updateNodeStyle(id, { borderStyle: s.value })
                      )
                    }
                  >
                    <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor">
                      <line
                        x1="2" y1="7" x2="18" y2="7" strokeWidth="2"
                        strokeDasharray={
                          s.value === "dashed" ? "6 3" :
                          s.value === "dotted" ? "2 2" : undefined
                        }
                      />
                    </svg>
                    {t(s.key)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">{t("neSelectNode")}</span>
          )}
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
      </div>
    </div>
  );
}
