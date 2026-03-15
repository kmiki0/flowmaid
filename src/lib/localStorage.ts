import { STORAGE_KEY } from "./constants";
import type { FlowNode, FlowEdge } from "@/store/types";
import type { FlowDirection, ComponentDefinition } from "@/types/flow";

interface SavedState {
  nodes: FlowNode[];
  edges: FlowEdge[];
  direction: FlowDirection;
  nextIdCounter: number;
  componentDefinitions?: ComponentDefinition[];
}

export function saveState(state: SavedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export function loadState(): SavedState | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data) as SavedState;
  } catch {
    return null;
  }
}
