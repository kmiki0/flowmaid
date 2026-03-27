# 差分比較機能 仕様書

## 概要

2つの `.flowmaid` ファイル（または現在の編集内容）をインポートし、ベース（旧バージョン）と比較先（新バージョン）の差分をビジュアルとテキストで提示する機能。
バージョン管理・レビュー用途を主目的とし、BulkEditモードと同様のページ切替式モードとして実装する。

画面は2ステップ構成:
- **Step 1**: インポート画面（ファイル選択）
- **Step 2**: 差分比較画面（キャンバス差分 + テキスト差分）

---

## 実装方針

### 案A: zustand storeにモードフラグを追加する

- メリット: どのコンポーネントからでも状態参照できる
- デメリット: zundo の temporal 管理対象になり、undo 履歴を汚染する。`partialize` 設定の変更が必要

### 案B: EditorLayout のローカル state で管理する（**推奨**）

- メリット: BulkEditモードと同一パターン。zustand の undo/redo 履歴を汚染しない。実装が局所的でシンプル
- デメリット: 深い子コンポーネントへの受け渡しに props が必要だが、参照するのは EditorLayout 直下のコンポーネントのみで影響は小さい

### 案C: URLパラメータで管理する

- メリット: ページリロードでモードが保持される
- デメリット: Next.js App Router との統合が必要で過剰設計

**推奨: 案B**。BulkEditモードと同一の設計パターン（`isBulkEditMode` → `isDiffMode`）を採用し、`EditorLayout` のローカル state として管理する。差分比較はストアデータを変更しない読み取り専用モードのため、副作用ゼロで実装できる。

---

## 画面遷移

```
通常モード
  → [差分比較ボタン]
    → Step 1（インポート画面）
      → [← 戻る]
        → 通常モード
      → [比較実行]
        → Step 2（差分比較画面）
          → [← 戻る]
            → Step 1（インポート画面）
```

`isDiffMode` ローカル state で Step 1 / Step 2 を管理し、`diffStep: "import" | "compare"` で現在のステップを保持する。

---

## Step 1: インポート画面

### レイアウト

```
+-------------------------------------------------------------+
|  ツールバー  [← 戻る] [一括編集]  [差分比較]                  |
+----------------------------+||+------------------------------+
|                            |||                              |
|  ベース（旧）               |||  比較先（新）                 |
|                            |||                              |
|  [ファイルを選択]           |||  [ファイルを選択]             |
|   またはドラッグ&ドロップ    |||   またはドラッグ&ドロップ     |
|                            |||                              |
|  [現在の編集内容を使用]     |||                              |
|  ※キャンバスに内容ある時のみ |||                              |
|                            |||                              |
|         [クリア]           |||         [クリア]              |
|                            |||                              |
+----------------------------+||+------------------------------+
|                    [比較実行]                                |
+-------------------------------------------------------------+
```

### 仕様詳細

| 項目 | ベース（左） | 比較先（右） |
|------|------------|------------|
| ファイル選択ボタン | あり | あり |
| ドラッグ&ドロップ | あり | あり |
| 「現在の編集内容を使用」ボタン | あり（メインキャンバスに内容がある場合のみ） | なし |
| クリアボタン | あり | あり |

- ファイル選択後: エリア内にファイル名を表示（例: `flowchart_v1.flowmaid [クリア]`）
- クリアボタン: 選択状態をリセットしデフォルト表示に戻す
- 「比較実行」ボタン: 左右両方が選択されるまで `disabled`

---

## Step 2: 差分比較画面

### レイアウト

```
+-------------------------------------------------------------+
|  ツールバー  [← 戻る]                [フィルタ ☑☑☑☑]        |
+-------------------------------+||+---------------------------+
|                               |||                           |
|  キャンバス差分表示            |||  git diff 風テキスト差分   |
|  （ベースをレンダリング +     |||                           |
|    差分ハイライト）            |||  - label: 開始            |
|                               |||  + label: スタート         |
|  ┌─ 変更 ──────────┐          |||                           |
|  │  ノードA (黄点線) │         |||  + ノードC (追加)          |
|  └─────────────────┘          |||  - ノードX (削除)          |
|                               |||                           |
|  ┌─ 追加 ──┐                  |||                           |
|  │ C (緑)  │                  |||                           |
|  └─────────┘                  |||                           |
|  ┌─ 削除 ──────┐              |||                           |
|  │ X (赤,半透明)│              |||                           |
|  └─────────────┘              |||                           |
+-------------------------------+||+---------------------------+
```

左右パネルの境界はドラッグで自由にリサイズ可能。デフォルト分割比率は 左60% / 右40%。

