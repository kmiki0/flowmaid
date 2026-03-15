# コンポーネントインスタンス プレビュー専用化と自動更新 仕様書

> **ステータス: 実装済み（Phase 2）** — このファイルは設計判断の記録として残しています。最新仕様は CLAUDE.md を参照してください。

## 概要

コンポーネントインスタンスの内部（子ノード・内部エッジ）をユーザーが直接操作できないプレビュー専用表示に変更し、
定義編集時にすべてのインスタンスを確認なしで自動同期する。
あわせて、ラベル個別上書き機能（`componentLabelOverrides`）を廃止し、
リサイズ時のアスペクト比維持のためのスケーリングをX/Yの小さい方で統一する。

---

## 実装方針

### 方針A（推奨）: `componentParentId` フラグを活用した段階的無効化

現在すでに `isComponentChild` フラグを持つ `NodeWrapper` が「ハンドル非表示・リサイズ無効」を実装済み。
この既存機構を拡張し、子ノードのドラッグ移動・ラベル編集・コンテキストメニュー・エッジ選択を追加で抑制する。
自動同期は `exitComponentEditMode` の復帰フェーズに全インスタンス同期ロジックを組み込む。

**長所**: 最小限の変更範囲、既存のフラグ体系と整合。
**短所**: 変更箇所がやや分散する。

### 方針B: 子ノードに `selectable: false` / `draggable: false` をノードオブジェクトレベルで付与

`generateComponentChildren` でノード生成時に `selectable: false, draggable: false` を付与し、
React Flow のネイティブ機能で操作を抑制する。

**長所**: React Flow の仕組みに沿っており副作用が少ない。
**短所**: コンテキストメニューやラベル編集ダブルクリックの抑制は別途必要。エッジの `selectable: false` 付与も別途必要。

### 方針C: コンポーネント編集モードと同様に子ノードを `isLocked` 扱いにする

`isLocked` フラグを子ノードに付与し、既存のロック保護コードパスを再利用する。

**長所**: 既存コードの再利用。
**短所**: `isLocked` は "コンポーネント編集モードの Entry/Exit" という意味で使われており意味が混濁する。

---

## 推奨案: 方針A + 方針Bの組み合わせ

- **子ノード生成時（`generateComponentChildren`）**: `selectable: false, draggable: false` をノードに付与（方針B）
- **子エッジ生成時（`generateComponentChildren`）**: `selectable: false` をエッジに付与（方針B）
- **コンテキストメニュー（`FlowCanvas`）**: `componentParentId` を持つノードの右クリックを無視（方針A）
- **ラベル編集（`NodeLabel`）**: `isComponentChild` prop を追加し、ダブルクリックを無効化（方針A）
- **自動同期**: `exitComponentEditMode` の変更検知後に、全インスタンスを一括同期（方針A）
- **スケーリング統一**: `onNodesChange` の proportional scaling で `Math.min(scaleX, scaleY)` を使用

**理由**: `selectable: false / draggable: false` はReact Flowレベルで動作し確実に抑制できる。
コンテキストメニュー・ラベル編集は個別のUIイベント処理で抑制するため、2つを組み合わせることで
網羅的かつ副作用の少ない実装になる。

---

## 変更・追加ファイル

### 削除

- **削除**: `src/components/flowComponent/ComponentUpdatePopover.tsx`
  - `ComponentUpdatePopover` コンポーネントごと削除

### 変更

- **変更**: `src/lib/component-children.ts`
  - `generateComponentChildren` の子ノード生成に `selectable: false, draggable: false` を追加
  - 子エッジ生成に `selectable: false` を追加
  - `GenerateChildrenOptions` から `labelOverrides` パラメータを削除（廃止）
  - `label: n.label` のみ参照に変更（overrides 処理の除去）

- **変更**: `src/components/nodes/NodeLabel.tsx`
  - `isComponentChild?: boolean` prop を追加
  - `onDoubleClick` ハンドラで `isComponentChild` の場合も編集を開始しないよう条件追加
  - `isLocked` と同様に「ダブルクリックで編集開始しない」制御

- **変更**: `src/components/nodes/NodeWrapper.tsx`
  - `NodeLabel` への `isComponentChild` prop の受け渡し追加

