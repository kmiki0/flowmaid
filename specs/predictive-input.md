# 予測入力機能（Predictive Node Placement）仕様書

## 概要

Visio の AutoConnect に似た機能。キャンバス上のノードにマウスが近づいたとき、カーソルがある方向に方向矢印ハンドルを1つ動的に表示する。その矢印にホバーするとゴーストノード（配置プレビュー）が表示され、クリックで確定配置・エッジ自動接続を行う。

### 主なユーザーフロー

1. ノードにマウスが近づく（外側の一定距離内）
2. カーソル方向（上/下/左/右）の矢印ハンドルが出現
3. 矢印にホバー → ゴーストノードが当該方向に半透明表示
4. ホイールまたは矢印キーで候補（最大4種類）を切り替え
5. クリックで実ノードとして確定、元ノードとのエッジも自動生成

---

## マウス操作仕様

### 方向検知ゾーン

ノードの外側に検知エリアを設け、カーソルがどの方向にあるかを判定する。

```
              検知エリア（DETECT_RANGE）
         ┌─────────────────────────────┐
         │         ╲ top ╱             │
         │    ╲             ╱          │
         │       ┌───────┐             │
         │ left  │ ノード │  right      │
         │       └───────┘             │
         │    ╱             ╲          │
         │         ╱bottom╲            │
         └─────────────────────────────┘
```

- **検知範囲**: ノードの各辺から `PREDICTIVE_DETECT_RANGE`（40px）以内
- **方向判定**: ノード中心からカーソルへのベクトルで、最も近い辺の方向を採用
  - `|dx| > |dy|` → 左右（dx > 0 なら right、dx < 0 なら left）
  - `|dy| >= |dx|` → 上下（dy > 0 なら bottom、dy < 0 なら top）
- **ノード内部**: カーソルがノード上にあるときは矢印を表示しない（通常のドラッグ・選択操作を優先）
- **1方向のみ**: 常に最も近い方向の矢印1つだけを表示（複数同時表示しない）

### 操作フロー

```
                    ┌──────────────┐
                    │  通常状態     │
                    └──────┬───────┘
                           │ カーソルがノード外側の
                           │ 検知エリアに入る
                           ▼
                    ┌──────────────┐
                    │  矢印表示    │ ← カーソル方向の矢印1つを表示
                    └──────┬───────┘
                           │ 矢印にマウスが乗る
                           ▼
          wheel/↑↓  ┌──────────────┐
         ◄─────────►│ ゴースト表示  │ ← 半透明ノード + 破線エッジ
                    └──┬───────┬───┘
                       │       │ マウスが矢印から離れる
              click    │       │ （検知エリア外へ）
                       ▼       ▼
              ┌────────────┐  ┌──────────────┐
              │ ノード確定  │  │  通常状態     │
              │ + エッジ生成│  └──────────────┘
              └────────────┘
```

### 各状態の詳細

#### 1. 通常状態 → 矢印表示

| 項目 | 内容 |
|------|------|
| トリガー | カーソルがノード外側の検知エリア内に移動 |
| 表示 | カーソル方向に三角形の矢印アイコン（▽ ▷ △ ◁）を1つ表示 |
| カーソル | `default`（通常） |
| 方向変化 | カーソルが別の方向に移動すると、矢印も追従して切り替わる |
| 非表示条件 | カーソルが検知エリア外に出る / ノード内部に入る |

#### 2. 矢印表示 → ゴースト表示

| 項目 | 内容 |
|------|------|
| トリガー | 矢印アイコンに mouseenter |
| 表示 | 矢印方向にゴーストノード（opacity: 0.4）と破線エッジプレビューを表示 |
| 初期候補 | 候補1「フルコピー」（元ノードのスタイル・テキスト全引き継ぎ） |
| カーソル | 矢印上: `pointer`、ゴースト上: `pointer` |

#### 3. ゴースト表示中の候補切り替え

| 操作 | 動作 |
|------|------|
| ホイール上 / ↑キー | 前の候補に切り替え（ループ） |
| ホイール下 / ↓キー | 次の候補に切り替え（ループ） |
| ホイール操作中 | キャンバスのズームを抑制（`e.preventDefault()`） |

候補の順序:
1. フルコピー（スタイル+テキスト+エッジスタイル全部）
2. 形状のみコピー（形状だけ、他はデフォルト）
3. ペア最頻値 1位（現フローのエッジペア集計で最多の形状）
4. ペア最頻値 2位（同集計の2番目）

