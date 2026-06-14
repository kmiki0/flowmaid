"use client";

import { useEffect, useRef } from "react";
import { useFlowStore, composeFlowPages } from "@/store/useFlowStore";
import { saveState, loadState } from "@/lib/localStorage";
import { AUTOSAVE_DEBOUNCE_MS } from "@/lib/constants";

export function useAutoSave() {
  const initialized = useRef(false);

  // Load state on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const saved = loadState();
    const hasContent =
      saved &&
      (saved.nodes.length > 0 || saved.pages?.some((p) => p.nodes.length > 0));
    if (saved && hasContent) {
      useFlowStore.getState().loadState(saved);
    }
  }, []);

  // Subscribe to store changes and debounce save
  // Skip saving while in component editing mode
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const unsub = useFlowStore.subscribe((state) => {
      // Don't auto-save during component editing mode
      if (state.editingComponentId) return;

      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        saveState({
          nodes: state.nodes,
          edges: state.edges,
          direction: state.direction,
          nextIdCounter: state.nextIdCounter,
          componentDefinitions: state.componentDefinitions,
          pages: composeFlowPages(state),
          activePageId: state.activePageId,
        });
      }, AUTOSAVE_DEBOUNCE_MS);
    });

    return () => {
      clearTimeout(timeoutId);
      unsub();
    };
  }, []);
}
