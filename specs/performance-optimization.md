# ドラッグ操作パフォーマンス最適化

## 背景

ノードのドラッグ&ドロップ操作時にカクつきが発生していた。
React Flow はドラッグ中にフレームごとに `nodes` 配列を更新するため、`nodes` を購読しているすべてのコンポーネントが毎フレーム再レンダリングされていた。

## 問題の根本原因

React Flow の `nodes` 配列はドラッグ中に毎フレーム新しい参照になる（ノードの `position` が更新されるため）。
zustand の `useFlowStore((s) => s.nodes)` を使うと、配列参照が変わるたびにコンポーネントが再レンダリングされる。

## 適用した最適化

### 1. 全ノードコンポーネントに `React.memo` を追加

**対象**: 15種類のノード + ComponentInstanceNode + ConnectHandle

React Flow はノードの props（id, data, selected など）を渡す。`React.memo` で包むことで、自分自身のpropsが変わっていないノードの再レンダリングをスキップできる。

```typescript
// Before
export function RectangleNode({ id, data, selected }: NodeProps<FlowNode>) { ... }

// After
export const RectangleNode = memo(function RectangleNode({ id, data, selected }: NodeProps<FlowNode>) { ... });
```

**効果**: ドラッグ中に動かしていないノードが再レンダリングされなくなった

### 2. MermaidPreview の `useSyncExternalStore` + デバウンス

**ファイル**: `src/hooks/useMermaidOutput.ts`

`nodes`/`edges` を直接購読する代わりに、モジュールレベルの `useSyncExternalStore` + 200ms デバウンスで購読。ドラッグ中は通知が間引かれ、MermaidPreview の再レンダリングが大幅に削減される。

```typescript
const DEBOUNCE_MS = 200;
let currentSnapshot: Snapshot = { nodes: [], edges: [], direction: "TD", componentDefinitions: [] };
let listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

function subscribe(cb: () => void) {
  // useFlowStore.subscribe() でデバウンス付き購読
  // 200ms 以内の連続更新は最後の1回だけ通知
}

export function useMermaidOutput() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  // snap は200ms間隔でしか更新されない
}
```

**効果**: ドラッグ中の MermaidPreview 再レンダリング: 6回 → 2回

### 3. Toolbar の購読最適化

**ファイル**: `src/components/layout/Toolbar.tsx`

```typescript
// Before: nodes/edges 配列全体を購読（毎フレーム再レンダリング）
const nodes = useFlowStore((s) => s.nodes);
const edges = useFlowStore((s) => s.edges);

// After: boolean のみ購読（ドラッグ中は変化しない）
const hasContent = useFlowStore((s) => s.nodes.length > 0 || s.edges.length > 0);
```

**効果**: ドラッグ中の Toolbar 再レンダリングが完全に排除

### 4. FormatBar の購読最適化

**ファイル**: `src/components/layout/FormatBar.tsx`

```typescript
// Before: nodes/edges 配列全体を購読
const nodes = useFlowStore((s) => s.nodes);
const edges = useFlowStore((s) => s.edges);

// After: 選択IDの文字列のみ購読（選択が変わらなければ再レンダリングなし）
const selectSelectedNodeIds = (s) =>
  s.nodes.filter((n) => n.selected).map((n) => n.id).join(",");
const selectedNodeIdStr = useFlowStore(selectSelectedNodeIds);

// firstNode/firstEdge のデータは専用セレクタで取得
// node.data はドラッグ中に変化しない（positionのみ変化）ため安定
const firstNodeData = useFlowStore((s) => {
  if (!selectedNodeIds.length) return undefined;
  return s.nodes.find((n) => n.id === selectedNodeIds[0])?.data;
});
```

**効果**: ドラッグ中の FormatBar 再レンダリング: 7回 → ほぼ0

### 5. useSnapGuides のコールバック安定化

**ファイル**: `src/hooks/useSnapGuides.ts`

```typescript
// Before: nodes が依存配列に含まれ、毎フレームコールバックが再生成
const onNodeDrag = useCallback((...) => { ... }, [nodes]);

// After: useRef パターンで依存配列を空に
const nodesRef = useRef(nodes);
nodesRef.current = nodes;
const onNodeDrag = useCallback((...) => {
  const otherNodes = nodesRef.current.filter(...);
}, []); // 安定したコールバック
```

**効果**: FlowCanvas に渡すコールバックが安定し、不要な再レンダリングチェーンを防止

## 設計原則

### zustand セレクタの鉄則

| パターン | ドラッグ中の挙動 | 推奨度 |
|---|---|---|
| `useFlowStore((s) => s.nodes)` | 毎フレーム再レンダリング | ❌ 避ける |
| `useFlowStore((s) => s.nodes.length > 0)` | boolean が変わらなければ再レンダリングなし | ✅ |
| `useFlowStore((s) => s.nodes.find(...).data)` | `data` 参照はドラッグ中に変化しない | ✅ |
| `useFlowStore((s) => s.nodes.map(n => n.id).join(","))` | 文字列が変わらなければ再レンダリングなし | ✅ |

### React Flow の `node.data` vs `node.position`

- ドラッグ中に変わるのは `node.position` のみ
- `node.data` の参照はドラッグ中に変化しない
- したがって `node.data` を返すセレクタはドラッグ中に安定

### `useRef` パターンでコールバック安定化

配列やオブジェクトを `useCallback` の依存配列に入れると、参照変更のたびにコールバックが再生成される。
`useRef` に格納して `.current` で参照すれば、依存配列を `[]` にできる。

```typescript
const nodesRef = useRef(nodes);
nodesRef.current = nodes; // 毎レンダリングで最新値に更新
const handler = useCallback(() => {
  nodesRef.current.forEach(...); // 常に最新の nodes を参照
}, []); // 依存配列が空 → コールバックは安定
```

## 最適化前後の比較（ノード1つを少し動かした場合）

| コンポーネント | Before | After |
|---|---|---|
| NodeWrapper (per node) | 12回 | 4回 |
| MermaidPreview | 6回 | 2回 |
| Toolbar | 6回 | 0回 |
| FormatBar | 7回 | ≈0回 |
| ConnectHandle | 多数 | memo でスキップ |

## 注意事項

- `useSyncExternalStore` の `subscribe` 関数内でクロージャ変数を参照すると、最初のリスナー登録時の `unsub` が後続リスナーから見えない問題がある（`var` で巻き上げて対応）
- zustand セレクタ内で他のセレクタの結果（クロージャ変数）を参照してはいけない — 独立サブスクリプション間のstale値問題が起きる
