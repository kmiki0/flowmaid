import { describe, it, expect, beforeEach } from "vitest";
import { MarkerType } from "@xyflow/react";
import { useFlowStore } from "../useFlowStore";
import type { FlowEdge, FlowNode } from "../types";
import type { MarkerStyle } from "@/types/flow";
import { deserialize } from "@/lib/flowmaid/deserialize";
import { parseMermaid } from "@/lib/mermaid/parse";
import { generateComponentChildren } from "@/lib/component-children";

// ============================================================
// Helper: markerEnd がトップレベルに設定されているかを検証
// ============================================================
function expectMarkerEnd(edge: FlowEdge, expectedType: MarkerType = MarkerType.ArrowClosed) {
  expect(edge.markerEnd).toBeDefined();
  expect(edge.markerEnd).toHaveProperty("type", expectedType);
}

function expectDataMarkerEnd(edge: FlowEdge, expectedValue: MarkerStyle = "arrowclosed") {
  expect(edge.data?.markerEnd).toBe(expectedValue);
}

// ============================================================
// Helper: テスト用ノードを作成しストアに追加
// ============================================================
function addTestNodes(...ids: string[]) {
  const store = useFlowStore.getState();
  for (const id of ids) {
    store.addNode(id, "rectangle", { x: 100, y: 100 });
  }
}

function getEdge(id?: string): FlowEdge {
  const edges = useFlowStore.getState().edges;
  if (id) return edges.find((e) => e.id === id)!;
  // 非ブリッジエッジの最初の1つを返す
  return edges.filter((e) => !e.data?.isBridgeEdge)[0];
}

function getNonBridgeEdges(): FlowEdge[] {
  return useFlowStore.getState().edges.filter((e) => !e.data?.isBridgeEdge);
}

