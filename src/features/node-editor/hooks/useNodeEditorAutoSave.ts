"use client";

import { useEffect, useRef } from "react";
import { useNodeEditorStore, composePages } from "../store/useNodeEditorStore";
import { saveNodeEditorState, loadNodeEditorState } from "../lib/localStorage";
import { NODE_EDITOR_AUTOSAVE_DEBOUNCE_MS } from "../lib/constants";

export function useNodeEditorAutoSave() {
  const initialized = useRef(false);

  // Load state on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const saved = loadNodeEditorState();
    if (saved && ((saved.pages?.length ?? 0) > 0 || saved.nodes.length > 0)) {
      useNodeEditorStore.getState().loadState(saved);
    }
  }, []);

  // Subscribe to store changes and debounce save
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const unsub = useNodeEditorStore.subscribe((state) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        saveNodeEditorState({
          nodes: state.nodes,
          edges: state.edges,
          subMode: state.subMode,
          nextIdCounter: state.nextIdCounter,
          pages: composePages(state),
          activePageId: state.activePageId,
        });
      }, NODE_EDITOR_AUTOSAVE_DEBOUNCE_MS);
    });

    return () => {
      clearTimeout(timeoutId);
      unsub();
    };
  }, []);
}
