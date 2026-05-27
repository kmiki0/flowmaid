"use client";

import { useCallback } from "react";
import { useStore } from "zustand";
import { useNodeEditorStore } from "../store/useNodeEditorStore";

export function useNodeEditorUndoRedo() {
  const undo = useCallback(() => {
    useNodeEditorStore.temporal.getState().undo();
  }, []);

  const redo = useCallback(() => {
    useNodeEditorStore.temporal.getState().redo();
  }, []);

  const canUndo = useStore(useNodeEditorStore.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useNodeEditorStore.temporal, (s) => s.futureStates.length > 0);

  return { undo, redo, canUndo, canRedo };
}