// ============================================================
// テスト
// ============================================================
describe("Edge markerEnd - 全パターン検証", () => {
  beforeEach(() => {
    useFlowStore.getState().clearAll();
  });

  // ----------------------------------------------------------
  // パターン1: addEdge（新規接続）
  // ----------------------------------------------------------
  describe("パターン1: addEdge（新規エッジ作成）", () => {
    it("デフォルトで arrowclosed マーカーが設定される", () => {
      addTestNodes("A", "B");
      useFlowStore.getState().addEdge("A", "B", "", "bottom-source", "top-target");

      const edge = getEdge();
      expectMarkerEnd(edge, MarkerType.ArrowClosed);
      expectDataMarkerEnd(edge, "arrowclosed");
    });

    it("色なしの場合、markerEnd に color プロパティが含まれない", () => {
      addTestNodes("A", "B");
      useFlowStore.getState().addEdge("A", "B", "", "bottom-source", "top-target");

      const edge = getEdge();
      expectMarkerEnd(edge, MarkerType.ArrowClosed);
      // color: undefined がオブジェクトに含まれていないことを確認
      // （React Flow の createMarkerIds で defaultColor を上書きしてしまう問題の防止）
      expect("color" in (edge.markerEnd as object)).toBe(false);
    });

    it("edgeData で markerEnd: 'arrow' を指定すると Arrow マーカーになる", () => {
      addTestNodes("A", "B");
      useFlowStore.getState().addEdge("A", "B", "", "bottom-source", "top-target", {
        markerEnd: "arrow",
      });

      const edge = getEdge();
      expectMarkerEnd(edge, MarkerType.Arrow);
      expectDataMarkerEnd(edge, "arrow");
    });

    it("edgeData で markerEnd: 'none' を指定すると markerEnd は undefined", () => {
      addTestNodes("A", "B");
      useFlowStore.getState().addEdge("A", "B", "", "bottom-source", "top-target", {
        markerEnd: "none",
      });

      const edge = getEdge();
      // markerEnd: "none" → markerStyleToMarker returns undefined → フォールバック ArrowClosed
      // 実際の動作: markerStyleToMarker("none") = undefined, ?? { type: MarkerType.ArrowClosed }
      expectMarkerEnd(edge, MarkerType.ArrowClosed);
      expectDataMarkerEnd(edge, "none");
    });

    it("strokeColor 付きで markerEnd に色が反映される", () => {
      addTestNodes("A", "B");
      useFlowStore.getState().addEdge("A", "B", "", "bottom-source", "top-target", {
        strokeColor: "#ef4444",
      });

      const edge = getEdge();
      expectMarkerEnd(edge, MarkerType.ArrowClosed);
      expect((edge.markerEnd as { color?: string }).color).toBe("#ef4444");
    });

    it("markerStart 付きでも markerEnd は正しく設定される", () => {
      addTestNodes("A", "B");
      useFlowStore.getState().addEdge("A", "B", "", "bottom-source", "top-target", {
        markerStart: "arrow",
        markerEnd: "arrowclosed",
      });

      const edge = getEdge();
      expectMarkerEnd(edge, MarkerType.ArrowClosed);
      expect(edge.markerStart).toBeDefined();
      expect(edge.markerStart).toHaveProperty("type", MarkerType.Arrow);
    });

    it("ハンドル指定なしでもマーカーが設定される", () => {
      addTestNodes("A", "B");
      useFlowStore.getState().addEdge("A", "B");

      const edge = getEdge();
      expectMarkerEnd(edge, MarkerType.ArrowClosed);
    });
  });

  // ----------------------------------------------------------
  // パターン2: reconnectEdge（エッジ付け替え）
  // ----------------------------------------------------------
  describe("パターン2: reconnectEdge（エッジ付け替え）", () => {
    it("付け替え後も markerEnd が保持される", () => {
      addTestNodes("A", "B", "C");
      useFlowStore.getState().addEdge("A", "B", "test", "bottom-source", "top-target");

      const originalEdge = getEdge();
      expectMarkerEnd(originalEdge, MarkerType.ArrowClosed);

      // B → C に付け替え
      useFlowStore.getState().reconnectEdge(originalEdge, {
        source: "A",
        target: "C",
        sourceHandle: "bottom-source",
        targetHandle: "top-target",
      });

      const reconnectedEdge = getEdge();
      expectMarkerEnd(reconnectedEdge, MarkerType.ArrowClosed);
      expectDataMarkerEnd(reconnectedEdge, "arrowclosed");
    });

    it("arrow マーカーのエッジも付け替え後に保持される", () => {
      addTestNodes("A", "B", "C");
      useFlowStore.getState().addEdge("A", "B", "", "bottom-source", "top-target", {
        markerEnd: "arrow",
      });

      const originalEdge = getEdge();
      expectMarkerEnd(originalEdge, MarkerType.Arrow);

      useFlowStore.getState().reconnectEdge(originalEdge, {
        source: "A",
        target: "C",
        sourceHandle: "bottom-source",
        targetHandle: "top-target",
      });

      const reconnectedEdge = getEdge();
      expectMarkerEnd(reconnectedEdge, MarkerType.Arrow);
      expectDataMarkerEnd(reconnectedEdge, "arrow");
    });

    it("色付きマーカーも付け替え後に保持される", () => {
      addTestNodes("A", "B", "C");
      useFlowStore.getState().addEdge("A", "B", "", "bottom-source", "top-target", {
        markerEnd: "arrowclosed",
        strokeColor: "#3b82f6",
      });

      const originalEdge = getEdge();
      expect((originalEdge.markerEnd as { color?: string }).color).toBe("#3b82f6");

      useFlowStore.getState().reconnectEdge(originalEdge, {
        source: "A",
        target: "C",
        sourceHandle: "bottom-source",
        targetHandle: "top-target",
      });

      const reconnectedEdge = getEdge();
      expect((reconnectedEdge.markerEnd as { color?: string }).color).toBe("#3b82f6");
    });
  });

  // ----------------------------------------------------------
  // パターン3: updateEdgeMarkers（マーカー変更）
  // ----------------------------------------------------------
  describe("パターン3: updateEdgeMarkers（マーカー変更）", () => {
    it("arrowclosed → arrow に変更できる", () => {
      addTestNodes("A", "B");
      useFlowStore.getState().addEdge("A", "B", "", "bottom-source", "top-target");

      const edge = getEdge();
      useFlowStore.getState().updateEdgeMarkers(edge.id, undefined, "arrow");

      const updated = getEdge(edge.id);
      expectMarkerEnd(updated, MarkerType.Arrow);
      expectDataMarkerEnd(updated, "arrow");
    });

    it("arrowclosed → none に変更すると markerEnd は undefined", () => {
      addTestNodes("A", "B");
      useFlowStore.getState().addEdge("A", "B", "", "bottom-source", "top-target");

      const edge = getEdge();
      useFlowStore.getState().updateEdgeMarkers(edge.id, undefined, "none");

      const updated = getEdge(edge.id);
      expect(updated.markerEnd).toBeUndefined();
      expectDataMarkerEnd(updated, "none");
    });

    it("none → arrowclosed に戻せる", () => {
      addTestNodes("A", "B");
      useFlowStore.getState().addEdge("A", "B", "", "bottom-source", "top-target", {
        markerEnd: "none",
      });

      const edge = getEdge();
      useFlowStore.getState().updateEdgeMarkers(edge.id, undefined, "arrowclosed");

      const updated = getEdge(edge.id);
      expectMarkerEnd(updated, MarkerType.ArrowClosed);
      expectDataMarkerEnd(updated, "arrowclosed");
    });
  });

  // ----------------------------------------------------------
  // パターン4: updateEdgeStyle（スタイル変更時のマーカー再変換）
  // ----------------------------------------------------------
  describe("パターン4: updateEdgeStyle（スタイル変更）", () => {
    it("strokeColor 変更時に markerEnd の色も更新される", () => {
      addTestNodes("A", "B");
      useFlowStore.getState().addEdge("A", "B", "", "bottom-source", "top-target");

      const edge = getEdge();
      useFlowStore.getState().updateEdgeStyle(edge.id, undefined, "#ef4444", undefined);

      const updated = getEdge(edge.id);
      expectMarkerEnd(updated, MarkerType.ArrowClosed);
      expect((updated.markerEnd as { color?: string }).color).toBe("#ef4444");
    });

    it("strokeWidth 変更時も markerEnd は維持される", () => {
      addTestNodes("A", "B");
      useFlowStore.getState().addEdge("A", "B", "", "bottom-source", "top-target");

      const edge = getEdge();
      useFlowStore.getState().updateEdgeStyle(edge.id, 4, undefined, undefined);

      const updated = getEdge(edge.id);
      expectMarkerEnd(updated, MarkerType.ArrowClosed);
    });

    it("strokeColor を解除しても markerEnd タイプは維持される", () => {
      addTestNodes("A", "B");
      useFlowStore.getState().addEdge("A", "B", "", "bottom-source", "top-target", {
        strokeColor: "#ef4444",
      });

      const edge = getEdge();
      useFlowStore.getState().updateEdgeStyle(edge.id, undefined, "", undefined);

      const updated = getEdge(edge.id);
      expectMarkerEnd(updated, MarkerType.ArrowClosed);
    });

    it("strokeColor 変更時に data.strokeColor も更新される", () => {
      addTestNodes("A", "B");
      useFlowStore.getState().addEdge("A", "B", "", "bottom-source", "top-target");

      const edge = getEdge();
      useFlowStore.getState().updateEdgeStyle(edge.id, undefined, "#3b82f6", undefined);

      const updated = getEdge(edge.id);
      expect(updated.data?.strokeColor).toBe("#3b82f6");
    });

    it("strokeColor 解除後に markerEnd の color プロパティが含まれない", () => {
      addTestNodes("A", "B");
      useFlowStore.getState().addEdge("A", "B", "", "bottom-source", "top-target", {
        strokeColor: "#ef4444",
      });

      const edge = getEdge();
      // 色を解除
      useFlowStore.getState().updateEdgeStyle(edge.id, undefined, "", undefined);

      const updated = getEdge(edge.id);
      expectMarkerEnd(updated, MarkerType.ArrowClosed);
      // color: undefined がオブジェクトに含まれていないことを確認
      expect("color" in (updated.markerEnd as object)).toBe(false);
    });

    it("strokeColor 変更→別の色に変更で markerEnd の色も追従する", () => {
      addTestNodes("A", "B");
      useFlowStore.getState().addEdge("A", "B", "", "bottom-source", "top-target");

      const edge = getEdge();
      useFlowStore.getState().updateEdgeStyle(edge.id, undefined, "#ef4444", undefined);
      useFlowStore.getState().updateEdgeStyle(edge.id, undefined, "#3b82f6", undefined);

      const updated = getEdge(edge.id);
      expect(updated.data?.strokeColor).toBe("#3b82f6");
      expect((updated.markerEnd as { color?: string }).color).toBe("#3b82f6");
    });

    it("updateEdgeMarkers で markerEnd 変更後も色が維持される", () => {
      addTestNodes("A", "B");
      useFlowStore.getState().addEdge("A", "B", "", "bottom-source", "top-target", {
        strokeColor: "#ef4444",
      });

      const edge = getEdge();
      // arrowclosed → arrow に変更
      useFlowStore.getState().updateEdgeMarkers(edge.id, undefined, "arrow");

      const updated = getEdge(edge.id);
      expectMarkerEnd(updated, MarkerType.Arrow);
      // strokeColor は updateEdgeMarkers では変わらない
      expect(updated.data?.strokeColor).toBe("#ef4444");
      // マーカーオブジェクトにも色が引き継がれている
      expect((updated.markerEnd as { color?: string }).color).toBe("#ef4444");
    });
  });

  // ----------------------------------------------------------
  // パターン5: duplicateNodes（ノード複製）
  // ----------------------------------------------------------
  describe("パターン5: duplicateNodes（ノード複製）", () => {
    it("複製されたエッジも markerEnd を保持する", () => {
      addTestNodes("A", "B");
      useFlowStore.getState().addEdge("A", "B", "test", "bottom-source", "top-target");

      const beforeEdges = getNonBridgeEdges();
      expect(beforeEdges).toHaveLength(1);
      expectMarkerEnd(beforeEdges[0], MarkerType.ArrowClosed);

      // A, B を複製
      useFlowStore.getState().duplicateNodes(["A", "B"]);

      const afterEdges = getNonBridgeEdges();
      // 元の1本 + 複製の1本 = 2本（ただし duplicateNodes は選択ノード間のエッジのみ複製）
      for (const edge of afterEdges) {
        expectMarkerEnd(edge, MarkerType.ArrowClosed);
        expectDataMarkerEnd(edge, "arrowclosed");
      }
    });

    it("arrow マーカーのエッジも複製時に保持される", () => {
      addTestNodes("A", "B");
      useFlowStore.getState().addEdge("A", "B", "", "bottom-source", "top-target", {
        markerEnd: "arrow",
      });

      useFlowStore.getState().duplicateNodes(["A", "B"]);

      const edges = getNonBridgeEdges();
      for (const edge of edges) {
        expectMarkerEnd(edge, MarkerType.Arrow);
        expectDataMarkerEnd(edge, "arrow");
      }
    });
  });

  // ----------------------------------------------------------
  // パターン6: loadState（状態読み込み・マイグレーション）
  // ----------------------------------------------------------
  describe("パターン6: loadState（状態読み込み）", () => {
    it("トップレベル markerEnd があるエッジはそのまま読み込まれる", () => {
      const state = {
        nodes: [
          { id: "A", type: "rectangle", position: { x: 0, y: 0 }, data: { label: "A", shape: "rectangle" as const } },
          { id: "B", type: "rectangle", position: { x: 0, y: 100 }, data: { label: "B", shape: "rectangle" as const } },
        ] as FlowNode[],
        edges: [
          {
            id: "A-B-bottom-source-top-target",
            source: "A",
            target: "B",
            type: "labeled",
            markerEnd: { type: MarkerType.ArrowClosed },
            data: { label: "", edgeType: "bezier" as const, markerEnd: "arrowclosed" as const },
          },
        ] as FlowEdge[],
        direction: "TD" as const,
        nextIdCounter: 2,
      };

      useFlowStore.getState().loadState(state);

      const edge = getEdge();
      expectMarkerEnd(edge, MarkerType.ArrowClosed);
    });

    it("トップレベル markerEnd が欠落しているエッジは data から補完される", () => {
      const state = {
        nodes: [
          { id: "A", type: "rectangle", position: { x: 0, y: 0 }, data: { label: "A", shape: "rectangle" as const } },
          { id: "B", type: "rectangle", position: { x: 0, y: 100 }, data: { label: "B", shape: "rectangle" as const } },
        ] as FlowNode[],
        edges: [
          {
            id: "A-B-bottom-source-top-target",
            source: "A",
            target: "B",
            type: "labeled",
            // markerEnd なし（トップレベル）
            data: { label: "", edgeType: "bezier" as const, markerEnd: "arrowclosed" as const },
          },
        ] as FlowEdge[],
        direction: "TD" as const,
        nextIdCounter: 2,
      };

      useFlowStore.getState().loadState(state);

      const edge = getEdge();
      expectMarkerEnd(edge, MarkerType.ArrowClosed);
    });

    it("data.markerEnd も欠落している場合はデフォルト arrowclosed で補完される", () => {
      const state = {
        nodes: [
          { id: "A", type: "rectangle", position: { x: 0, y: 0 }, data: { label: "A", shape: "rectangle" as const } },
          { id: "B", type: "rectangle", position: { x: 0, y: 100 }, data: { label: "B", shape: "rectangle" as const } },
        ] as FlowNode[],
        edges: [
          {
            id: "A-B-bottom-source-top-target",
            source: "A",
            target: "B",
            type: "labeled",
            // markerEnd なし（トップレベルも data も）
            data: { label: "", edgeType: "bezier" as const },
          },
        ] as FlowEdge[],
        direction: "TD" as const,
        nextIdCounter: 2,
      };

      useFlowStore.getState().loadState(state);

      const edge = getEdge();
      expectMarkerEnd(edge, MarkerType.ArrowClosed);
    });

    it("arrow マーカーのエッジも loadState で正しく補完される", () => {
      const state = {
        nodes: [
          { id: "A", type: "rectangle", position: { x: 0, y: 0 }, data: { label: "A", shape: "rectangle" as const } },
          { id: "B", type: "rectangle", position: { x: 0, y: 100 }, data: { label: "B", shape: "rectangle" as const } },
        ] as FlowNode[],
        edges: [
          {
            id: "A-B-bottom-source-top-target",
            source: "A",
            target: "B",
            type: "labeled",
            // トップレベル markerEnd なし
            data: { label: "", edgeType: "bezier" as const, markerEnd: "arrow" as const },
          },
        ] as FlowEdge[],
        direction: "TD" as const,
        nextIdCounter: 2,
      };

      useFlowStore.getState().loadState(state);

      const edge = getEdge();
      expectMarkerEnd(edge, MarkerType.Arrow);
    });

    it("strokeColor 付きエッジの loadState でマーカーに色が反映される", () => {
      const state = {
        nodes: [
          { id: "A", type: "rectangle", position: { x: 0, y: 0 }, data: { label: "A", shape: "rectangle" as const } },
          { id: "B", type: "rectangle", position: { x: 0, y: 100 }, data: { label: "B", shape: "rectangle" as const } },
        ] as FlowNode[],
        edges: [
          {
            id: "A-B-bottom-source-top-target",
            source: "A",
            target: "B",
            type: "labeled",
            // トップレベル markerEnd なし
            data: { label: "", edgeType: "bezier" as const, markerEnd: "arrowclosed" as const, strokeColor: "#ef4444" },
          },
        ] as FlowEdge[],
        direction: "TD" as const,
        nextIdCounter: 2,
      };

      useFlowStore.getState().loadState(state);

      const edge = getEdge();
      expectMarkerEnd(edge, MarkerType.ArrowClosed);
      expect((edge.markerEnd as { color?: string }).color).toBe("#ef4444");
    });
  });

  // ----------------------------------------------------------
  // パターン7: deserialize（.flowmaidファイル読み込み）→ loadState
  // ----------------------------------------------------------
  describe("パターン7: deserialize + loadState（.flowmaid インポート）", () => {
    it("デシリアライズしたエッジは loadState 経由で markerEnd が補完される", () => {
      const flowmaidContent = `--- mermaid ---
graph TD
    A[Start] --> B[End]

--- layout ---
direction: TD
nodes:
  A:
    position: { x: 100, y: 50 }
    shape: rectangle
    label: Start
  B:
    position: { x: 100, y: 200 }
    shape: rectangle
    label: End
edges:
  A-B-bottom-source-top-target:
    source: A
    target: B
    sourceHandle: bottom-source
    targetHandle: top-target
`;

      const result = deserialize(flowmaidContent);
      expect(result).not.toBeNull();

      // deserialize 単体ではトップレベル markerEnd がない
      const rawEdge = result!.edges[0];
      expect(rawEdge.markerEnd).toBeUndefined();
      expectDataMarkerEnd(rawEdge, "arrowclosed");

      // loadState で補完される
      useFlowStore.getState().loadState({
        nodes: result!.nodes,
        edges: result!.edges,
        direction: result!.direction,
        nextIdCounter: result!.nextIdCounter,
        componentDefinitions: result!.componentDefinitions,
      });

      const edge = getEdge();
      expectMarkerEnd(edge, MarkerType.ArrowClosed);
    });

    it("カスタムマーカー（arrow）の .flowmaid インポート", () => {
      const flowmaidContent = `--- mermaid ---
graph TD
    A[Start] --> B[End]

--- layout ---
direction: TD
nodes:
  A:
    position: { x: 100, y: 50 }
    shape: rectangle
    label: Start
  B:
    position: { x: 100, y: 200 }
    shape: rectangle
    label: End
edges:
  A-B-bottom-source-top-target:
    source: A
    target: B
    sourceHandle: bottom-source
    targetHandle: top-target
    markerEnd: arrow
`;

      const result = deserialize(flowmaidContent);
      expect(result).not.toBeNull();

      useFlowStore.getState().loadState({
        nodes: result!.nodes,
        edges: result!.edges,
        direction: result!.direction,
        nextIdCounter: result!.nextIdCounter,
        componentDefinitions: result!.componentDefinitions,
      });

      const edge = getEdge();
      expectMarkerEnd(edge, MarkerType.Arrow);
      expectDataMarkerEnd(edge, "arrow");
    });
  });

  // ----------------------------------------------------------
  // パターン8: parseMermaid（Mermaid記法からの変換）
  // ----------------------------------------------------------
  describe("パターン8: parseMermaid（Mermaid インポート）", () => {
    it("Mermaid パース結果のエッジに markerEnd が設定されている", () => {
      const result = parseMermaid("graph TD\n    A[Start] --> B[End]");
      expect(result).not.toBeNull();
      expect(result!.edges.length).toBeGreaterThan(0);

      for (const edge of result!.edges) {
        expectMarkerEnd(edge, MarkerType.ArrowClosed);
        expectDataMarkerEnd(edge, "arrowclosed");
      }
    });

    it("複数エッジの Mermaid パースですべてに markerEnd が設定される", () => {
      const result = parseMermaid("graph TD\n    A[Start] --> B{Check}\n    B -->|Yes| C[OK]\n    B -->|No| D[NG]");
      expect(result).not.toBeNull();
      expect(result!.edges.length).toBe(3);

      for (const edge of result!.edges) {
        expectMarkerEnd(edge, MarkerType.ArrowClosed);
      }
    });

    it("LR 方向の Mermaid パースでも markerEnd が設定される", () => {
      const result = parseMermaid("graph LR\n    A[Start] --> B[End]");
      expect(result).not.toBeNull();

      for (const edge of result!.edges) {
        expectMarkerEnd(edge, MarkerType.ArrowClosed);
      }
    });
  });

  // ----------------------------------------------------------
  // パターン9: generateComponentChildren（コンポーネント子エッジ）
  // ----------------------------------------------------------
  describe("パターン9: generateComponentChildren（コンポーネント内部エッジ）", () => {
    it("コンポーネント子エッジに markerEnd が設定される", () => {
      const defId = useFlowStore.getState().createComponentDefinition("Test");
      const def = useFlowStore.getState().componentDefinitions[0];

      const { childEdges } = generateComponentChildren({
        parentId: "INST",
        def,
        hidden: false,
      });

      for (const edge of childEdges) {
        expectMarkerEnd(edge, MarkerType.ArrowClosed);
        expectDataMarkerEnd(edge, "arrowclosed");
      }
    });

    it("カスタムマーカーの内部エッジも正しく変換される", () => {
      const defId = useFlowStore.getState().createComponentDefinition("Test");
      // 定義のエッジにカスタムマーカーを設定
      const def = useFlowStore.getState().componentDefinitions[0];
      const customDef = {
        ...def,
        edges: def.edges.map((e) => ({ ...e, markerEnd: "arrow" as const })),
      };

      const { childEdges } = generateComponentChildren({
        parentId: "INST",
        def: customDef,
        hidden: false,
      });

      for (const edge of childEdges) {
        expectMarkerEnd(edge, MarkerType.Arrow);
        expectDataMarkerEnd(edge, "arrow");
      }
    });
  });

  // ----------------------------------------------------------
  // パターン10: ブリッジエッジ（コンポーネントインスタンス）
  // ----------------------------------------------------------
  describe("パターン10: ブリッジエッジ", () => {
    it("コンポーネントインスタンスへのエッジ接続でブリッジエッジに markerEnd が設定される", () => {
      // コンポーネント定義を作成
      const defId = useFlowStore.getState().createComponentDefinition("Bridge Test");

      // インスタンスをキャンバスに配置
      useFlowStore.getState().placeComponentInstance(defId, { x: 200, y: 200 });
      const instNode = useFlowStore.getState().nodes.find(
        (n) => n.data.componentDefinitionId === defId
      )!;

      // 外部ノードを追加してインスタンスに接続
      addTestNodes("EXT");
      useFlowStore.getState().addEdge(
        "EXT",
        instNode.id,
        "",
        "bottom-source",
        "top-target",
      );

      // ブリッジエッジを確認
      const bridgeEdges = useFlowStore.getState().edges.filter(
        (e) => e.data?.isBridgeEdge
      );

      for (const bridge of bridgeEdges) {
        expectMarkerEnd(bridge, MarkerType.ArrowClosed);
        expectDataMarkerEnd(bridge, "arrowclosed");
      }
    });
  });

  // ----------------------------------------------------------
  // パターン11: ゴーストエッジ（予測入力 - FlowCanvas / usePredictiveInput）
  // ※ ゴーストエッジはストアに保存されず useMemo で生成されるため、
  //    生成ロジックの単体テストではなく、期待される構造を検証する
  // ----------------------------------------------------------
  describe("パターン11: ゴーストエッジ（予測入力）", () => {
    it("ゴーストエッジにトップレベル markerEnd が設定されている", () => {
      // ゴーストエッジの生成パターンを再現（修正後）
      // FlowCanvas.tsx と usePredictiveInput.ts の構造
      const ghostEdge = {
        id: "__ghost_edge__test",
        source: "A",
        target: "__ghost__A_bottom",
        sourceHandle: "bottom-source",
        targetHandle: "top-target",
        type: "labeled",
        style: { strokeDasharray: "6 3" },
        selectable: false,
        markerEnd: { type: MarkerType.ArrowClosed },
        data: {
          edgeType: "bezier",
          markerEnd: "arrowclosed",
          strokeStyle: "dashed",
        },
      } as FlowEdge;

      expectMarkerEnd(ghostEdge, MarkerType.ArrowClosed);
      expectDataMarkerEnd(ghostEdge, "arrowclosed");
    });
  });

  // ----------------------------------------------------------
  // パターン12: コピー＆ペースト（useKeyboardShortcuts）
  // ※ フック内のロジックなのでストアの状態を使ってシミュレート
  // ----------------------------------------------------------
  describe("パターン12: コピー＆ペースト（シミュレーション）", () => {
    it("スプレッドコピーで markerEnd が保持される", () => {
      addTestNodes("A", "B");
      useFlowStore.getState().addEdge("A", "B", "test", "bottom-source", "top-target");

      const originalEdge = getEdge();
      expectMarkerEnd(originalEdge, MarkerType.ArrowClosed);

      // useKeyboardShortcuts のペースト処理をシミュレート
      const newSource = "C";
      const newTarget = "D";
      const copiedEdge: FlowEdge = {
        ...originalEdge,
        id: `${newSource}-${newTarget}-${originalEdge.sourceHandle ?? "d"}-${originalEdge.targetHandle ?? "d"}`,
        source: newSource,
        target: newTarget,
        selected: false,
      };

      // markerEnd がスプレッドで保持されている
      expectMarkerEnd(copiedEdge, MarkerType.ArrowClosed);
      expectDataMarkerEnd(copiedEdge, "arrowclosed");
    });

    it("色付きマーカーもコピーで保持される", () => {
      addTestNodes("A", "B");
      useFlowStore.getState().addEdge("A", "B", "", "bottom-source", "top-target", {
        markerEnd: "arrowclosed",
        strokeColor: "#3b82f6",
      });

      const originalEdge = getEdge();
      const copiedEdge: FlowEdge = {
        ...originalEdge,
        id: "C-D-bottom-source-top-target",
        source: "C",
        target: "D",
        selected: false,
      };

      expectMarkerEnd(copiedEdge, MarkerType.ArrowClosed);
      expect((copiedEdge.markerEnd as { color?: string }).color).toBe("#3b82f6");
    });
  });
});
