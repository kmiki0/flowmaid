"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { useFlowStore } from "@/store/useFlowStore";
import { useLocale } from "@/lib/i18n/useLocale";
import { NodeShape } from "@/types/flow";
import type { EdgeType, MarkerStyle } from "@/types/flow";
import type { TranslationKey } from "@/lib/i18n/locales";
import { computeColor } from "@/lib/color";

interface MenuPosition {
  x: number;
  y: number;
}

interface ContextMenuState {
  position: MenuPosition | null;
  nodeIds: string[];
  edgeIds: string[];
}

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

function IconBezier() {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M 2 12 C 8 12, 12 2, 18 2" />
    </svg>
  );
}
function IconStraight() {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="2" y1="12" x2="18" y2="2" />
    </svg>
  );
}
function IconStep() {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polyline points="2,12 2,7 18,7 18,2" />
    </svg>
  );
}
function IconArrowClosed() {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="2" y1="7" x2="14" y2="7" />
      <polygon points="14,3 20,7 14,11" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconArrowOpen() {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="2" y1="7" x2="18" y2="7" />
      <polyline points="14,3 20,7 14,11" />
    </svg>
  );
}
function IconNoArrow() {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="2" y1="7" x2="18" y2="7" />
    </svg>
  );
}

const EDGE_TYPES: { key: TranslationKey; value: EdgeType; icon: React.ReactNode }[] = [
  { key: "bezier", value: "bezier", icon: <IconBezier /> },
  { key: "straight", value: "straight", icon: <IconStraight /> },
  { key: "step", value: "step", icon: <IconStep /> },
];

const MARKER_STYLES: { key: TranslationKey; value: MarkerStyle; icon: React.ReactNode }[] = [
  { key: "arrow", value: "arrowclosed", icon: <IconArrowClosed /> },
  { key: "openArrow", value: "arrow", icon: <IconArrowOpen /> },
  { key: "none", value: "none", icon: <IconNoArrow /> },
];

const SHAPE_ITEMS: { key: TranslationKey; value: NodeShape; icon: React.ReactNode }[] = [
  { key: "rectangle", value: NodeShape.Rectangle, icon: <rect x="4" y="8" width="24" height="16" rx="0" /> },
  { key: "diamond", value: NodeShape.Diamond, icon: <polygon points="16 4, 28 16, 16 28, 4 16" /> },
  { key: "roundedRect", value: NodeShape.RoundedRect, icon: <rect x="4" y="8" width="24" height="16" rx="6" /> },
  { key: "circle", value: NodeShape.Circle, icon: <circle cx="16" cy="16" r="12" /> },
  { key: "parallelogram", value: NodeShape.Parallelogram, icon: <polygon points="8 8, 28 8, 24 24, 4 24" /> },
  { key: "cylinder", value: NodeShape.Cylinder, icon: <><path d="M 6 12 Q 6 8 16 8 Q 26 8 26 12 L 26 22 Q 26 26 16 26 Q 6 26 6 22 Z" /><path d="M 6 12 Q 6 16 16 16 Q 26 16 26 12" /></> },
  { key: "hexagon", value: NodeShape.Hexagon, icon: <polygon points="10 6, 22 6, 28 16, 22 26, 10 26, 4 16" /> },
  { key: "stadium", value: NodeShape.Stadium, icon: <rect x="4" y="8" width="24" height="16" rx="8" /> },
  { key: "trapezoid", value: NodeShape.Trapezoid, icon: <polygon points="10 8, 22 8, 28 24, 4 24" /> },
  { key: "document", value: NodeShape.Document, icon: <path d="M 4 8 L 28 8 L 28 22 Q 22 26 16 22 Q 10 18 4 22 Z" /> },
  { key: "predefinedProcess", value: NodeShape.PredefinedProcess, icon: <><rect x="4" y="8" width="24" height="16" rx="0" /><line x1="8" y1="8" x2="8" y2="24" /><line x1="24" y1="8" x2="24" y2="24" /></> },
  { key: "manualInput", value: NodeShape.ManualInput, icon: <polygon points="4 12, 28 8, 28 24, 4 24" /> },
  { key: "internalStorage", value: NodeShape.InternalStorage, icon: <><rect x="4" y="8" width="24" height="16" rx="0" /><line x1="8" y1="8" x2="8" y2="24" /><line x1="4" y1="12" x2="28" y2="12" /></> },
  { key: "display", value: NodeShape.Display, icon: <path d="M 9 8 L 22 8 Q 28 16 22 24 L 9 24 Q 4 16 9 8 Z" /> },
];

