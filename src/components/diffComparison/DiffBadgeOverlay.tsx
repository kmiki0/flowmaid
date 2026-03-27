"use client";

import { useMemo } from "react";
import { useViewport } from "@xyflow/react";
import type { DiffResult, DiffFilters, DiffKind } from "@/lib/diff/types";
import { shouldHighlightOnSide } from "@/lib/diff/types";
import type { FlowmaidLayout } from "@/lib/flowmaid/schema";
import { DIFF_COLORS } from "@/lib/diff/buildDiffNodes";
import { useLocale } from "@/lib/i18n/useLocale";
import type { TranslationKey } from "@/lib/i18n/locales";

/** Badge size constants */
const BADGE_FONT_SIZE = 11;
/** Horizontal offset from node right edge (px, screen space) */
const BADGE_OFFSET_X = -32;
/** Vertical offset from node top edge (px, screen space — negative = above) */
const BADGE_OFFSET_Y = -14;

interface DiffBadgeOverlayProps {
  diffResult: DiffResult;
  filters: DiffFilters;
  layout: FlowmaidLayout;
  side: "base" | "compare";
}

const KIND_LABEL_KEYS: Record<Exclude<DiffKind, "unchanged">, TranslationKey> = {
  added: "diffKindAdded",
  deleted: "diffKindDeleted",
  modified: "diffKindModified",
};

export function DiffBadgeOverlay({ diffResult, filters, layout, side }: DiffBadgeOverlayProps) {
  const { x, y, zoom } = useViewport();
  const { t } = useLocale();

  // Memoize badge data — only recompute when diff/filters/layout/side change
  const badgeItems = useMemo(() => {
    const result: { nodeId: string; kind: Exclude<DiffKind, "unchanged">; nodeW: number; px: number; py: number }[] = [];
    for (const nd of diffResult.nodeDiffs) {
      if (!shouldHighlightOnSide(nd.kind, filters, side)) continue;
      const nodeLayout = layout.nodes[nd.nodeId];
      if (!nodeLayout) continue;
      result.push({
        nodeId: nd.nodeId,
        kind: nd.kind as Exclude<DiffKind, "unchanged">,
        nodeW: nodeLayout.size?.width ?? 150,
        px: nodeLayout.position.x,
        py: nodeLayout.position.y,
      });
    }
    return result;
  }, [diffResult, filters, layout, side]);

  if (badgeItems.length === 0) return null;

  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 9999 }}>
      {badgeItems.map((badge) => {
        const color = DIFF_COLORS[badge.kind];
        const screenX = (badge.px + badge.nodeW) * zoom + x + BADGE_OFFSET_X;
        const screenY = badge.py * zoom + y + BADGE_OFFSET_Y;
        return (
          <div
            key={badge.nodeId}
            style={{
              position: "absolute",
              left: screenX,
              top: screenY,
              fontSize: BADGE_FONT_SIZE,
              fontWeight: 700,
              color: "#fff",
              backgroundColor: color,
              borderRadius: 4,
              padding: "1px 5px",
              whiteSpace: "nowrap",
              boxShadow: `0 0 8px ${color}`,
              lineHeight: 1.4,
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            {t(KIND_LABEL_KEYS[badge.kind]).toUpperCase()}
          </div>
        );
      })}
    </div>
  );
}