### フィルタ（ツールバー内チェックボックス）

ツールバー右側に配置。チェックを外すとその差分種別をキャンバス・テキスト両方から非表示にする。

- ☑ エッジの差分
- ☑ テキストの差分（ラベル変更）
- ☑ 位置移動の差分
- ☑ スタイル変更の差分

---

### 左ペイン: キャンバス差分表示

- **読み取り専用**（ドラッグ・接続・リサイズ不可）、パン・ズームのみ可能
- ベースファイルのレイアウトをそのまま基準に描画
- 差分箇所を点線の囲みとラベルでハイライト表示
- `DiffCanvas` 専用の読み取り専用 ReactFlow コンポーネントとして実装（BulkEditCanvas と同様のアプローチ）

#### 差分ハイライト表示

点線の囲みで差分単位を表示し、囲みの左上にラベル（「追加」「変更」「削除」「移動」）を付ける。

- **基本**: ノード/エッジ単位で個別の囲みを描画
- **グルーピング**: 変更ノード同士が互いに 100px 以内に近接している場合、まとめてエリア囲みにグルーピングする

#### 色分け

| 差分種別 | 囲み点線色 | ノード/エッジの表示 | ラベル |
|---------|-----------|------------------|--------|
| 追加 | 緑（`#22c55e`） | 比較先の位置に通常表示 | 追加 |
| 削除 | 赤（`#ef4444`） | ベースの位置に半透明（opacity: 0.4）で表示 | 削除 |
| 変更 | 黄（`#eab308`） | 通常表示 | 変更 |
| 移動 | 青（`#3b82f6`） | 移動前の位置に半透明、移動先に通常表示 | 移動 |
| 未変更 | なし | 通常表示 | — |

#### コンポーネントインスタンスの扱い

- キャンバス差分表示では親コンポーネントインスタンスノードを単一ノードとして表示（内部を展開しない）
- 内部の詳細差分は右テキスト差分パネルで確認する
- 親ノード自体に変更・追加・削除・移動があれば、通常ノードと同じルールでハイライト

---

### 右ペイン: テキスト差分

- `.flowmaid` の `--- layout ---` セクション（YAML）をベースに git diff 風フォーマットで表示
- `+` 行は緑、`-` 行は赤で色分け
- コンポーネント内部の詳細差分もここで展開表示
- **テキスト差分の項目クリック** → 左キャンバスの該当ノード/エッジが数回点滅する（フォーカス移動はしない）

#### 表示構造（例）

```
[+] ノードC  追加
    shape: rectangle
    label: "新しい処理"
    position: { x: 300, y: 200 }

[~] ノードA  変更
  - label: "開始"
  + label: "スタート"

[~] ノードB  移動
  - position: { x: 100, y: 50 }
  + position: { x: 150, y: 80 }

[-] ノードX  削除
    label: "旧処理"
```

---

## 差分検出ロジック

### ノードの差分検出

マッチングキー: **ノードID**（`FlowmaidLayout.nodes` のキー）

| 条件 | 差分種別 |
|------|---------|
| ベースにのみ存在 | 削除 |
| 比較先にのみ存在 | 追加 |
| 両方に存在し `position` が異なる（かつ他プロパティが同一） | 移動 |
| 両方に存在し `label` / `shape` が異なる | 変更（テキストフィルタで制御） |
| 両方に存在し `fillColor` / `borderColor` / `borderWidth` 等スタイルが異なる | 変更（スタイルフィルタで制御） |
| 両方に存在し `position` も内容も同一 | 未変更 |

位置移動とテキスト/スタイル変更が同時に発生している場合は「変更」として扱い、テキスト差分で位置変化も記録する。

### エッジの差分検出

マッチングキー: `source + "-" + target + "-" + sourceHandle + "-" + targetHandle`（エッジIDではなく接続の組み合わせでマッチング）

| 条件 | 差分種別 |
|------|---------|
| ベースにのみ存在 | 削除 |
| 比較先にのみ存在 | 追加 |
| 両方に存在し `label` / `edgeType` が異なる | 変更 |
| 両方に存在しスタイル（`strokeColor` 等）が異なる | 変更（スタイルフィルタで制御） |

エッジフィルタが無効の場合、エッジの差分はキャンバス・テキスト両方から非表示にする。

### コンポーネント定義の差分検出

マッチングキー: **定義ID**（`componentDefinitions[].id`）

- 定義が追加/削除された場合: そのインスタンスを追加/削除として扱う
- 定義の内部ノード・エッジが変更された場合: インスタンスノードを「変更」としてハイライト
- 内部詳細はテキスト差分パネルで展開表示