#### 4. ゴースト確定

| 操作 | 動作 |
|------|------|
| クリック（矢印 or ゴースト上） | 現在の候補でノードを実体化、元ノード→新ノードのエッジを自動生成 |
| Escape | ゴーストを閉じて通常状態に戻る |

#### 5. 確定時のエッジ接続ハンドル

| 矢印方向 | sourceHandle（元ノード） | targetHandle（新ノード） |
|----------|------------------------|------------------------|
| ▽ 下 | `bottom-source` | `top-target` |
| ▷ 右 | `right-source` | `left-target` |
| △ 上 | `top-source` | `bottom-target` |
| ◁ 左 | `left-source` | `right-target` |

### エッジプレビュー

ゴースト表示中は、元ノード→ゴーストノード間に破線のエッジプレビューも表示する。

- 候補1（フルコピー）: 元ノードに接続されている既存エッジのスタイルを反映（破線化）
- 候補2〜4: デフォルトエッジスタイル（破線）
- 確定時に実線のエッジに置き換わる

### 修飾キーとの組み合わせ

| 操作 | 動作 | 理由 |
|------|------|------|
| Ctrl+クリック（ノード付近） | 選択トグル優先、予測入力は無効 | 既存の個別選択/解除を妨げない |
| Ctrl+ドラッグ（ノード付近） | XOR選択トグル優先、予測入力は無効 | 既存の複数選択操作を妨げない |
| Ctrl+ホイール（ゴースト表示中） | キャンバスズーム優先、候補切り替えしない | Ctrl+ホイール=ズームが一般的な操作体系 |
| Shift+ホイール（ゴースト表示中） | 横スクロール優先、候補切り替えしない | 既存の Shift+Wheel ハンドラを妨げない |
| Ctrl 押下中に検知エリアに入る | 矢印を表示しない | Ctrl 押下=選択操作の意図と判断 |
| ゴースト表示中に Ctrl を押す | ゴーストを閉じる | 選択操作への移行を即座に許可 |

> **実装メモ**: 矢印表示の条件に `!e.ctrlKey && !e.metaKey` を追加する。Mac の Cmd キー（`metaKey`）も同様に扱う。

### 操作の排他制御

| 状態 | 予測入力 | 他の操作 |
|------|---------|---------|
| Ctrl / Cmd 押下中 | 無効 | 選択操作優先 |
| ノードドラッグ中 | 無効 | ドラッグ優先 |
| エッジ接続中（ハンドルドラッグ） | 無効 | 接続優先 |
| 選択ボックスドラッグ中 | 無効 | 選択優先 |
| コンテキストメニュー表示中 | 無効 | メニュー優先 |
| テキスト編集中（ダブルクリック） | 無効 | 編集優先 |
| BulkEdit モード | 無効 | — |
| コンポーネント編集モード（ロックノード） | 無効 | — |

---

## 実装方針

### 選択肢の検討

#### 案A: NodeWrapper 内にすべての UI を閉じ込める（コンポーネント内完結）

各ノードコンポーネントに方向矢印とゴースト描画ロジックを直接持たせる。

- **メリット**: ノードごとに独立、React Flow の座標系内で完結
- **デメリット**: 15種類のノードすべてに変更が及ぶ。ゴーストノードはノードの外側（別ノードとして）に描画する必要があり、個々のノード内では表現できない。ホバー状態を外に出す仕組みが必要

#### 案B: FlowCanvas レベルで onNodeMouseMove + オーバーレイ SVG で管理（キャンバス集中管理）

FlowCanvas のイベントハンドラでホバーノードを検出し、方向矢印・ゴーストを React Flow の `<Panel>` または SVG オーバーレイで描画する。ゴーストノードは react-flow の仮ノードとして追加する。

- **メリット**: ノードコンポーネントへの変更が最小限。ゴーストを `nodes` 配列に仮追加すれば自然にキャンバス内で描画できる
- **デメリット**: `onNodeMouseMove` は React Flow の公式 API に存在しないため `onMouseMove` を DOM レベルで捕捉する必要あり。ゴーストを仮ノード化すると zustand の undo 履歴に混入するリスクあり

#### 案C: NodeWrapper に方向矢印のみ追加し、ゴーストは zustand の一時 state で管理（ハイブリッド）

