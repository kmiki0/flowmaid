"use client";

import { useCallback } from "react";
import { useStore } from "zustand";
import { useFlowStore } from "@/store/useFlowStore";

export function useUndoRedo() {
  const undo = useCallback(() => {
    useFlowStore.temporal.getState().undo();
  }, []);

  const redo = useCallback(() => {
    useFlowStore.temporal.getState().redo();
  }, []);

  const canUndo = useStore(useFlowStore.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useFlowStore.temporal, (s) => s.futureStates.length > 0);

  return { undo, redo, canUndo, canRedo };
}