---

## 変更・追加ファイル

### 新規作成

| ファイルパス | 役割 |
|------------|------|
| `src/components/diffComparison/DiffImportPanel.tsx` | Step 1 のファイル選択 UI（左右の選択エリア＋比較実行ボタン） |
| `src/components/diffComparison/DiffCanvas.tsx` | Step 2 左ペイン。読み取り専用 ReactFlow。差分ノード/エッジをオーバーレイ表示 |
| `src/components/diffComparison/DiffTextPanel.tsx` | Step 2 右ペイン。git diff 風テキスト差分表示。項目クリックで点滅イベント発火 |
| `src/components/diffComparison/DiffFilterBar.tsx` | ツールバー内に埋め込むフィルタチェックボックス群 |
| `src/components/diffComparison/index.ts` | バレル export |
| `src/lib/diff/computeDiff.ts` | 差分検出ロジック（pure function）。`FlowmaidFile` x2 を受け取り `DiffResult` を返す |
| `src/lib/diff/types.ts` | `DiffResult` / `NodeDiff` / `EdgeDiff` / `DiffKind` の型定義 |
| `src/lib/diff/formatTextDiff.ts` | `DiffResult` を git diff 風テキスト行配列に変換する pure function |

### 変更

| ファイルパス | 変更内容 |
|------------|---------|
| `src/components/layout/EditorLayout.tsx` | `isDiffMode` / `diffStep` / `diffBase` / `diffCompare` ローカル state を追加。diff モード時に左右パネルを非表示化し `DiffImportPanel` または `DiffCanvas + DiffTextPanel` に切り替え。`handleEnterDiffMode` / `handleExitDiffMode` / `handleRunDiff` を追加 |
| `src/components/layout/Toolbar.tsx` | 差分比較ボタン（`GitCompare` アイコン）を追加。`isDiffMode` / `onEnterDiffMode` / `onExitDiffMode` props を追加。diff モード中は一括編集ボタンを非表示 |
| `src/lib/i18n/locales.ts` | 差分比較関連の翻訳キーを追加（後述） |

---

## クラス設計

### 型定義（`src/lib/diff/types.ts`）

```typescript
export type DiffKind = "added" | "deleted" | "modified" | "moved" | "unchanged";

export interface NodeDiff {
  kind: DiffKind;
  nodeId: string;
  baseNode?: FlowmaidNodeLayout;
  compareNode?: FlowmaidNodeLayout;
  changedFields: string[]; // 変更されたフィールド名のリスト
}

export interface EdgeDiff {
  kind: DiffKind;
  edgeId: string; // マッチングキー文字列
  baseEdge?: FlowmaidEdgeLayout;
  compareEdge?: FlowmaidEdgeLayout;
  changedFields: string[];
}

export interface ComponentDefDiff {
  kind: DiffKind;
  defId: string;
  changedFields: string[];
}

export interface DiffResult {
  nodeDiffs: NodeDiff[];
  edgeDiffs: EdgeDiff[];
  componentDefDiffs: ComponentDefDiff[];
}
```

### `computeDiff` 関数（`src/lib/diff/computeDiff.ts`）— 実装済み

```typescript
export function computeDiff(base: FlowmaidLayout, compare: FlowmaidLayout): DiffResult
```

純粋関数として実装済み。`FlowmaidLayout` を直接比較（React Flow内部状態に依存しない）。

### EditorLayout の変更点 — 実装済み

```typescript
// ローカル state（useRef パターンで依存配列安定化済み）
const [isDiffMode, setIsDiffMode] = useState(false);
const [diffStep, setDiffStep] = useState<"import" | "compare">("import");
const [diffBaseLayout, setDiffBaseLayout] = useState<FlowmaidLayout | null>(null);
const [diffCompareLayout, setDiffCompareLayout] = useState<FlowmaidLayout | null>(null);
const [diffFilters, setDiffFilters] = useState<DiffFilters>(DEFAULT_DIFF_FILTERS);
const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
const [diffFlashTarget, setDiffFlashTarget] = useState<{ id: string; seq: number } | null>(null);
```

### DiffCanvas の設計 — 実装済み

```typescript
interface DiffCanvasProps {
  baseLayout: FlowmaidLayout;
  compareLayout: FlowmaidLayout;
  diffResult: DiffResult;
  filters: DiffFilters;
  flashTarget: { id: string; seq: number } | null; // seq でリトリガー可能
  onExit: () => void;
}
```