NodeWrapper に方向矢印 UI を追加（ConnectHandle と同層の overlay div）、矢印の hover イベントで zustand の一時ステート（undo 対象外）に候補情報を書き込み、FlowCanvas でゴーストノードを描画する。

- **メリット**: 責務分離が明確。NodeWrapper は「矢印ハンドルの表示と方向特定」のみ担当。ゴーストの候補計算・描画は FlowCanvas 側で集中管理。undo 履歴に混入させないための既存パターン（`useFlowStore.temporal` の pause/resume）が流用できる
- **デメリット**: 2コンポーネント間の協調が必要。`usePredictiveInput` カスタムフック1本で橋渡しすれば複雑さを抑えられる

### 推奨案: 案C（ハイブリッド）

**理由**:

1. **undo 安全性**: ゴーストは一時表示であり `temporal` の対象外にする必要がある。案Cでは zustand の別スライス（undo 対象外の通常 state）に一時データを置くことで確実に制御できる。案Bの「仮ノードを nodes に追加」はこの制御が難しい
2. **パフォーマンス**: NodeWrapper の hover 検知を `useState` のローカルステートで行い、zustand には矢印クリック/ホバー時のみ書き込む。ドラッグ中 ConnectHandle が `visible` フラグで制御されているのと同じパターンを踏襲できる
3. **変更範囲の最小化**: NodeWrapper と FlowCanvas のみを変更対象とし、15種のノードコンポーネント（RectangleNode など）へは変更不要
4. **既存スナップ機能の再利用**: `useSnapGuides` の `getNodeBounds` ロジックをゴースト配置座標計算に流用できる

---

## 変更・追加ファイル

### 新規作成

| ファイルパス | 役割 |
|---|---|
| `src/hooks/usePredictiveInput.ts` | 予測入力の状態管理とロジックをまとめるカスタムフック |
| `src/components/nodes/PredictiveArrowHandle.tsx` | 方向矢印ハンドル UI コンポーネント |
| `src/components/canvas/GhostNode.tsx` | ゴーストノードのオーバーレイ描画コンポーネント |
| `src/lib/predictive/candidateUtils.ts` | 候補計算（ペア最頻値ロジック）pure function |

### 変更

| ファイルパス | 変更内容 |
|---|---|
| `src/store/types.ts` | `FlowState` に `predictiveInput` 一時ステート（undo 対象外）を追加 |
| `src/store/useFlowStore.ts` | `predictiveInput` ステートと操作アクションを追加 |
| `src/components/nodes/NodeWrapper.tsx` | `PredictiveArrowHandle` を追加、outer hover 検知ロジックを追加 |
| `src/components/canvas/FlowCanvas.tsx` | `GhostNode` を描画、ホイール/キーイベントでの候補切り替え、確定クリックのハンドラを追加 |
| `src/lib/constants.ts` | 予測入力関連の定数を追加 |

---

## クラス設計

### 1. 新しい zustand ステート（undo 対象外）

`useFlowStore` の `temporal` ラッパーの**外側**に通常の `create` ステートとして追加する、または `temporal` の `partialize` オプションで予測入力ステートを undo 対象外に除外する。

```typescript
// src/store/types.ts に追加
export interface PredictiveInputState {
  /** 予測入力がアクティブな元ノードのID。null = 非アクティブ */
  sourceNodeId: string | null;
  /** 矢印が向いている方向 */
  direction: "top" | "right" | "bottom" | "left" | null;
  /** ゴーストが表示されているか（矢印ホバー中） */
  ghostVisible: boolean;
  /** 候補リスト（最大4件、重複除去済み） */
  candidates: PredictiveCandidate[];
  /** 現在選択中の候補インデックス */
  candidateIndex: number;
}

export interface PredictiveCandidate {
  /** 候補の種別 */
  kind: "fullCopy" | "shapeCopy" | "pairFreq1" | "pairFreq2";
  /** 配置するノードのデータ（FlowNodeData） */
  nodeData: FlowNodeData;
  /** 自動生成するエッジのデータ（FlowEdgeData） */
  edgeData: Partial<FlowEdgeData>;
}
```

**`temporal` の `partialize` で undo 対象外化**:

```typescript
// useFlowStore.ts (概要)
export const useFlowStore = create<FlowState>()(
  temporal(
    (set, get) => ({ ... }),
    {
      partialize: (state) => {
        // predictiveInput は undo 履歴から除外
        const { predictiveInput, ...rest } = state;
        return rest;
      }
    }
  )
);
```

