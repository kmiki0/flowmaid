"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { useFlowStore } from "@/store/useFlowStore";
import { useLocale } from "@/lib/i18n/useLocale";
import type { EdgeType, MarkerStyle } from "@/types/flow";
import type { TranslationKey } from "@/lib/i18n/locales";

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
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="ctx-item flex items-center justify-between">
        {label}
        <span className="ml-4 text-[10px]">▶</span>
      </div>
      {open && (
        <div className="absolute left-full top-0 ml-0.5 ctx-menu">
          {children}
        </div>
      )}
    </div>
  );
}

export function ContextMenu({ position, nodeIds, edgeIds, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const nodes = useFlowStore((s) => s.nodes);
  const removeNodes = useFlowStore((s) => s.removeNodes);
  const removeEdges = useFlowStore((s) => s.removeEdges);
  const duplicateNodes = useFlowStore((s) => s.duplicateNodes);
  const updateNodeColors = useFlowStore((s) => s.updateNodeColors);
  const updateNodeBorder = useFlowStore((s) => s.updateNodeBorder);
  const updateEdgeType = useFlowStore((s) => s.updateEdgeType);
  const updateEdgeMarkers = useFlowStore((s) => s.updateEdgeMarkers);
  const updateEdgeStyle = useFlowStore((s) => s.updateEdgeStyle);
  const alignNodes = useFlowStore((s) => s.alignNodes);
  const distributeNodes = useFlowStore((s) => s.distributeNodes);
  const reorderNodes = useFlowStore((s) => s.reorderNodes);
  const { t } = useLocale();

  const enterComponentEditMode = useFlowStore((s) => s.enterComponentEditMode);

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

  const hasNodes = nodeIds.length > 0;
  const hasEdges = edgeIds.length > 0;
  const multipleNodes = nodeIds.length >= 2;

  return (
    <div
      ref={ref}
      className="ctx-menu"
      style={{ position: "fixed", left: position.x, top: position.y, zIndex: 1000 }}
    >
      {hasNodes && (
        <>
          <div
            className="ctx-item"
            onClick={() => { duplicateNodes(nodeIds); onClose(); }}
          >
            {t("duplicate")}
          </div>
          <SubMenu label={t("fillColor")}>
            {COLORS.map((c) => (
              <div
                key={c.key}
                className="ctx-item flex items-center gap-2"
                onClick={() => {
                  nodeIds.forEach((id) => updateNodeColors(id, c.value || null, undefined));
                  onClose();
                }}
              >
                {c.value ? (
                  <span className="w-3 h-3 rounded-sm border border-border inline-block" style={{ background: c.value }} />
                ) : (
                  <span className="w-3 h-3 rounded-sm border border-border inline-block bg-background" />
                )}
                {t(c.key)}
              </div>
            ))}
          </SubMenu>
          <SubMenu label={t("borderColor")}>
            {COLORS.map((c) => (
              <div
                key={c.key}
                className="ctx-item flex items-center gap-2"
                onClick={() => {
                  nodeIds.forEach((id) => updateNodeColors(id, undefined, c.value || null));
                  onClose();
                }}
              >
                {c.value ? (
                  <span className="w-3 h-3 rounded-sm border-2 inline-block" style={{ borderColor: c.value }} />
                ) : (
                  <span className="w-3 h-3 rounded-sm border-2 border-muted-foreground inline-block" />
                )}
                {t(c.key)}
              </div>
            ))}
          </SubMenu>
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
          <SubMenu label={t("lineColor")}>
            {COLORS.map((c) => (
              <div
                key={c.key}
                className="ctx-item flex items-center gap-2"
                onClick={() => {
                  edgeIds.forEach((id) => updateEdgeStyle(id, undefined, c.value));
                  onClose();
                }}
              >
                {c.value ? (
                  <span className="w-3 h-3 rounded-sm border border-border inline-block" style={{ background: c.value }} />
                ) : (
                  <span className="w-3 h-3 rounded-sm border border-border inline-block bg-muted-foreground" />
                )}
                {t(c.key)}
              </div>
            ))}
          </SubMenu>
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