- `BulkEditCanvas` と同様に独立した `ReactFlowProvider` を持つ
- ベースファイルのノード/エッジを `useMemo` で FlowNode/FlowEdge に変換（イミュータブル）
- 追加ノードは `diffResult.nodeDiffs` から取得し比較先の位置に表示
- 削除ノードはベースの位置に残し `opacity: 0.4` で半透明表示
- 移動ノードは旧位置に半透明、新位置に通常表示
- 差分ハイライトは `useViewport` で座標変換した SVG オーバーレイで点線囲み+ラベルを描画
- 点滅は `flashTarget.seq` の変化で `useEffect` をトリガー（`setTimeout` 不使用）

### DiffTextPanel の設計 — 実装済み

```typescript
interface DiffTextPanelProps {
  diffResult: DiffResult;
  filters: DiffFilters;
  onItemClick: (targetId: string, targetType: "node" | "edge" | "componentDef") => void;
}
```

- `formatTextDiff(diffResult, filters)` でテキスト行配列を生成して表示
- 各行は `targetId` / `targetType` / `diffKind` を持ち、クリック時に `onItemClick` を呼ぶ
- ヘッダー行の色は `diffKind` フィールドで判定（文字列マッチ不使用、多言語安全）

---

## i18n 追加キー

`src/lib/i18n/locales.ts` に以下のキーを追加する（実際のキー名は既存の命名規則に従う）:

```typescript
// 差分比較
diffCompareMode: "差分比較" / "Compare",
diffSelectBase: "ベース（旧）" / "Base (Old)",
diffSelectCompare: "比較先（新）" / "Compare (New)",
diffSelectFile: "ファイルを選択" / "Select File",
diffUseCurrentCanvas: "現在の編集内容を使用" / "Use Current Canvas",
diffClear: "クリア" / "Clear",
diffRunCompare: "比較実行" / "Run Comparison",
diffFilterEdges: "エッジの差分" / "Edge Changes",
diffFilterText: "テキストの差分" / "Text Changes",
diffFilterPosition: "位置移動の差分" / "Position Changes",
diffFilterStyle: "スタイル変更の差分" / "Style Changes",
diffKindAdded: "追加" / "Added",
diffKindDeleted: "削除" / "Deleted",
diffKindModified: "変更" / "Modified",
diffKindMoved: "移動" / "Moved",
```

---

## 注意事項・制約

### autoSave との関係

- 差分比較モード中はメインキャンバスの autoSave を **停止しない**（モードは読み取り専用で store を変更しないため）
- `useAutoSave` はそのまま動作させる

### コンポーネント編集モードとの排他

- `editingComponentId` が設定されている（コンポーネント編集モード中）場合、差分比較ボタンは `disabled`
- BulkEdit モードと差分比較モードは相互排他（同時には入れない）

### undo/redo との関係

- 差分比較モード中はストアデータを変更しないため、undo/redo は影響を受けない
- モード切り替え自体は undo 対象外（ローカル state のため）

### パフォーマンス

- `computeDiff` はファイルロード時（比較実行ボタン押下時）に1回だけ実行し、結果をローカル state にキャッシュする
- フィルタ変更時は再計算せず、`diffResult` を `useMemo` でフィルタリングして表示を切り替える
- キャンバス上の点線オーバーレイは React Flow の `Panel` を使い、ノード数に比例したレンダリングコストを避ける設計を検討すること

### DiffCanvas と BulkEditCanvas の設計共通化

- 両者とも「読み取り専用 ReactFlow + 独立 ReactFlowProvider」のパターンを持つ
- 将来的に共通 `ReadOnlyCanvas` ベースコンポーネントへのリファクタリングが可能だが、現フェーズでは個別実装とし重複を許容する

### .flowmaid パース

- ベース・比較先のファイルパースには既存の `deserialize` 関数を使用するが、差分比較は `FlowmaidFile`（`FlowmaidLayout` のみ）を比較対象とする
- `deserialize` が返す `FlowNode[]` ではなく `FlowmaidLayout` を直接比較することで、React Flow 固有の内部状態（`selected` 等）の影響を受けない純粋な比較が可能になる
- `src/lib/flowmaid/deserialize.ts` に `parseLayoutOnly(content: string): FlowmaidLayout` を追加済み（nullチェック付き）

---

## 関連ドキュメント

- [CLAUDE.md](../CLAUDE.md) — 差分比較モードの画面構成・差分検出カテゴリの原仕様
- [specs/bulk-edit.md](./bulk-edit.md) — BulkEdit モードの設計（実装パターンの参考）
- [specs/performance-optimization.md](./performance-optimization.md) — パフォーマンス最適化パターン