### 2. `usePredictiveInput` カスタムフック

`src/hooks/usePredictiveInput.ts`

**責務**:
- NodeWrapper から `(nodeId, direction)` を受け取り `predictiveInput` ステートを更新するコールバック群を返す
- 確定クリック時に `addNode` + `addEdge` を呼び出す
- `reactFlowInstance` を受け取り、ゴーストの配置座標を計算する

**主なメソッド**:

```typescript
interface UsePredictiveInputReturn {
  /** 矢印ハンドル onMouseEnter: 方向 + ノードID でゴースト計算開始 */
  onArrowEnter: (nodeId: string, direction: Direction) => void;
  /** 矢印ハンドル onMouseLeave */
  onArrowLeave: () => void;
  /** キャンバス上のホイールで候補を切り替え（ゴースト表示中のみ） */
  onCandidateCycle: (delta: number) => void;
  /** ゴーストをクリックして確定配置 */
  onConfirm: () => void;
  /** ゴーストの現在候補 */
  currentCandidate: PredictiveCandidate | null;
  /** ゴーストの配置座標（フロー座標系） */
  ghostPosition: { x: number; y: number } | null;
}
```

**内部処理 `computeGhostPosition`**:

元ノードのバウンディングボックス（`node.measured` または `node.style` から取得）と方向から、ゴーストの左上座標を計算する。

```
direction === "bottom":
  ghostX = sourceNode.position.x + (sourceW - ghostW) / 2  // 中央揃え
  ghostY = sourceNode.position.y + sourceH + GAP_PX

direction === "right":
  ghostX = sourceNode.position.x + sourceW + GAP_PX
  ghostY = sourceNode.position.y + (sourceH - ghostH) / 2
```

スナップ調整: ゴースト位置をグリッド(5px)にスナップする。

> **実装メモ**: `useSnapGuides.ts` の `getNodeBounds` は現在 export されていない（モジュール内ローカル関数）。ゴースト配置座標の計算に流用するには export を追加するか、`candidateUtils.ts` に同等のロジックを書く。グリッドサイズ `GRID = 5` も `useSnapGuides.ts` 内のローカル変数のため、`constants.ts` に定数化して共有するのが望ましい。

**内部処理 `computeCandidates`**:

`src/lib/predictive/candidateUtils.ts` の pure function に委譲する。

### 3. `candidateUtils.ts`（純関数）

```typescript
export function computeCandidates(
  sourceNode: FlowNode,
  allEdges: FlowEdge[],
  allNodes: FlowNode[]
): PredictiveCandidate[]
```

**候補生成ロジック**:

1. **候補1「フルコピー」**: 元ノードの `data` を全コピー（`label` のみ新IDに変更、他のスタイルはすべて保持）。エッジは元ノードに接続されているエッジの `data` をコピー（初回の場合はデフォルト）
2. **候補2「形状のみコピー」**: `shape` と `type` のみコピー、ラベル・色等はデフォルト。エッジはデフォルト
3. **候補3「ペア最頻値1位」**: 以下のロジックで計算した形状
4. **候補4「ペア最頻値2位」**: 同上の2位

**ペア最頻値ロジック**:

```typescript
function computePairFrequencies(
  sourceShape: NodeShape,
  allEdges: FlowEdge[],
  allNodes: FlowNode[]
): NodeShape[] {
  // allEdges から source → target の shape ペアを集計
  const freq = new Map<NodeShape, number>();
  for (const edge of allEdges) {
    const src = allNodes.find(n => n.id === edge.source);
    const tgt = allNodes.find(n => n.id === edge.target);
    if (!src || !tgt) continue;
    if (src.data.shape !== sourceShape) continue;
    const count = freq.get(tgt.data.shape) ?? 0;
    freq.set(tgt.data.shape, count + 1);
  }
  // 頻度降順でソート
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([shape]) => shape);
}
```

**重複除去**: 候補1〜4の `shape` が重複する場合は後ろの候補をスキップ。ペアデータ不足時（`allEdges` が空 or 元ノードを source とするエッジが0本）は候補3・4を生成しない。

### 4. `PredictiveArrowHandle` コンポーネント

`src/components/nodes/PredictiveArrowHandle.tsx`

