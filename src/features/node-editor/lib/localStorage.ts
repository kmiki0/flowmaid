import { NODE_EDITOR_STORAGE_KEY } from "./constants";
import type { NodeEditorNode, NodeEditorEdge, NodeEditorPage } from "../store/types";
import type { NodeEditorSubMode } from "../types";

interface SavedNodeEditorState {
  nodes: NodeEditorNode[];
  edges: NodeEditorEdge[];
  subMode: NodeEditorSubMode;
  nextIdCounter: number;
  /** v2以降: ページ一覧（旧データには存在しない） */
  pages?: NodeEditorPage[];
  activePageId?: string;
}

export function saveNodeEditorState(state: SavedNodeEditorState): void {
  try {
    localStorage.setItem(NODE_EDITOR_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export function loadNodeEditorState(): SavedNodeEditorState | null {
  try {
    const data = localStorage.getItem(NODE_EDITOR_STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data) as SavedNodeEditorState;
  } catch {
    return null;
  }
}
