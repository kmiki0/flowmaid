# テキスト一括編集（BulkEdit）モード 仕様書

> **ステータス: 実装済み（Phase 2）** — このファイルは設計判断の記録として残しています。最新仕様は CLAUDE.md を参照してください。

## 概要

ヘッダーツールバーに「Bulk Edit」ボタンを追加し、クリックするとテキスト一括編集モードに切り替わる。
このモードではキャンバスプレビュー（左）とラベル編集テーブル（右）の2ペイン構成に切り替わり、
全ノード/エッジのラベルを一覧で素早く編集できる。

コンポーネント編集モード（`editingComponentId`）と同様に、`isBulkEditMode` フラグで画面全体のレイアウトを切り替える。
ただし状態はzustand storeではなくEditorLayout内のローカルstateで管理し、undo/redoへの副作用を回避する。

---

## 実装方針の選択肢

### 案A: zustand storeにisBulkEditModeフラグを追加する

- メリット: どのコンポーネントからでも状態参照できる
- デメリット: temporal（zundo）のundo/redo対象になりモードのon/offがundo可能になってしまう。`partialize`設定を変更する必要がある

### 案B: EditorLayoutのローカルstateで管理する（推奨）

- メリット: zustandのtemporal管理対象外になり、undo履歴を汚染しない。実装が局所的でシンプル
- デメリット: 深い子コンポーネントへの受け渡しにprop drillingまたはcontext化が必要だが、実際にisBulkEditModeを参照するのはEditorLayout直下のコンポーネント（Toolbar、BulkEditTableパネル）のみなので影響は小さい

### 案C: URLパラメータ or URLのhashで管理する

- メリット: ページリロードでモードが保持される
- デメリット: Next.js App Routerとの統合が必要で過剰設計。このプロジェクトには不要

**推奨: 案B**。
コンポーネント編集モードと異なり、BulkEditモードはストアデータを直接変更（ラベル更新）するが、モード自体のon/offはローカルstateで十分。EditorLayoutのprop経由でToolbar・BulkEditTableに渡す。

---

## 実装方針

### 画面切り替えの方針

コンポーネント編集モードの仕組み（`isEditingComponent`によりEditorLayoutがpaddingとbackground色を変更）を参考にする。

BulkEditモード中は以下を変更する:
1. **左CollapsiblePanel（Nodesタブ）を非表示** — `leftOpen`を強制falseに見せるか、条件付きレンダリングで非表示
2. **右MermaidPreviewパネルを非表示** — `rightOpen`相当を強制falseに見せる
3. **FormatBarを非表示** — BulkEditモード中は不要
4. **キャンバス（FlowCanvas）をプレビュー専用モードに** — nodesDraggable、nodesConnectable等を無効化したReadOnly ReactFlowを表示
5. **右ペインにBulkEditTableを表示** — ResizablePanelGroupで左右2ペインに分割

### キャンバスプレビューの方針

FlowCanvasを直接再利用すると、BulkEditモード時にもドラッグ・リサイズ等が発生してしまう。
以下の方針で対応する:

- `isBulkEditMode` プロパティをFlowCanvasに渡すのではなく、**BulkEditCanvas専用の軽量コンポーネントを新規作成する**
- 内部ではReactFlowを`nodesDraggable={false}` `nodesConnectable={false}` `elementsSelectable={false}`（行クリック時の選択は`fitView`のみ）でレンダリング
- ContextMenu・SnapGuides・DnD関係は含めない

ただし、テーブル行クリックで対応ノード/エッジをキャンバス上でフォーカス（fitView）する機能のため、`ReactFlowInstance`の`fitBounds`または`setCenter`を使う。カスタムイベント（`flowmaid:fitview`の既存パターン）を拡張し、`flowmaid:bulkedit:focusnode`イベントを新設する。

---

## 変更・追加ファイル

### 新規作成

| ファイルパス | 役割 |
|---|---|
| `src/components/bulkEdit/BulkEditTable.tsx` | 右ペインのラベル編集テーブル本体。ノードセクション・エッジセクションに分かれた2カラム表 |
| `src/components/bulkEdit/BulkEditCanvas.tsx` | 左ペインのプレビュー専用ReactFlowキャンバス。選択・ズームのみ可 |
| `src/components/bulkEdit/BulkEditNodeIcon.tsx` | ノード行の左カラム用SVGアイコン（形状＋スタイル反映） |
| `src/components/bulkEdit/BulkEditEdgeIcon.tsx` | エッジ行の左カラム用SVGアイコン（矢印＋strokeスタイル反映） |
| `src/components/bulkEdit/index.ts` | BulkEditコンポーネント群のバレルexport |