```typescript
interface PredictiveArrowHandleProps {
  nodeId: string;
  direction: "top" | "right" | "bottom" | "left";
  visible: boolean; // NodeWrapper の hovered && !isComponentChild
  onEnter: (nodeId: string, dir: Direction) => void;
  onLeave: () => void;
}
```

**表示仕様**:
- ConnectHandle の外側に重ならないよう `position: absolute` で配置
  - bottom: `bottom: -28px; left: 50%; transform: translateX(-50%)`
  - right: `right: -28px; top: 50%; transform: translateY(-50%)`
  - top: `top: -28px; left: 50%; transform: translateX(-50%)`
  - left: `left: -28px; top: 50%; transform: translateY(-50%)`
- 三角形 SVG（`▽` `▷` `△` `◁`）、`var(--primary)` 色
- サイズ: 16×12px（ConnectHandle の 10px より少し大きめ）
- ズーム補正: `calc(size / var(--rf-zoom, 1))` を適用
- `opacity: visible ? 1 : 0; pointer-events: visible ? auto : none`
- hover 時: `opacity: 1; scale: 1.2`

**NodeWrapper への追加**:

NodeWrapper 内の `positions` マップに並べて、ゴーストが表示されていない（`isComponentChild` でない）ときにのみレンダリング。ConnectHandle と同様に `visible` フラグで表示制御。

NodeWrapper に追加するプロパティ:

```typescript
interface NodeWrapperProps {
  // ... 既存
  onPredictiveArrowEnter?: (nodeId: string, dir: Direction) => void;
  onPredictiveArrowLeave?: () => void;
}
```

`RectangleNode` など各ノードは `NodeWrapper` を呼ぶだけなので、各ノードファイルへの変更は不要。ただし `NodeWrapper` に props を追加した場合、NodeWrapper を直接使用している箇所（`ComponentInstanceNode` など）には影響を与えないようデフォルト値 `undefined` にする。

### 5. `GhostNode` コンポーネント

`src/components/canvas/GhostNode.tsx`

FlowCanvas 内の `ReactFlow` コンポーネントの**子**として `<Panel>` または `useStore(s => s.transform)` を使って絶対座標をフロー座標に変換し描画する。

方式: React Flow の `nodes` に一時ゴーストノードを注入する（`id: "__ghost__"`、`selectable: false`、`draggable: false`）。

- ゴーストノードは通常の nodeType を再利用し、CSS でグローバルに `opacity: 0.4` を適用する
- ゴーストの識別は `GHOST_NODE_ID` 定数との ID 比較で行う（`FlowNodeData` に `isGhost` フィールドは追加しない）
- `__ghost__` という固定 ID を持つノードは `onNodesChangeWithSnap` の先頭で `changes.filter(c => c.id !== GHOST_NODE_ID)` してスナップ処理・変更処理から除外する
- `temporal` の `partialize` でゴーストノードを undo 対象外にする（`nodes: state.nodes.filter(n => n.id !== GHOST_NODE_ID)`）

```typescript
// FlowCanvas.tsx 内
const ghostNode = usePredictiveStore(s => s.ghostNode); // 別途小さなstoreまたはuseStateで管理
const nodesWithGhost = ghostNode ? [...nodes, ghostNode] : nodes;
```

**ゴーストノードの styleとして半透明化**:

```css
/* globals.css */
.react-flow__node[data-id="__ghost__"] {
  opacity: 0.4;
  pointer-events: none; /* GhostNode 上のクリックはキャンバスに委譲 */
}
.react-flow__node[data-id="__ghost__"]:hover {
  cursor: pointer;
  pointer-events: auto; /* ホバー時はクリック可能に */
}
```

ただし確定クリックは `GhostNode` 上の `onClick` ではなく、FlowCanvas の `onPaneClick` または専用の透明オーバーレイ div で受け取る（pointer-events の制御を単純化するため）。

### 6. 確定時の処理

`usePredictiveInput.onConfirm()` 内:

```typescript
function onConfirm() {
  const { sourceNodeId, direction, candidates, candidateIndex, ghostPosition } = getPredictiveState();
  if (!sourceNodeId || !ghostPosition || !candidates[candidateIndex]) return;

  const candidate = candidates[candidateIndex];

  // addNodeWithData: 既存の addNode(shape, position?) を拡張した新アクション
  // ノードデータ（スタイル・ラベル等）を直接指定して配置できる
  const newId = addNodeWithData(candidate.nodeData, ghostPosition);

  const handles = directionToHandles(direction); // { sourceHandle, targetHandle }

  // addEdge: 既存シグネチャは (source, target, label?, sourceHandle?, targetHandle?)
  // エッジスタイル（strokeColor, strokeWidth等）を渡せるよう edgeData? を追加する
  addEdge(sourceNodeId, newId, candidate.edgeData?.label, handles.sourceHandle, handles.targetHandle, candidate.edgeData);

  // 予測入力ステートをリセット
  clearPredictiveInput();
}
```

