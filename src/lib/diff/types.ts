import type { FlowmaidNodeLayout, FlowmaidEdgeLayout } from "@/lib/flowmaid/schema";
import type { ComponentDefinition } from "@/types/flow";

export type DiffKind = "added" | "deleted" | "modified" | "unchanged";

export interface NodeDiff {
  kind: DiffKind;
  nodeId: string;
  baseNode?: FlowmaidNodeLayout;
  compareNode?: FlowmaidNodeLayout;
  /** Names of fields that differ between base and compare */
  changedFields: string[];
}

export interface EdgeDiff {
  kind: DiffKind;
  /** The edge key in the layout (e.g. "A-B-bottom-source-top-target") */
  edgeKey: string;
  baseEdge?: FlowmaidEdgeLayout;
  compareEdge?: FlowmaidEdgeLayout;
  changedFields: string[];
}

export interface ComponentDefDiff {
  kind: DiffKind;
  defId: string;
  baseDef?: ComponentDefinition;
  compareDef?: ComponentDefinition;
  changedFields: string[];
}

export interface DiffResult {
  nodeDiffs: NodeDiff[];
  edgeDiffs: EdgeDiff[];
  componentDefDiffs: ComponentDefDiff[];
}

export interface DiffFilters {
  added: boolean;
  deleted: boolean;
  modified: boolean;
}

export const DEFAULT_DIFF_FILTERS: DiffFilters = {
  added: true,
  deleted: true,
  modified: true,
};

/** Duration of flash highlight animation (ms) — shared between DiffCanvas and DiffGlowOverlay */
export const DIFF_FLASH_DURATION_MS = 1200;

/** Check whether a node diff should be highlighted on the given side */
export function shouldHighlightOnSide(
  kind: DiffKind,
  filters: DiffFilters,
  side: "base" | "compare",
): boolean {
  if (kind === "unchanged") return false;
  if (kind === "added" && !filters.added) return false;
  if (kind === "deleted" && !filters.deleted) return false;
  if (kind === "modified" && !filters.modified) return false;
  // Deleted → base only, added/modified → compare only
  if (side === "base" && (kind === "added" || kind === "modified")) return false;
  if (side === "compare" && kind === "deleted") return false;
  return true;
}