### 変更

| ファイルパス | 変更内容 |
|---|---|
| `src/components/layout/EditorLayout.tsx` | `isBulkEditMode` ローカルstateを追加。BulkEditモード時に左右パネルを非表示化、FormatBarを非表示化、キャンバス領域をBulkEdit2ペインレイアウトに差し替え |
| `src/components/layout/Toolbar.tsx` | BulkEditモード切替ボタン（テーブルアイコン）を追加。BulkEditモード中は「戻る」ボタンを表示。`onEnterBulkEdit` / `onExitBulkEdit` コールバックpropを追加 |
| `src/lib/i18n/locales.ts` | BulkEdit関連の翻訳キーを追加（後述） |

---

## クラス設計

### EditorLayout.tsx の変更点

```
const [isBulkEditMode, setIsBulkEditMode] = useState(false);

// Toolbar props追加
onEnterBulkEdit={() => setIsBulkEditMode(true)}
onExitBulkEdit={() => setIsBulkEditMode(false)}

// BulkEditモード時のレンダリング
{isBulkEditMode ? (
  <BulkEditLayout onExit={() => setIsBulkEditMode(false)} />
) : (
  // 既存の通常レイアウト
)}
```

BulkEditモード全体を `BulkEditLayout` コンポーネントにまとめるか、EditorLayout内にインラインで書くかは実装者の判断でよいが、既存の通常レイアウトとの干渉を避けるため**条件分岐による完全な差し替え**を推奨する。

### BulkEditTable.tsx の設計

```typescript
interface BulkEditTableProps {
  onFocusNode: (nodeId: string) => void;
  onFocusEdge: (edgeId: string) => void;
}

// 内部で useFlowStore から nodes, edges を取得
// updateNodeLabel / updateEdgeLabel を使ってリアルタイム更新
```

**テーブル構造**:

```
[ Nodes セクションヘッダー ]
[ SVGアイコン(形状+スタイル) | Input(ラベル) ]
[ SVGアイコン(形状+スタイル) | Input(ラベル) ]
...

[ Edges セクションヘッダー ]
[ 矢印SVG(strokeスタイル) + "A → B" | Input(ラベル) ]
...
```

**フィルタリング**:
- コンポーネントの子ノード（`componentParentId`が設定されているノード）はテーブルに表示しない
- ブリッジエッジ（`isBridgeEdge`）はテーブルに表示しない
- テキストノード（shape === "text"）は表示する（ラベルがそのままテキスト内容になるため）

**キーボードナビゲーション**:
- Tab / Shift+Tab: 次/前のInputフィールドへ移動（ノードセクションとエッジセクションをまたいで移動可）
- Enter: 次のInputフィールドへ移動（Tabと同じ動作）
- Escape: フォーカスを外す

**ラベル更新**:
- `onChange`でリアルタイムに`updateNodeLabel` / `updateEdgeLabel`を呼ぶ
- デバウンスなし（直接反映、キャンバスプレビューにも即時反映される）
- undo履歴に積まれるため、BulkEditモードを抜けた後もCtrl+Zで戻せる

### BulkEditNodeIcon.tsx の設計

NodePalette.tsxの既存SVGアイコン定義を参照し、形状に応じたSVGを描画する。
`fillColor`・`borderColor`・`borderWidth`・`borderStyle`をSVGのstyle/attributeとして反映する。

```typescript
interface BulkEditNodeIconProps {
  shape: NodeShape;
  fillColor?: string;
  fillOpacity?: number;
  fillLightness?: number;
  borderColor?: string;
  borderOpacity?: number;
  borderLightness?: number;
  borderWidth?: number;
  borderStyle?: BorderStyle;
}
// 出力: 32x32のSVG要素
// computeColor()を使って実際の描画色を計算する
```

### BulkEditEdgeIcon.tsx の設計

シンプルな横向き矢印SVG。strokeColor・strokeWidth・strokeStyle（dashed/dotted/solid）・markerEndを反映する。

```typescript
interface BulkEditEdgeIconProps {
  strokeColor?: string;
  strokeOpacity?: number;
  strokeLightness?: number;
  strokeWidth?: number;
  strokeStyle?: StrokeStyle;
  markerEnd?: MarkerStyle;
  markerStart?: MarkerStyle;
}
// 出力: 48x20のSVG要素（水平矢印）
```

### BulkEditCanvas.tsx の設計