> **実装メモ**: 既存の `addNode` は `(shape, position?)` のみ受け付ける。`addNodeWithData` は新規アクションとして追加する。既存の `addEdge` は `(source, target, label?, sourceHandle?, targetHandle?)` のシグネチャなので、末尾に `edgeData?: Partial<FlowEdgeData>` を追加する。

**方向とハンドルのマッピング**:

| 矢印方向 | sourceHandle | targetHandle |
|---|---|---|
| bottom | `bottom-source` | `top-target` |
| right | `right-source` | `left-target` |
| top | `top-source` | `bottom-target` |
| left | `left-source` | `right-target` |

### 7. 新しいストアアクション（types.ts）

```typescript
// FlowState に追加
predictiveInput: PredictiveInputState;
setPredictiveInput: (state: Partial<PredictiveInputState>) => void;
clearPredictiveInput: () => void;
addNodeWithData: (data: FlowNodeData, position: { x: number; y: number }) => string;
// 既存 addEdge のシグネチャ拡張:
// addEdge(source, target, label?, sourceHandle?, targetHandle?, edgeData?: Partial<FlowEdgeData>)
```

> **実装メモ**:
> - `addNodeWithData` は新規アクション。既存の `addNode(shape, position?)` はデフォルトスタイルのノードを生成するのに対し、`addNodeWithData` はスタイル・ラベル等を含む `FlowNodeData` を直接受け取る
> - `addEdge` は既存シグネチャの末尾に `edgeData?: Partial<FlowEdgeData>` を追加。edgeData が渡された場合、strokeColor, strokeWidth, strokeStyle, edgeType, markerStart, markerEnd をコピーする

---

## パフォーマンス設計

### ホバー検知の最小化

NodeWrapper の `hovered` ステートはすでに `useState` のローカルステートで管理されている。`PredictiveArrowHandle` の `onEnter/onLeave` も同様にローカルステートを先に更新し、zustand への書き込みは**矢印ホバー時のみ**（方向矢印 → ゴースト表示の起動時）に限定する。

ノードへの通常ホバーでは zustand に書き込まない（方向矢印の `visible` 制御はローカル `hovered` のみで行う）。

### ゴーストノード注入のコスト

`nodes` 配列に `__ghost__` を混ぜると React Flow が全ノードを再レンダリングするリスクがある。

対策:
- `nodesWithGhost` は `useMemo` で計算し、`ghostNode` 参照が変わったときのみ再計算
- ゴーストノードは `React.memo` でラップされた通常ノードコンポーネントを再利用するため、他ノードには影響しない
- `GhostNode` の `data` オブジェクトは `useMemo` で安定化する

### 候補計算のコスト

`computeCandidates` は `allEdges` と `allNodes` を走査する。フロー規模（数十〜数百ノード）では問題ないが、`useMemo` に `edges` と `nodes` と `sourceNodeId` を依存として候補を計算し、矢印ホバーのたびに再計算しないようにする。

---

## 注意事項・制約

### undo 履歴への混入防止

- `predictiveInput` ステートは `temporal` の `partialize` で必ず除外する
- ゴーストノード（`__ghost__` ID）も同様に `partialize` の `nodes` フィルタから除外する
- 確定操作（`addNode` + `addEdge`）は通常通り undo 履歴に記録される（意図的）

### コンポーネントインスタンスノードへの適用除外

- `isComponentChild` フラグが true のノード（インスタンスの子ノード）では方向矢印を表示しない（NodeWrapper の既存 `visible = !isComponentChild && ...` と同じ条件）
- `componentInstance` タイプのノードには方向矢印を表示する（通常ノードと同扱い）

### テキストノードへの適用

`shape === "text"` のノードは Mermaid 出力から除外される独自ノード。方向矢印から配置したゴーストが `text` 形状になることを避けるため、候補にテキストノードは含めない（`candidateUtils.ts` でフィルタ）。

### BulkEdit モード中の無効化