- **変更**: `src/components/nodes/RectangleNode.tsx` および同形式の全ノードコンポーネント（8種）
  - `NodeWrapper` に `isComponentChild` を引き渡す既存の実装はそのまま維持（変更なし）
  - ただし `NodeWrapper` が `NodeLabel` への `isComponentChild` 受け渡しを追加するため、間接的に変更される

- **変更**: `src/components/canvas/FlowCanvas.tsx`
  - `onNodeContextMenu` コールバック: 右クリック対象ノードが `componentParentId` を持つ場合、コンテキストメニューを開かない
  - `onEdgeContextMenu` コールバック: ブリッジエッジ（`isBridgeEdge`）の場合、コンテキストメニューを開かない

- **変更**: `src/components/nodes/ComponentInstanceNode.tsx`
  - `updatePopoverOpen` state および `ComponentUpdatePopover` の import・使用を削除
  - `isOutdated` 計算ロジックを削除
  - ⚠️アイコン表示 JSX を削除（折りたたみ表示・展開表示の両箇所）
  - `ComponentUpdatePopover` の import を削除

- **変更**: `src/store/useFlowStore.ts`
  - `syncComponentInstance` アクション: `mode` パラメータを削除し、常に "all"（全更新）動作に変更
  - `dismissComponentUpdate` アクション: 削除
  - `updateComponentLabelOverride` アクション: 削除
  - `placeComponentInstance`: `componentLabelOverrides: {}` の初期化を削除
  - `exitComponentEditMode`: 定義変更時に全インスタンスの自動同期を追加
    - 変更ありかつ `version > 1` の場合、または新規で変更ありの場合: 全インスタンスを同期してから返す
    - 同期は既存の `syncComponentInstance` 相当のロジックを全インスタンスに対して実行
  - `onNodesChange` の proportional scaling: `scaleX` と `scaleY` の代わりに `Math.min(scaleX, scaleY)` で統一スケール計算
  - `generateComponentChildren` 呼び出し箇所から `labelOverrides` 引数を除去（`placeComponentInstance`、`syncComponentInstance`）

- **変更**: `src/store/types.ts`
  - `FlowState` から `updateComponentLabelOverride` を削除
  - `FlowState` から `dismissComponentUpdate` を削除
  - `syncComponentInstance` のシグネチャを `(nodeId: string) => void` に変更（`mode` 引数削除）

- **変更**: `src/types/flow.ts`
  - `FlowNodeData` から `componentLabelOverrides?: Record<string, string>` フィールドを削除

- **変更**: `src/lib/flowmaid/schema.ts`
  - `FlowmaidNodeLayout` から `componentLabelOverrides?: Record<string, string>` フィールドを削除

- **変更**: `src/lib/flowmaid/serialize.ts`
  - `componentLabelOverrides` の出力処理（lines 50-52 相当）を削除
  - `componentSyncVersion` の出力処理を削除（不要になるが、互換性のために残すかは要検討 → 削除推奨）

- **変更**: `src/lib/flowmaid/deserialize.ts`
  - `componentLabelOverrides` の読み込み処理（line 45 相当）を削除
  - `componentSyncVersion` の読み込み処理を削除
  - `generateComponentChildren` 呼び出し時の `labelOverrides` 引数を除去

- **変更**: `src/lib/flowmaid/__tests__/component-serialize.test.ts`
  - `componentLabelOverrides` を使ったテストケースを削除または修正
  - `componentSyncVersion` に関するアサーションを削除

---

## クラス設計

### `generateComponentChildren` の変更

```typescript
// 変更前
interface GenerateChildrenOptions {
  parentId: string;
  def: ComponentDefinition;
  labelOverrides?: Record<string, string>;
  hidden?: boolean;
}

// 変更後
interface GenerateChildrenOptions {
  parentId: string;
  def: ComponentDefinition;
  hidden?: boolean;
}
```

ノード生成部分:
```typescript
// 変更前（一部）
data: {
  label: labelOverrides[n.id] ?? n.label,
  ...
}

// 変更後
data: {
  label: n.label,
  ...
},
selectable: false,
draggable: false,
```

エッジ生成部分:
```typescript
// 変更後（selectable追加）
return {
  id: `${parentId}_${e.id}`,
  source: ...,
  target: ...,
  selectable: false,
  ...
};
```

