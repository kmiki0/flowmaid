"use client";

import { useCallback, useRef, useEffect } from "react";
import { useStoreApi } from "@xyflow/react";
import { getNodesInside } from "@xyflow/system";
import { perfStart, perfEnd, perfCount } from "@/lib/perf";
import type {
  Node,
  Edge,
  NodeMouseHandler,
  EdgeMouseHandler,
  NodeChange,
  EdgeChange,
} from "@xyflow/react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EdgeInfo = { id: string; source: string; target: string; data?: { isBridgeEdge?: boolean } };

export interface UseCtrlSelectionOptions {
  /** Read current selected IDs */
  getSelectedIds: () => Set<string>;
  /** Apply new selected IDs */
  setSelectedIds: (ids: Set<string>) => void;

  /** Provide edges — used for drag‐selection "both‐endpoints" rule and Ctrl+A */
  getEdges?: () => readonly EdgeInfo[];

  /** Return all selectable IDs for Ctrl+A. Omit to skip Ctrl+A handling. */
  getAllSelectableIds?: () => Set<string>;

  /** Currently highlighted ID (BulkEdit: include in starting set on Ctrl+click) */
  highlightId?: string | null;

  /** Called on normal (non-Ctrl) node click. If omitted, ReactFlow default applies. */
  onNormalNodeClick?: (nodeId: string) => void;
  /** Called on normal (non-Ctrl) edge click. If omitted, ReactFlow default applies. */
  onNormalEdgeClick?: (edgeId: string) => void;
  /** Called on pane click. If omitted, ReactFlow default applies. */
  onNormalPaneClick?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers (module-level, no allocation per render)
// ---------------------------------------------------------------------------

/** Select edges whose BOTH source and target are in `ids`; deselect the rest. */
function syncEdgeSelection(ids: Set<string>, edges: readonly EdgeInfo[]) {
  for (const e of edges) {
    if (e.data?.isBridgeEdge) continue;
    if (ids.has(e.source) && ids.has(e.target)) ids.add(e.id);
    else ids.delete(e.id);
  }
}

/** Returns true if two Sets contain the same elements. */
function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) {
    if (!b.has(id)) return false;
  }
  return true;
}

/** Build a Set of edge IDs for filtering node IDs from a mixed set. */
function buildEdgeIdSet(edges: readonly { id: string }[]): Set<string> {
  const s = new Set<string>();
  for (const e of edges) s.add(e.id);
  return s;
}

/** Extract only node IDs from a mixed selection set. */
function extractNodeIds(ids: Set<string>, edgeIdSet: Set<string>): Set<string> {
  const result = new Set<string>();
  for (const id of ids) {
    if (!edgeIdSet.has(id)) result.add(id);
  }
  return result;
}

/** Symmetric difference (XOR) of two sets. */
function symmetricDifference(a: Set<string>, b: Set<string>): Set<string> {
  const result = new Set<string>();
  for (const id of a) { if (!b.has(id)) result.add(id); }
  for (const id of b) { if (!a.has(id)) result.add(id); }
  return result;
}

/** Apply `setSelectedIds` only when the selection actually changed. */
function applyIfChanged(
  next: Set<string>,
  getSelectedIds: () => Set<string>,
  setSelectedIds: (ids: Set<string>) => void,
) {
  if (!setsEqual(next, getSelectedIds())) {
    setSelectedIds(next);
  }
}

/**
 * Sync React Flow's internal nodeLookup/edgeLookup to match our selection state.
 *
 * React Flow's `getSelectionChanges(items, ids, mutateItem=true)` directly mutates
 * `internalNode.selected` in nodeLookup. When we block those changes (e.g. blocking
 * resetSelectedElements during Ctrl+drag), the internal state diverges from our props.
 *
 * On re-render, `adoptUserNodes` with `checkEquality: true` reuses internal nodes
 * when the userNode reference hasn't changed — preserving the stale `.selected` value.
 * This function repairs that divergence by directly setting `.selected` to match our state.
 */