BulkEdit モードではキャンバスが読み取り専用のため、予測入力機能は無効にする。`NodeWrapper` の `predictive` 系 props を BulkEdit キャンバス側では渡さない（`BulkEditCanvas.tsx` は `NodeWrapper` の `onPredictiveArrow*` を undefined のまま）。

### コンポーネント編集モード中の無効化

`editingComponentId !== null` のとき、Entry/Exit ノードはロック状態のため方向矢印を表示しない（`isLocked` チェック）。その他の内部ノードは通常通り矢印を表示してもよい。

### ゴースト表示中のスクロール/ズーム

ゴースト表示中にユーザーがスクロール・ズームした場合、ゴーストの画面上の位置がずれる。ゴースト座標はフロー座標系で保持しているため React Flow が自動的に追従する。

### ゴースト表示中のキーボード操作

ゴースト表示中の `Escape` キーでゴーストを閉じる（`clearPredictiveInput`）。

> **実装メモ**: キーボードショートカットは FlowCanvas ではなく `src/hooks/useKeyboardShortcuts.ts` で集中管理されている。Escape ハンドラはこのフック内に追加する。

### Wheel イベントとの干渉

FlowCanvas の `wrapperRef` に Shift+Wheel の横スクロールハンドラが既存。通常ホイール（Shift なし）での候補切り替えとは干渉しない（`e.shiftKey` で分岐済み）。ただしゴースト表示中のホイールでは候補切り替えを優先し、`e.preventDefault()` でキャンバスのズーム操作を抑制する必要がある。

---

## 定数（`src/lib/constants.ts` に追加）

```typescript
/** 予測入力: 方向矢印を表示するノード外側の余白 (flow px) */
/** 予測入力: 方向矢印を表示するノード外側の余白 (flow px) */
export const PREDICTIVE_ARROW_OFFSET_PX = 28;
/** 予測入力: ノード外側の方向検知エリア (flow px) */
export const PREDICTIVE_DETECT_RANGE = 40;
/** 予測入力: ゴーストノードと元ノードの間隔 (flow px) */
export const PREDICTIVE_GAP_PX = 60;
/** ゴーストノードの固定ID */
export const GHOST_NODE_ID = "__ghost__";
/** スナップのグリッドサイズ (px) — useSnapGuides から移動 */
export const SNAP_GRID_SIZE = 5;
```

---

## 変更ファイルサマリー

| ファイル | 新規/変更 | 変更内容 |
|---|---|---|
| `src/lib/predictive/candidateUtils.ts` | 新規 | 候補計算の純関数（~80行） |
| `src/hooks/usePredictiveInput.ts` | 新規 | 予測入力の状態管理カスタムフック（~120行） |
| `src/components/nodes/PredictiveArrowHandle.tsx` | 新規 | 方向矢印ハンドルUI（~60行） |
| `src/components/canvas/GhostNode.tsx` | 新規 | ゴーストノード描画ラッパー（~30行） |
| `src/store/types.ts` | 変更 | `PredictiveInputState` 型追加、`addNodeWithData` アクション追加、`addEdge` シグネチャ拡張（末尾に `edgeData?`） |
| `src/store/useFlowStore.ts` | 変更 | `predictiveInput` ステート・アクション追加、`addNodeWithData` 実装、`addEdge` に `edgeData` 対応追加、`partialize` に `nodes` フィルタ（`GHOST_NODE_ID` 除外）追加 |
| `src/components/nodes/NodeWrapper.tsx` | 変更 | props追加 + `PredictiveArrowHandle` を source ハンドル map 直後に追加 |
| `src/components/canvas/FlowCanvas.tsx` | 変更 | `nodesWithGhost` 注入（`useMemo`）、`onNodesChangeWithSnap` にゴーストフィルタ追加、確定クリックハンドラ追加 |
| `src/hooks/useKeyboardShortcuts.ts` | 変更 | ゴースト表示中の Escape キーで `clearPredictiveInput` を呼び出す条件分岐追加 |
| `src/hooks/useSnapGuides.ts` | 変更 | `getNodeBounds` を export に変更 |
| `src/lib/constants.ts` | 変更 | 予測入力定数追加 + `SNAP_GRID_SIZE = 5` を定数化（useSnapGuides から移動） |
| `src/app/globals.css` | 変更 | `__ghost__` ノードの半透明スタイル追加 |

各ノードコンポーネント（`RectangleNode.tsx` 等）への変更は不要。
