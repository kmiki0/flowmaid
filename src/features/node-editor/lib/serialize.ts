import type { NodeEditorNode, NodeEditorEdge, NodeEditorPage } from "../store/types";
import type { NodeEditorSubMode } from "../types";

/** v1: 単一ページ（nodes/edges直下） / v2: pages配列 */
interface NodeEditorSaveData {
  version: number;
  subMode: NodeEditorSubMode;
  // v1
  nodes?: NodeEditorNode[];
  edges?: NodeEditorEdge[];
  // v2
  pages?: NodeEditorPage[];
  activePageId?: string;
}

const CURRENT_VERSION = 2;

function stripTransient(nodes: NodeEditorNode[], edges: NodeEditorEdge[]) {
  return {
    nodes: nodes.map((n) => ({
      ...n,
      data: { ...n.data, isNew: undefined, isDeleting: undefined },
      selected: undefined,
    })),
    edges: edges.map((e) => ({
      ...e,
      selected: undefined,
    })),
  };
}

export function serializeNodeEditor(
  pages: NodeEditorPage[],
  activePageId: string,
  subMode: NodeEditorSubMode
): string {
  const data: NodeEditorSaveData = {
    version: CURRENT_VERSION,
    subMode,
    pages: pages.map((p) => ({ ...p, ...stripTransient(p.nodes, p.edges) })),
    activePageId,
  };
  return JSON.stringify(data, null, 2);
}

/** 単一ページだけをエクスポート（v2形式、pages配列に1要素） */
export function serializeNodeEditorSinglePage(
  page: NodeEditorPage,
  subMode: NodeEditorSubMode
): string {
  const data: NodeEditorSaveData = {
    version: CURRENT_VERSION,
    subMode,
    pages: [{ ...page, ...stripTransient(page.nodes, page.edges) }],
    activePageId: page.id,
  };
  return JSON.stringify(data, null, 2);
}

function computeNextIdCounter(nodes: NodeEditorNode[]): number {
  let maxCounter = 0;
  for (const n of nodes) {
    let counter = 0;
    for (let i = 0; i < n.id.length; i++) {
      counter = counter * 26 + (n.id.charCodeAt(i) - 64);
    }
    maxCounter = Math.max(maxCounter, counter);
  }
  return maxCounter;
}

export interface NodeEditorImportResult {
  /** 単一ページぶんの内容（開いているページへのインポート用） */
  nodes: NodeEditorNode[];
  edges: NodeEditorEdge[];
  nextIdCounter: number;
  subMode?: NodeEditorSubMode;
  /** 複数ページを含むファイルの場合のみセット（ドキュメント全体置換用） */
  pages?: NodeEditorPage[];
  activePageId?: string;
}

export function deserializeNodeEditor(content: string): NodeEditorImportResult {
  const data = JSON.parse(content) as NodeEditorSaveData;

  // v2: pages配列
  if (data.pages && data.pages.length > 0) {
    const activeId =
      data.activePageId && data.pages.some((p) => p.id === data.activePageId)
        ? data.activePageId
        : data.pages[0].id;
    const active = data.pages.find((p) => p.id === activeId)!;
    return {
      nodes: active.nodes,
      edges: active.edges,
      nextIdCounter: active.nextIdCounter ?? computeNextIdCounter(active.nodes),
      subMode: data.subMode,
      ...(data.pages.length > 1 ? { pages: data.pages, activePageId: activeId } : {}),
    };
  }

  // v1: 単一ページ
  const nodes = data.nodes ?? [];
  return {
    nodes,
    edges: data.edges ?? [],
    nextIdCounter: computeNextIdCounter(nodes),
    subMode: data.subMode,
  };
}