```typescript
interface BulkEditCanvasProps {
  focusTarget: { type: "node" | "edge"; id: string } | null;
}

// ReactFlowをnodesDraggable=false等で初期化
// focusTargetが変化したらfitBounds / setCenter でフォーカス
// カスタムイベント不要（propsで制御）
```

ノード種別の表示: `nodeTypes`をそのまま流用できるが、ノードに渡す際に選択・ドラッグが発生しないよう`selectable={false}`を全ノードに設定する。ただしReactFlowの`nodeTypes`は既存のものを参照するだけなので新たな定義は不要。

---

## i18n追加キー

`src/lib/i18n/locales.ts` に以下を追加する:

```typescript
// BulkEdit
bulkEditMode: "Bulk Edit" / "一括編集",
exitBulkEdit: "Exit" / "終了",
bulkEditNodesSection: "Nodes" / "ノード",
bulkEditEdgesSection: "Edges" / "エッジ",
bulkEditEdgeConnection: "{source} → {target}" // テンプレート文字列ではなくコンポーネント側でフォーマット
```

実際のキー名はlocales.tsの命名規則に合わせる（キャメルケース）。

---

## 注意事項・制約

### undo/redoの挙動
- BulkEditモード中のラベル変更はundo履歴に積まれる（意図的）
- BulkEditモード自体のon/offはundo対象外（ローカルstate管理のため）
- zundoの`partialize`設定は変更不要

### コンポーネント編集モードとの排他
- `editingComponentId`が設定されている（コンポーネント編集モード中）場合、BulkEditボタンはdisabledにする
- Toolbarの`isBulkEditMode`と`isEditingComponent`を組み合わせて制御する

### autoSaveとの関係
- BulkEditモード中もautoSaveは動作させる（ラベル変更はメインフローのデータ変更であるため）
- コンポーネント編集モード（`editingComponentId`）とは異なり、autoSaveを止める必要はない

### パフォーマンス
- テーブルのInputはControlled Componentとして実装する（`value` + `onChange`）
- ノード/エッジ数が多い場合（100件以上）のパフォーマンスリスクは低い。フローチャートの性質上、100ノード超えは稀であるため仮想スクロール等は不要と判断する
- BulkEditCanvas内ではReactFlowのアニメーションが走るため、`nodesDraggable={false}`に加えて`panOnDrag={true}` `zoomOnScroll={true}`を維持する（プレビューとしてのナビゲーションは許可）

### ReactFlowProviderの重複
- EditorLayout全体は既存の`ReactFlowProvider`内にある
- BulkEditCanvas内でさらにネストされた`ReactFlowProvider`を使う場合、ReactFlowのisolated instanceになるためstoreとの接続が独立になる。これを利用して**BulkEditCanvas専用のReactFlowインスタンス**を作り、`nodes`/`edges`を`useFlowStore`から取得して読み取り専用でレンダリングする設計を推奨する
- この場合、focusTarget変化時のfitBoundsは内部の`useReactFlow()`で取得したinstanceを使う

### コンポーネントインスタンスの表示
- BulkEditテーブルでコンポーネントインスタンスノードは通常ノードと同様に表示する
- ラベルは`componentInstanceName`を表示・編集する（`updateComponentInstanceName`アクションを使用）
- 子ノード（`componentParentId`あり）はテーブルに表示しない

### エッジの表示順序
- ブリッジエッジ（`isBridgeEdge: true`）は除外する
- エッジは`source`ノードのテーブル順に並べることを基本とする

---

## 画面レイアウト（BulkEditモード）

```
+-------------------------------------------------------------+
|  Flowmaid  [Bulk Edit ← 押すとモード切替またはExitボタン]     |
+-----------------------------+-------------------------------+
|                             |  [ Nodes ]                    |
|  キャンバスプレビュー        |  [■] A  | [Input: 開始      ]  |
|  （ReactFlow ReadOnly）      |  [◆] B  | [Input: 条件分岐  ]  |
|                             |  [○] C  | [Input: 処理A     ]  |
|  ズーム・パンのみ可           |                               |
|                             |  [ Edges ]                    |
|  テーブル行クリックで         |  [→] A→B | [Input: Yes       ]  |
|  対象ノード/エッジを          |  [→] B→C | [Input:           ]  |
|  中央フォーカス              |                               |
|                             |  Tab/Enter で次の行へ          |
+-----------------------------+-------------------------------+
                ^
         ドラッグでリサイズ（ResizablePanelGroup）
```

デフォルトの左右分割比率: 左60% / 右40%
最小幅: 左30% / 右25%