function syncInternalSelection(
  ids: Set<string>,
  rfStore: { getState: () => { nodeLookup: Map<string, { id: string; selected?: boolean }>; edgeLookup: Map<string, { id: string; selected?: boolean }> } },
) {
  const { nodeLookup, edgeLookup } = rfStore.getState();
  for (const [id, node] of nodeLookup) {
    node.selected = ids.has(id);
  }
  for (const [id, edge] of edgeLookup) {
    edge.selected = ids.has(id);
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCtrlSelection(options: UseCtrlSelectionOptions) {
  const optsRef = useRef(options);
  optsRef.current = options;
  const rfStore = useStoreApi();

  // ---- Refs ----
  const isMultiSelectKeyHeld = useRef(false);
  const isDragging = useRef(false);
  const dragStartIds = useRef<Set<string>>(new Set());
  const highlightIdRef = useRef(options.highlightId);
  highlightIdRef.current = options.highlightId;

  // ---- Ctrl/Meta key tracking + Ctrl+A ----

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") {
        isMultiSelectKeyHeld.current = true;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        const o = optsRef.current;
        if (!o.getAllSelectableIds) return;
        e.preventDefault();
        o.setSelectedIds(o.getAllSelectableIds());
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") {
        isMultiSelectKeyHeld.current = false;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // ---- Selection drag lifecycle ----

  const ctrlDragUnsubRef = useRef<(() => void) | null>(null);

  /** Compute and apply XOR selection from current userSelectionRect. */
  const computeCtrlDragSelection = useCallback(() => {
    const o = optsRef.current;
    const edges = o.getEdges?.() ?? [];
    const { nodeLookup, transform, userSelectionRect } = rfStore.getState();
    const nodeBox = new Set<string>();
    if (userSelectionRect) {
      const nodesInBox = getNodesInside(nodeLookup, userSelectionRect, transform, true, true);
      for (const node of nodesInBox) nodeBox.add(node.id);
    }
    const edgeIdSet = buildEdgeIdSet(edges);
    const dragStartNodes = extractNodeIds(dragStartIds.current, edgeIdSet);
    const xorNodes = symmetricDifference(dragStartNodes, nodeBox);
    const next = new Set(xorNodes);
    syncEdgeSelection(next, edges);
    applyIfChanged(next, o.getSelectedIds, o.setSelectedIds);
    syncInternalSelection(next, rfStore);
  }, []);

  const handleSelectionStart = useCallback(() => {
    isDragging.current = true;
    const o = optsRef.current;
    const start = new Set(o.getSelectedIds());
    if (start.size === 0 && highlightIdRef.current) {
      start.add(highlightIdRef.current);
    }
    dragStartIds.current = start;

    // When Ctrl is held, subscribe to userSelectionRect changes to compute
    // XOR selection independently of React Flow's areSetsEqual optimization.
    if (isMultiSelectKeyHeld.current) {
      ctrlDragUnsubRef.current?.();
      ctrlDragUnsubRef.current = rfStore.subscribe(
        (state) => {
          if (!isDragging.current || !isMultiSelectKeyHeld.current) return;
          if (state.userSelectionRect) {
            computeCtrlDragSelection();
          }
        },
      );
    }
  }, [computeCtrlDragSelection]);

  const handleSelectionEnd = useCallback(() => {
    isDragging.current = false;
    ctrlDragUnsubRef.current?.();
    ctrlDragUnsubRef.current = null;
  }, []);

  // ---- processNodesChanges ----
  // Intercepts select-type changes, applies custom logic, returns the rest.

  const processNodesChanges = useCallback(
    <N extends Node = Node>(changes: NodeChange<N>[]): NodeChange<N>[] => {
      const t = perfStart("processNodesChanges");
      perfCount("processNodesChanges");
      // Fast path: no select changes → passthrough
      let hasSelect = false;
      for (const c of changes) { if (c.type === "select") { hasSelect = true; break; } }
      if (!hasSelect) { perfEnd("processNodesChanges", t); return changes; }

      const selects: NodeChange<N>[] = [];
      const rest: NodeChange<N>[] = [];
      for (const c of changes) {
        if (c.type === "select") selects.push(c);
        else rest.push(c);
      }

      const o = optsRef.current;
      const edges = o.getEdges?.() ?? [];

      if (isMultiSelectKeyHeld.current && isDragging.current) {
        // ── CTRL+DRAG (XOR) ──
        // Compute box contents directly using getNodesInside + userSelectionRect.
        // This bypasses React Flow Pane's areSetsEqual optimization that can skip
        // getSelectionChanges (and thus processNodesChanges) when the box contents
        // match the previous drag's final state.
        const { nodeLookup, transform, userSelectionRect } = rfStore.getState();
        const nodeBox = new Set<string>();
        if (userSelectionRect) {
          const nodesInBox = getNodesInside(nodeLookup, userSelectionRect, transform, true, true);
          for (const node of nodesInBox) nodeBox.add(node.id);
        }

        // XOR with drag-start node IDs
        const edgeIdSet = buildEdgeIdSet(edges);
        const dragStartNodes = extractNodeIds(dragStartIds.current, edgeIdSet);
        const xorNodes = symmetricDifference(dragStartNodes, nodeBox);

        // Add edges whose both endpoints are in the result
        const next = new Set(xorNodes);
        syncEdgeSelection(next, edges);
        applyIfChanged(next, o.getSelectedIds, o.setSelectedIds);
        syncInternalSelection(next, rfStore);

      } else if (isMultiSelectKeyHeld.current) {
        // ── CTRL held, NOT dragging ──
        // Two possible sources:
        //   a) resetSelectedElements() preparing for a drag → userSelectionRect is set → BLOCK
        //   b) addSelectedNodes/unselectNodesAndEdges from Ctrl+click → no rect → ALLOW
        const { userSelectionRect } = rfStore.getState();
        if (userSelectionRect) {
          // BLOCK — resetSelectedElements before drag start.
          // Do NOT repair nodeLookup here: getSelectionChanges for the drag box
          // needs to see the reset state to correctly detect all changes.
          // nodeLookup will be repaired by syncInternalSelection in CTRL+DRAG branch.
        } else {
          // Ctrl+click — process changes normally with highlightId inclusion
          const next = new Set(o.getSelectedIds());
          if (next.size === 0 && highlightIdRef.current) {
            next.add(highlightIdRef.current);
          }
          for (const c of selects) {
            if (c.type === "select") {
              if (c.selected) next.add(c.id); else next.delete(c.id);
            }
          }
          applyIfChanged(next, o.getSelectedIds, o.setSelectedIds);
          syncInternalSelection(next, rfStore);
        }

      } else {
        // ── NORMAL ──
        const next = new Set(o.getSelectedIds());
        for (const c of selects) {
          if (c.type === "select") {
            if (c.selected) next.add(c.id); else next.delete(c.id);
          }
        }
        // During drag, auto-include edges whose both endpoints are selected
        if (isDragging.current && edges.length > 0) {
          syncEdgeSelection(next, edges);
        }
        applyIfChanged(next, o.getSelectedIds, o.setSelectedIds);
      }

      perfEnd("processNodesChanges", t);
      return rest;
    },
    [],
  );

  // ---- processEdgesChanges ----

  const processEdgesChanges = useCallback(
    <E extends Edge = Edge>(changes: EdgeChange<E>[]): EdgeChange<E>[] => {
      let hasSelect = false;
      for (const c of changes) { if (c.type === "select") { hasSelect = true; break; } }
      if (!hasSelect) return changes;

      const rest: EdgeChange<E>[] = [];
      for (const c of changes) { if (c.type !== "select") rest.push(c); }

      // During drag, edge selection is fully managed by processNodesChanges.
      if (isDragging.current) return rest;

      // When Ctrl is held (non-drag): block only resetSelectedElements (userSelectionRect set).
      // Allow Ctrl+click edge changes through.
      if (isMultiSelectKeyHeld.current) {
        const { userSelectionRect } = rfStore.getState();
        if (userSelectionRect) {
          // BLOCK — resetSelectedElements before drag start.
          // Do NOT repair here (same reason as processNodesChanges BLOCK branch).
          return rest;
        }
      }

      // Non-drag, non-ctrl or Ctrl+click: apply ReactFlow's edge selection changes.
      const o = optsRef.current;
      const next = new Set(o.getSelectedIds());
      for (const c of changes) {
        if (c.type === "select") {
          if (c.selected) next.add(c.id);
          else next.delete(c.id);
        }
      }
      applyIfChanged(next, o.getSelectedIds, o.setSelectedIds);
      return rest;
    },
    [],
  );

  // ---- Click handlers ----

  // Ctrl+click is handled by React Flow internally (via multiSelectionKeyCode).
  // These handlers only need to handle non-Ctrl clicks for BulkEditCanvas
  // (which provides onNormalNodeClick/onNormalEdgeClick).
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      const o = optsRef.current;
      if (o.onNormalNodeClick && !(_event.ctrlKey || _event.metaKey)) {
        const empty = new Set<string>();
        o.setSelectedIds(empty);
        syncInternalSelection(empty, rfStore);
        o.onNormalNodeClick(node.id);
      }
    },
    [],
  );

  const handleEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      const o = optsRef.current;
      if (o.onNormalEdgeClick && !(_event.ctrlKey || _event.metaKey)) {
        const empty = new Set<string>();
        o.setSelectedIds(empty);
        syncInternalSelection(empty, rfStore);
        o.onNormalEdgeClick(edge.id);
      }
    },
    [],
  );

  const handlePaneClick = useCallback(() => {
    const o = optsRef.current;
    const empty = new Set<string>();
    o.setSelectedIds(empty);
    syncInternalSelection(empty, rfStore);
    o.onNormalPaneClick?.();
  }, []);

  return {
    isMultiSelectKeyHeld,
    handleNodeClick,
    handleEdgeClick,
    handlePaneClick,
    handleSelectionStart,
    handleSelectionEnd,
    processNodesChanges,
    processEdgesChanges,
  };
}