export function useContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState>({
    position: null,
    nodeIds: [],
    edgeIds: [],
  });

  const open = useCallback(
    (e: React.MouseEvent, nodeIds: string[], edgeIds: string[]) => {
      e.preventDefault();
      setMenu({ position: { x: e.clientX, y: e.clientY }, nodeIds, edgeIds });
    },
    []
  );

  const close = useCallback(() => {
    setMenu({ position: null, nodeIds: [], edgeIds: [] });
  }, []);

  return { menu, open, close };
}

interface ContextMenuProps {
  position: MenuPosition;
  nodeIds: string[];
  edgeIds: string[];
  onClose: () => void;
}

function SubMenu({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const subRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left?: string; right?: string; top: string }>({ top: "0" });

  useEffect(() => {
    if (!open || !subRef.current) return;
    const rect = subRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const newPos: { left?: string; right?: string; top: string } = { top: "0" };
    // Flip to left if overflowing right
    if (rect.right > vw) {
      newPos.right = "100%";
    } else {
      newPos.left = "100%";
    }
    // Shift up if overflowing bottom
    if (rect.bottom > vh) {
      newPos.top = `${vh - rect.bottom}px`;
    }
    setPos(newPos);
  }, [open]);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => { setOpen(false); setPos({ top: "0" }); }}
    >
      <div className="ctx-item flex items-center justify-between">
        {label}
        <span className="ml-4 text-[10px]">▶</span>
      </div>
      {open && (
        <div
          ref={subRef}
          className="absolute ctx-menu"
          style={{ left: pos.left, right: pos.right, top: pos.top, marginLeft: pos.left ? 2 : undefined, marginRight: pos.right ? 2 : undefined }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function ColorSubMenu({
  label,
  colors,
  defaultSwatchClass,
  storedOpacity,
  storedLightness,
  onSelect,
  onOpacityChange,
  onLightnessChange,
  t,
}: {
  label: string;
  colors: typeof COLORS;
  defaultSwatchClass?: string;
  storedOpacity?: number;
  storedLightness?: number;
  onSelect: (color: string | null, opacity: number, lightness: number) => void;
  onOpacityChange: (value: number) => void;
  onLightnessChange: (value: number) => void;
  t: (key: TranslationKey) => string;
}) {
  const [opacity, setOpacity] = useState(storedOpacity ?? 10);
  const [lightness, setLightness] = useState(storedLightness ?? 5);

  return (
    <SubMenu label={label}>
      {colors.map((c) => {
        const adjusted = c.value ? computeColor(c.value, opacity, lightness) : undefined;
        return (
          <div
            key={c.key}
            className="ctx-item flex items-center gap-2"
            onClick={() => {
              if (c.value) {
                onSelect(c.value, opacity, lightness);
              } else {
                setOpacity(10);
                setLightness(5);
                onSelect(null, 10, 5);
              }
            }}
          >
            {adjusted ? (
              <span className="w-3 h-3 rounded-sm border border-border inline-block" style={{ background: adjusted }} />
            ) : (
              <span className={`w-3 h-3 rounded-sm border border-border inline-block ${defaultSwatchClass ?? "bg-background"}`} />
            )}
            {t(c.key)}
          </div>
        );
      })}
      <div className="ctx-separator" />
      <div className="px-2 py-1.5" onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-muted-foreground">{t("transparency")}</span>
          <span className="text-[11px] text-muted-foreground tabular-nums">{opacity}</span>
        </div>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={opacity}
          onChange={(e) => {
            const v = Number(e.target.value);
            setOpacity(v);
            onOpacityChange(v);
          }}
          className="w-full h-1.5 accent-primary cursor-pointer"
        />
      </div>
      <div className="px-2 py-1.5" onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-muted-foreground">{t("brightness")}</span>
          <span className="text-[11px] text-muted-foreground tabular-nums">{lightness}</span>
        </div>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={lightness}
          onChange={(e) => {
            const v = Number(e.target.value);
            setLightness(v);
            onLightnessChange(v);
          }}
          className="w-full h-1.5 accent-primary cursor-pointer"
        />
      </div>
    </SubMenu>
  );
}

export function ContextMenu({ position, nodeIds, edgeIds, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const nodes = useFlowStore((s) => s.nodes);
  const removeNodes = useFlowStore((s) => s.removeNodes);
  const removeEdges = useFlowStore((s) => s.removeEdges);
  const updateNodeShape = useFlowStore((s) => s.updateNodeShape);
  const updateNodeColors = useFlowStore((s) => s.updateNodeColors);
  const updateNodeBorder = useFlowStore((s) => s.updateNodeBorder);
  const updateEdgeType = useFlowStore((s) => s.updateEdgeType);
  const updateEdgeMarkers = useFlowStore((s) => s.updateEdgeMarkers);
  const updateEdgeStyle = useFlowStore((s) => s.updateEdgeStyle);
  const updateNodeColorAdjust = useFlowStore((s) => s.updateNodeColorAdjust);
  const updateNodeTextStyle = useFlowStore((s) => s.updateNodeTextStyle);
  const updateEdgeColorAdjust = useFlowStore((s) => s.updateEdgeColorAdjust);
  const alignNodes = useFlowStore((s) => s.alignNodes);
  const distributeNodes = useFlowStore((s) => s.distributeNodes);
  const reorderNodes = useFlowStore((s) => s.reorderNodes);
  const edges = useFlowStore((s) => s.edges);
  const { t } = useLocale();

  const enterComponentEditMode = useFlowStore((s) => s.enterComponentEditMode);

  // First selected node/edge data for initial slider values
  const firstNode = nodeIds.length > 0 ? nodes.find((n) => n.id === nodeIds[0]) : undefined;
  const firstNodeData = firstNode?.data;
  const firstEdge = edgeIds.length > 0 ? edges.find((e) => e.id === edgeIds[0]) : undefined;
  const firstEdgeData = firstEdge?.data;

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("contextmenu", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("contextmenu", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  // Adjust main menu position to stay within viewport
  const [adjustedPos, setAdjustedPos] = useState(position);
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = position.x;
    let y = position.y;
    if (rect.right > vw) x = Math.max(0, vw - rect.width);
    if (rect.bottom > vh) y = Math.max(0, vh - rect.height);
    if (x !== adjustedPos.x || y !== adjustedPos.y) setAdjustedPos({ x, y });
  }, [position]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasNodes = nodeIds.length > 0;
  const hasEdges = edgeIds.length > 0;
  const multipleNodes = nodeIds.length >= 2;

  return (
    <div
      ref={ref}
      className="ctx-menu"
      style={{ position: "fixed", left: adjustedPos.x, top: adjustedPos.y, zIndex: 1000 }}
    >
      {hasNodes && (
        <>
          <SubMenu label={t("changeShape")}>
            {SHAPE_ITEMS.map((s) => (
              <div
                key={s.value}
                className="ctx-item flex items-center gap-2"
                onClick={() => {
                  nodeIds.forEach((id) => updateNodeShape(id, s.value));
                  onClose();
                }}
              >
                <svg width="20" height="20" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
                  {s.icon}
                </svg>
                {t(s.key)}
              </div>
            ))}
          </SubMenu>
          <ColorSubMenu
            label={t("fillColor")}
            colors={COLORS}
            storedOpacity={firstNodeData?.fillOpacity as number | undefined}
            storedLightness={firstNodeData?.fillLightness as number | undefined}
            onSelect={(color, op, lt) => {
              nodeIds.forEach((id) => {
                updateNodeColors(id, color, undefined);
                updateNodeColorAdjust(id, "fill", op, lt);
              });
              onClose();
            }}
            onOpacityChange={(v) => nodeIds.forEach((id) => updateNodeColorAdjust(id, "fill", v, undefined))}
            onLightnessChange={(v) => nodeIds.forEach((id) => updateNodeColorAdjust(id, "fill", undefined, v))}
            t={t}
          />
          <ColorSubMenu
            label={t("borderColor")}
            colors={COLORS}
            defaultSwatchClass="bg-muted-foreground"
            storedOpacity={firstNodeData?.borderOpacity as number | undefined}
            storedLightness={firstNodeData?.borderLightness as number | undefined}
            onSelect={(color, op, lt) => {
              nodeIds.forEach((id) => {
                updateNodeColors(id, undefined, color);
                updateNodeColorAdjust(id, "border", op, lt);
              });
              onClose();
            }}
            onOpacityChange={(v) => nodeIds.forEach((id) => updateNodeColorAdjust(id, "border", v, undefined))}
            onLightnessChange={(v) => nodeIds.forEach((id) => updateNodeColorAdjust(id, "border", undefined, v))}
            t={t}
          />
          <ColorSubMenu
            label={t("textColor")}
            colors={COLORS}
            defaultSwatchClass="bg-foreground"
            storedOpacity={firstNodeData?.textOpacity as number | undefined}
            storedLightness={firstNodeData?.textLightness as number | undefined}
            onSelect={(color, op, lt) => {
              nodeIds.forEach((id) => {
                updateNodeTextStyle(id, { textColor: color ?? "" });
                updateNodeColorAdjust(id, "text", op, lt);
              });
              onClose();
            }}
            onOpacityChange={(v) => nodeIds.forEach((id) => updateNodeColorAdjust(id, "text", v, undefined))}
            onLightnessChange={(v) => nodeIds.forEach((id) => updateNodeColorAdjust(id, "text", undefined, v))}
            t={t}
          />
          <SubMenu label={t("borderWidth")}>
            {([
              { key: "thin" as const, value: 1 },
              { key: "normal" as const, value: 2 },
              { key: "thick" as const, value: 4 },
            ]).map((w) => (
              <div
                key={w.value}
                className="ctx-item flex items-center gap-2"
                onClick={() => {
                  nodeIds.forEach((id) => updateNodeBorder(id, w.value, undefined));
                  onClose();
                }}
              >
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor">
                  <rect x="2" y={7 - w.value / 2} width="16" height={w.value} fill="currentColor" />
                </svg>
                {t(w.key)}
              </div>
            ))}
          </SubMenu>
          <SubMenu label={t("borderLineStyle")}>
            {([
              { key: "solid" as const, value: "solid" as const },
              { key: "dashed" as const, value: "dashed" as const },
              { key: "dotted" as const, value: "dotted" as const },
            ]).map((s) => (
              <div
                key={s.value}
                className="ctx-item flex items-center gap-2"
                onClick={() => {
                  nodeIds.forEach((id) => updateNodeBorder(id, undefined, s.value));
                  onClose();
                }}
              >
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="2">
                  <line
                    x1="2" y1="7" x2="18" y2="7"
                    strokeDasharray={s.value === "dashed" ? "4 2" : s.value === "dotted" ? "1.5 1.5" : undefined}
                  />
                </svg>
                {t(s.key)}
              </div>
            ))}
          </SubMenu>
          <SubMenu label={t("order")}>
            <div className="ctx-item flex items-center gap-2" onClick={() => { reorderNodes(nodeIds, "front"); onClose(); }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
                <rect x="1" y="1" width="8" height="8" fill="var(--foreground)" fillOpacity="0.25" />
                <rect x="7" y="7" width="8" height="8" fill="var(--foreground)" fillOpacity="0.6" />
              </svg>
              {t("bringToFront")}
            </div>
            <div className="ctx-item flex items-center gap-2" onClick={() => { reorderNodes(nodeIds, "forward"); onClose(); }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
                <rect x="1" y="1" width="8" height="8" fill="var(--foreground)" fillOpacity="0.25" />
                <rect x="7" y="7" width="8" height="8" fill="var(--foreground)" fillOpacity="0.45" />
              </svg>
              {t("bringForward")}
            </div>
            <div className="ctx-separator" />
            <div className="ctx-item flex items-center gap-2" onClick={() => { reorderNodes(nodeIds, "backward"); onClose(); }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
                <rect x="7" y="7" width="8" height="8" fill="var(--foreground)" fillOpacity="0.45" />
                <rect x="1" y="1" width="8" height="8" fill="var(--foreground)" fillOpacity="0.25" />
              </svg>
              {t("sendBackward")}
            </div>
            <div className="ctx-item flex items-center gap-2" onClick={() => { reorderNodes(nodeIds, "back"); onClose(); }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
                <rect x="7" y="7" width="8" height="8" fill="var(--foreground)" fillOpacity="0.6" />
                <rect x="1" y="1" width="8" height="8" fill="var(--foreground)" fillOpacity="0.15" />
              </svg>
              {t("sendToBack")}
            </div>
          </SubMenu>
          {multipleNodes && (
            <>
              <div className="ctx-separator" />
              <SubMenu label={t("align")}>
                <div className="ctx-item" onClick={() => { alignNodes(nodeIds, "left"); onClose(); }}>{t("left")}</div>
                <div className="ctx-item" onClick={() => { alignNodes(nodeIds, "center"); onClose(); }}>{t("center")}</div>
                <div className="ctx-item" onClick={() => { alignNodes(nodeIds, "right"); onClose(); }}>{t("right")}</div>
                <div className="ctx-separator" />
                <div className="ctx-item" onClick={() => { alignNodes(nodeIds, "top"); onClose(); }}>{t("top")}</div>
                <div className="ctx-item" onClick={() => { alignNodes(nodeIds, "middle"); onClose(); }}>{t("middle")}</div>
                <div className="ctx-item" onClick={() => { alignNodes(nodeIds, "bottom"); onClose(); }}>{t("bottom")}</div>
              </SubMenu>
              {nodeIds.length >= 3 && (
                <SubMenu label={t("distribute")}>
                  <div className="ctx-item" onClick={() => { distributeNodes(nodeIds, "horizontal"); onClose(); }}>{t("horizontal")}</div>
                  <div className="ctx-item" onClick={() => { distributeNodes(nodeIds, "vertical"); onClose(); }}>{t("vertical")}</div>
                </SubMenu>
              )}
            </>
          )}
          {/* Component instance: edit definition */}
          {nodeIds.length === 1 && (() => {
            const nd = nodes.find((n) => n.id === nodeIds[0]);
            return nd?.type === "componentInstance" && nd.data.componentDefinitionId;
          })() && (
            <>
              <div className="ctx-separator" />
              <div
                className="ctx-item"
                onClick={() => {
                  const nd = nodes.find((n) => n.id === nodeIds[0]);
                  if (nd?.data.componentDefinitionId) {
                    enterComponentEditMode(nd.data.componentDefinitionId as string);
                  }
                  onClose();
                }}
              >
                {t("editDefinition")}
              </div>
            </>
          )}
          <div className="ctx-separator" />
          <div
            className="ctx-item text-destructive"
            onClick={() => { removeNodes(nodeIds); onClose(); }}
          >
            {nodeIds.length > 1 ? t("deleteNodes") : t("deleteNode")}
          </div>
        </>
      )}
      {hasEdges && (
        <>
          {hasNodes && <div className="ctx-separator" />}
          <SubMenu label={t("lineType")}>
            {EDGE_TYPES.map((et) => (
              <div
                key={et.value}
                className="ctx-item flex items-center gap-2"
                onClick={() => {
                  edgeIds.forEach((id) => updateEdgeType(id, et.value));
                  onClose();
                }}
              >
                {et.icon}
                {t(et.key)}
              </div>
            ))}
          </SubMenu>
          <SubMenu label={t("arrowEnd")}>
            {MARKER_STYLES.map((m) => (
              <div
                key={m.value}
                className="ctx-item flex items-center gap-2"
                onClick={() => {
                  edgeIds.forEach((id) => updateEdgeMarkers(id, undefined, m.value));
                  onClose();
                }}
              >
                {m.icon}
                {t(m.key)}
              </div>
            ))}
          </SubMenu>
          <SubMenu label={t("arrowStart")}>
            {MARKER_STYLES.map((m) => (
              <div
                key={m.value}
                className="ctx-item flex items-center gap-2"
                onClick={() => {
                  edgeIds.forEach((id) => updateEdgeMarkers(id, m.value, undefined));
                  onClose();
                }}
              >
                {m.icon}
                {t(m.key)}
              </div>
            ))}
          </SubMenu>
          <SubMenu label={t("lineWidth")}>
            {([
              { key: "thin" as const, value: 1 },
              { key: "normal" as const, value: 2 },
              { key: "thick" as const, value: 4 },
            ]).map((w) => (
              <div
                key={w.value}
                className="ctx-item flex items-center gap-2"
                onClick={() => {
                  edgeIds.forEach((id) => updateEdgeStyle(id, w.value, undefined));
                  onClose();
                }}
              >
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor">
                  <line x1="2" y1="7" x2="18" y2="7" strokeWidth={w.value} />
                </svg>
                {t(w.key)}
              </div>
            ))}
          </SubMenu>
          <SubMenu label={t("edgeLineStyle")}>
            {([
              { key: "edgeSolid" as const, value: "solid" as const, dash: undefined },
              { key: "edgeDashed" as const, value: "dashed" as const, dash: "6 3" },
              { key: "edgeDotted" as const, value: "dotted" as const, dash: "2 2" },
            ]).map((s) => (
              <div
                key={s.value}
                className="ctx-item flex items-center gap-2"
                onClick={() => {
                  edgeIds.forEach((id) => updateEdgeStyle(id, undefined, undefined, s.value));
                  onClose();
                }}
              >
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="2" y1="7" x2="18" y2="7" strokeDasharray={s.dash} />
                </svg>
                {t(s.key)}
              </div>
            ))}
          </SubMenu>
          <ColorSubMenu
            label={t("lineColor")}
            colors={COLORS}
            defaultSwatchClass="bg-muted-foreground"
            storedOpacity={firstEdgeData?.strokeOpacity as number | undefined}
            storedLightness={firstEdgeData?.strokeLightness as number | undefined}
            onSelect={(color, op, lt) => {
              edgeIds.forEach((id) => {
                updateEdgeStyle(id, undefined, color ?? "");
                updateEdgeColorAdjust(id, op, lt);
              });
              onClose();
            }}
            onOpacityChange={(v) => edgeIds.forEach((id) => updateEdgeColorAdjust(id, v, undefined))}
            onLightnessChange={(v) => edgeIds.forEach((id) => updateEdgeColorAdjust(id, undefined, v))}
            t={t}
          />
          <div className="ctx-separator" />
          <div
            className="ctx-item text-destructive"
            onClick={() => { removeEdges(edgeIds); onClose(); }}
          >
            {edgeIds.length > 1 ? t("deleteEdges") : t("deleteEdge")}
          </div>
        </>
      )}
      {!hasNodes && !hasEdges && (
        <div className="ctx-item text-muted-foreground">{t("noSelection")}</div>
      )}
    </div>
  );
}