### `exitComponentEditMode` の自動同期ロジック（概念）

```typescript
// 変更ありの場合、updatedDefs 確定後、main flow を復元する前にインスタンスを全同期
if (hasChanges) {
  const updatedDef = updatedDefs.find((d) => d.id === editingComponentId);
  if (updatedDef) {
    // savedMainFlow.nodes の中から該当定義のインスタンスノードをすべて抽出
    // 各インスタンスに対して子ノード再生成・サイズ更新を実施
    // ブリッジエッジも再調整
    savedMainFlow.nodes = syncAllInstancesForDef(savedMainFlow, updatedDef, updatedDefs);
    savedMainFlow.edges = reconcileBridgeEdges(...);
  }
}
```

### `onNodesChange` のスケーリング変更

```typescript
// 変更前
const scaleX = contentNewW / contentOldW;
const scaleY = contentNewH / contentOldH;

// 変更後（アスペクト比維持）
const scaleX = contentNewW / contentOldW;
const scaleY = contentNewH / contentOldH;
const scale = Math.min(scaleX, scaleY);  // 小さい方で統一

// 子ノード更新
position: {
  x: COMPONENT_PADDING + (n.position.x - COMPONENT_PADDING) * scale,
  y: COMPONENT_HEADER_HEIGHT + COMPONENT_PADDING + (n.position.y - COMPONENT_HEADER_HEIGHT - COMPONENT_PADDING) * scale,
},
style: {
  ...n.style,
  width: Math.round(childW * scale),
  height: Math.round(childH * scale),
},
```

---

## 注意事項・制約

### `selectable: false` と React Flow の挙動

React Flow の `selectable: false` を付与したノードは、クリック選択が無効になる。
ただし、`Ctrl+A` 全選択の挙動に影響があるか事前に確認が必要。
全選択で子ノードが選択されてしまう場合は、`onNodesChange` の `select` type change を
`componentParentId` 持ちノードに対してフィルタリングする対応が別途必要になる。

### コンテキストメニューの抑制

`onNodeContextMenu` で右クリック対象が子ノードの場合は `event.preventDefault()` のみ呼んで `openMenu` は呼ばない。
これにより、親インスタンスノード右クリック時のメニューは従来通り動作する。
エッジのコンテキストメニューも同様に、`isBridgeEdge` のエッジは無視する。

### `componentSyncVersion` フィールドの後方互換性

シリアライズファイルの後方互換のため、既存の `.flowmaid` ファイルに `componentSyncVersion` が含まれていても
デシリアライズ時に無視（読み飛ばし）するか、単にフィールドを読まないだけでよい。
型定義から削除することで TypeScript レベルでは参照されなくなる。

### 自動同期のタイミングと undo/redo

`exitComponentEditMode` では最後に `useFlowStore.temporal.getState().clear()` を呼んでいる。
自動同期は `clear()` の前に完結するため、undo/redo 履歴への影響はない。
（復帰後は新しい単一状態として扱われる）

### 既存テストへの影響

`componentLabelOverrides` を使った `component-serialize.test.ts` のテストが壊れる。
`componentSyncVersion` を検証するテストも修正が必要。
`syncComponentInstance` の `mode` 引数に関するストアテストも修正が必要。

### FormatBar での子ノード選択排除

現在 `FormatBar` は `allComponentChildren` が `true` の場合にフォーマットバーのノード用UIを非表示にしている。
子ノードが `selectable: false` になることで通常は選択されなくなるが、
ロジックは残しておいても害はないためそのままでよい。

### アスペクト比維持スケーリングの視覚的影響

`Math.min(scaleX, scaleY)` で統一すると、非均等リサイズ（幅だけ広げる等）の場合に
子ノードが親の内部に収まりきらず余白が生じるケースがある。
これは意図した動作（子ノードがはみ出さないことを優先）として許容する。

### `updateComponentLabelOverride` を呼んでいる箇所の確認

`FlowState` の `updateComponentLabelOverride` を外部から呼んでいる箇所がないか確認する。
現状の調査では `ComponentUpdatePopover` 以外での呼び出しは見当たらないが、
削除前に全文検索で確認すること。
