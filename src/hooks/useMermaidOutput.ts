"use client";

import { useMemo, useSyncExternalStore, useRef, useCallback } from "react";
import { useFlowStore } from "@/store/useFlowStore";
import { generateMermaid } from "@/lib/mermaid/generate";
import { serialize } from "@/lib/flowmaid/serialize";
import type { FlowNode, FlowEdge } from "@/store/types";
import type { FlowDirection, ComponentDefinition } from "@/types/flow";

const DEBOUNCE_MS = 200;

interface Snapshot {
  nodes: FlowNode[];
  edges: FlowEdge[];
  direction: FlowDirection;
  componentDefinitions: ComponentDefinition[];
}

// Module-level debounced store subscription
let currentSnapshot: Snapshot = {
  nodes: [],
  edges: [],
  direction: "TD",
  componentDefinitions: [],
};
let listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

function getSnapshot() {
  return currentSnapshot;
}

function subscribe(cb: () => void) {
  if (listeners.size === 0) {
    // Initialize with current store state
    const s = useFlowStore.getState();
    currentSnapshot = {
      nodes: s.nodes,
      edges: s.edges,
      direction: s.direction,
      componentDefinitions: s.componentDefinitions,
    };

    // Subscribe to store changes with debounce
    var unsub = useFlowStore.subscribe((state) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const next: Snapshot = {
          nodes: state.nodes,
          edges: state.edges,
          direction: state.direction,
          componentDefinitions: state.componentDefinitions,
        };
        // Only notify if something actually changed
        if (
          next.nodes !== currentSnapshot.nodes ||
          next.edges !== currentSnapshot.edges ||
          next.direction !== currentSnapshot.direction ||
          next.componentDefinitions !== currentSnapshot.componentDefinitions
        ) {
          currentSnapshot = next;
          listeners.forEach((l) => l());
        }
      }, DEBOUNCE_MS);
    });
  }
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      clearTimeout(timer);
      unsub?.();
    }
  };
}

export function useMermaidOutput() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const mermaid = useMemo(
    () => generateMermaid(snap.nodes, snap.edges, snap.direction, snap.componentDefinitions),
    [snap.nodes, snap.edges, snap.direction, snap.componentDefinitions]
  );

  const full = useMemo(
    () => serialize(snap.nodes, snap.edges, snap.direction, snap.componentDefinitions),
    [snap.nodes, snap.edges, snap.direction, snap.componentDefinitions]
  );

  return { mermaid, full };
}
