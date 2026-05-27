# ノードエディタモード 仕様書

## 概要

Flowmaidに「ノードエディタモード」を追加する。Blender のノードエディタに代表される、カード型ノードとポートによる接続を可能にするモードであり、以下の用途を主対象とする。

1. **マイクロサービスAPI連携図** — サービス間のAPI呼び出し関係を可視化
2. **データベースER図** — テーブル間のリレーションを可視化

既存のフローチャートモードとは独立したデータ・キャンバスを持つが、React Flow基盤・zustand・i18n・テーマ・保存/エクスポートの仕組みは共通化して再利用する。

---

## 実装方針の検討

### 案A: 既存の useFlowStore を拡張してモードフラグを追加する

- メリット: 追加コードが最小。既存ストアの Undo/Redo・コンポーネント機能を流用できる
- デメリット: FlowNodeData はフローチャート用の型構造（shape, borderStyle 等）に強く依存しており、ポート定義などノードエディタ独自フィールドを追加すると型の混在が避けられない。zundo の temporal 管理対象になり、undo履歴が複雑化する

### 案B: ノードエディタ専用の独立ストア + 独立キャンバスを新設する（**推奨**）

- メリット: データモデルをノードエディタ用に最適化できる。フローチャートのストア・型・直列化ロジックを汚染しない。モード切替は `EditorLayout` のローカル state として管理（BulkEdit/DiffMode と同じパターン）
- デメリット: ストア・シリアライザ・UI コンポーネントを別途実装する必要がある

### 案C: フローチャートモードのノードを拡張してカード型に見せる

- メリット: Mermaid生成の再利用が容易
- デメリット: ポートの概念がフローチャートのハンドル（4方向固定）と根本的に異なるため、見た目と動作の乖離が大きくなる。ノード形状もカード固定にする必要があり、既存 NodeWrapper との共存が困難

**推奨: 案B**。データ独立性・型安全性・既存コードへの影響最小化の観点から、専用ストアと専用キャンバスを新設する。EditorLayout のモード切替パターン（`isBulkEditMode` / `isDiffMode` と同列）に倣い、`isNodeEditorMode` ローカル state で管理する。

---

## データモデル設計

### 共通基盤設計方針

API連携図とER図は表示用途が異なるが、「ノード（カード）がポートを持ち、ポート間をエッジで接続する」という構造は共通である。**テンプレート方式**を採用し、ノードの種別（`nodeKind: "service" | "table" | "generic"`）によってカードの表示内容を切り替える。

### NodeEditor 型定義（新設: `src/types/nodeEditor.ts`）

```typescript
// ポートの方向
export type PortDirection = "input" | "output" | "bidirectional";

// ポートのデータ型（表示用ラベル）
export type PortDataType = string; // "string" | "number" | "boolean" | "object" | カスタム文字列

// 単一ポートの定義
export interface NodeEditorPort {
  id: string;           // ポートID（ノード内でユニーク）
  name: string;         // 表示名
  direction: PortDirection;
  dataType?: PortDataType;
  // ER図用フィールド
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  isNotNull?: boolean;
  isUnique?: boolean;
}

// ノードの種別
export type NodeEditorNodeKind = "generic" | "service" | "table";

// ノードエディタのノード本体
export interface NodeEditorNodeData {
  label: string;
  kind: NodeEditorNodeKind;
  ports: NodeEditorPort[];
  // スタイル（フローチャートと共通の色体系を再利用）
  fillColor?: string;
  fillOpacity?: number;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: "solid" | "dashed" | "dotted";
  fontSize?: number;
  textColor?: string;
  // サービスノード用メタ情報
  serviceUrl?: string;         // ベースURL
  description?: string;        // ノードの説明文
  // 内部フラグ
  isDeleting?: boolean;
  isNew?: boolean;
}

// エッジのカーディナリティ（ER図用）
export type Cardinality = "1:1" | "1:N" | "N:M" | "0:1" | "0:N";

// ノードエディタのエッジ本体
export interface NodeEditorEdgeData {
  label?: string;
  // 接続ポート情報
  sourcePortId?: string;       // 接続元ポートID
  targetPortId?: string;       // 接続先ポートID
  // スタイル
  strokeColor?: string;
  strokeWidth?: number;
  strokeStyle?: "solid" | "dashed" | "dotted";
  // API連携図用
  httpMethod?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  // ER図用
  cardinality?: Cardinality;
  relationLabel?: string;      // リレーション名（例: "has many"）
}

// ノードエディタのモード（将来の切替用）
export type NodeEditorSubMode = "generic" | "api-diagram" | "er-diagram";
```

### ストア型定義（新設: `src/store/useNodeEditorStore.ts`）

```typescript
// ノードエディタ専用の zustand ストア
interface NodeEditorState {
  nodes: NodeEditorNode[];   // Node<NodeEditorNodeData>
  edges: NodeEditorEdge[];   // Edge<NodeEditorEdgeData>
  subMode: NodeEditorSubMode;
  nextIdCounter: number;

  // Node actions
  addNode: (kind: NodeEditorNodeKind, position: { x: number; y: number }) => void;
  removeNodes: (ids: string[]) => void;
  updateNodeLabel: (id: string, label: string) => void;
  updateNodePorts: (id: string, ports: NodeEditorPort[]) => void;
  addPort: (nodeId: string, direction: PortDirection) => void;
  removePort: (nodeId: string, portId: string) => void;
  updatePort: (nodeId: string, portId: string, updates: Partial<NodeEditorPort>) => void;
  updateNodeStyle: (id: string, style: Partial<NodeEditorNodeData>) => void;
  duplicateNodes: (ids: string[]) => void;

  // Edge actions
  addEdge: (source: string, target: string, sourcePortId?: string, targetPortId?: string) => void;
  removeEdges: (ids: string[]) => void;
  updateEdgeData: (id: string, updates: Partial<NodeEditorEdgeData>) => void;

  // React Flow callbacks
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;

  // Sub-mode
  setSubMode: (mode: NodeEditorSubMode) => void;

  // State management
  loadState: (state: Partial<NodeEditorState>) => void;
  clearAll: () => void;
}
```

**注意**: zundo の `temporal` ラッパーも適用し、undo/redo（50履歴）を有効にする。ただし `isDeleting` / `isNew` フラグはパーシャライズから除外する。

---

## UI設計

### モード切替

ツールバー左上のアプリタイトルをクリックしてモードを切り替える。

- **フローチャートモード**: タイトル表示 = **Flowmaid**
- **ノードエディタモード**: タイトル表示 = **Nodemaid**

#### フリップアニメーション
- CSS 3D回転（`perspective` + `rotateX`）でカードが裏返るような演出
- クリック → 表面（現在のタイトル）が奥に回転 → 裏面（切替先のタイトル）が前面に現れる
- アニメーション時間: 0.4s〜0.5s、ease-in-out
- 実装: `transform-style: preserve-3d` + `backface-visibility: hidden` の表裏2要素

#### データの独立性
- 切替時のキャンバスデータは相互に独立して保持される（フローチャートの内容はノードエディタ側に影響しない）
- ツールバーは共通パーツ（`ToolbarCommon`）を使うが、モード固有ボタンはそれぞれのToolbarが持つ

### 決定事項

| 項目 | 決定内容 |
|---|---|
| エッジのデフォルト線種 | ベジェ（bezier） |
| ポートの接続方向制約 | 制約なし（input/output問わず自由に接続可能） |
| ファイル拡張子 | `.nodeeditor`（Flowmaidとは別アプリ感を出す） |
| モード切替UI | タイトルクリックで3Dフリップアニメーション |
| アプリ名 | フローチャート=Flowmaid / ノードエディタ=Nodemaid |

### 通常モード（ノードエディタ）の画面構成

```
+-------------------------------------------------------------+
|  [Nodemaid🔄] [Undo][Redo] [サブモード: 汎用|API連携|ER図]   |
+----------+-+------------------------------------------+--+--+
| [+ ノード]|◀|                                          |▶|  |
| サービス  | |   キャンバス（React Flow）                 | |  |
| テーブル  | |   カード型ノードをドラッグ配置              | | OU |
| 汎用      | |   ポート間をエッジで接続                   | | TP |
|           | |                                          | | UT |
| [選択中ノ | |                                          | |  |
|  ードの   | |                                          | |  |
|  ポート   | |                                          | |  |
|  編集パネ | |                                          | |  |
|  ル]      | |                                          | |  |
+----------+-+------------------------------------------+--+--+
            ^^リボン                                  リボン^^
```

- **左パネル**: ノードパレット（add ボタン一覧）+ 選択ノードのポート編集パネル（ポートの追加・削除・並び替え・名前/型/方向編集）
- **右パネル**: テキスト出力（erDiagram / PlantUML / JSON）
- **右パネルリボン**: フローチャートモードの MermaidPreview と同じ開閉メカニズムを流用

### カード型ノードの構造（`NodeEditorCardNode`）

```
+--------------------------------+  ← タイトルバー（fillColor で塗りつぶし）
| [種別アイコン]  サービス名       |    ダブルクリックでラベル編集
+---------------+----------------+
| ● input port  |                |  ← 入力ポート（左端にハンドル）
|   name: string|                |
| ● enabled: bool|               |
+---------------+                |  ← 区切り線（inputとoutputの間）
|               | result: object ●|  ← 出力ポート（右端にハンドル）
|               | error: string  ●|
+--------------------------------+
```

- 入力ポートは左側、出力ポートは右側（bidirectional は左右両方にハンドル）
- ポート行をホバーすると接続ハンドル（ドット）が表示される（フローチャートモードのハンドル表示と同じ条件）
- 右クリックでコンテキストメニュー（ノード削除・ポート追加・ラベル編集等）

### ER図ノードの構造（`kind: "table"`）

```
+--------------------------------+
|  [テーブルアイコン]  users      |  ← タイトルバー
+--------------------------------+
| 🔑 id         INT    NOT NULL  |  ← PK行（左端ハンドル）
| 🔗 org_id     INT    FK        |  ← FK行
|    name       VARCHAR NOT NULL |
|    email      VARCHAR UNIQUE   |
|    created_at DATETIME         |
+--------------------------------+
```

- フィールド行の左端が接続ハンドル（ポート）
- カーディナリティ表示はエッジのラベルまたはエッジ端点のマーカーで表現

### API連携図ノードの構造（`kind: "service"`）

```
+--------------------------------+
|  [APIアイコン]  UserService     |  ← タイトルバー
|  https://api.example.com       |  ← ベースURL（サブタイトル）
+-------------+------------------+
| ● (受信)    |                  |
|   POST /login|                 |
|   GET /users |                 |
+-------------+                  |
|             | GET /users   → ● |  ← エンドポイント（出力方向）
|             | POST /order  → ● |
+--------------------------------+
```

- 受信エンドポイント（input）は左側、呼び出し先（output）は右側
- HTTPメソッドはポート行にバッジ表示（`GET` = 緑、`POST` = 青、`PUT` = 橙、`DELETE` = 赤）

### ポート編集パネル（左パネル下部または選択時フォーマットバー）

選択中ノードが1つのとき、左パネル下部にポート編集UIを表示する。

```
選択中: UserService
-----------------------------------------
[+ 入力ポートを追加]  [+ 出力ポートを追加]

■ 入力ポート
  ● POST /login      [string]  [編集] [×]
  ● GET  /users      [object]  [編集] [×]

■ 出力ポート
  ● result           [object]  [編集] [×]
  ● error            [string]  [編集] [×]
```

---

## アーキテクチャ（ファイル構成）

### 設計方針: 折衷型分離

既存のフローチャートコードは**一切移動しない**（importパス変更ゼロ、テスト修正ゼロ、git履歴保持）。
ノードエディタは `src/features/node-editor/` に完全隔離する。
共通化が必要になった部分のみ `src/shared/` に抽出する（最初は最小限）。

```
src/
  components/     ← 既存のまま（フローチャート専用）
  store/          ← 既存のまま
  hooks/          ← 既存のまま
  lib/            ← 既存のまま
  features/
    node-editor/
      components/   ← ノードエディタUI
      store/        ← 独立zustandストア
      hooks/        ← ノードエディタ専用hooks
      lib/          ← シリアライズ、出力生成等
      types/        ← 型定義
  shared/
    components/     ← ToolbarCommon等、両モードで使う共通パーツ
```

### ノードエディタ新規ファイル

```
src/features/node-editor/types/index.ts
  - NodeEditorPort, NodeEditorNodeData, NodeEditorEdgeData の型定義
  - NodeEditorSubMode, Cardinality 等の列挙型

src/features/node-editor/store/useNodeEditorStore.ts
  - zustand + zundo による独立ストア
  - useFlowStore と独立（参照しない）

src/features/node-editor/store/types.ts
  - ストア型（NodeEditorState）の定義

src/features/node-editor/lib/serialize.ts
  - ノードエディタ状態を .nodeeditor 形式（YAML）にシリアライズ

src/features/node-editor/lib/deserialize.ts
  - .nodeeditor ファイルのデシリアライズ

src/features/node-editor/lib/schema.ts
  - NodeEditorFile, NodeEditorLayout の型定義

src/features/node-editor/lib/generateErDiagram.ts
  - erDiagram Mermaid 記法テキスト生成（pure function）

src/features/node-editor/lib/generateApiDiagram.ts
  - PlantUML シーケンス記法テキスト生成（pure function）

src/features/node-editor/lib/localStorage.ts
  - localStorage キー: "flowmaid-nodeeditor-state"
  - saveNodeEditorState / loadNodeEditorState

src/features/node-editor/components/NodeEditorLayout.tsx
  - ノードエディタモード全体のレイアウト
  - 左パネル（ノードパレット + ポート編集）+ キャンバス + 右パネル（テキスト出力）

src/features/node-editor/components/NodeEditorCanvas.tsx
  - ReactFlowProvider でラップされたキャンバス
  - カスタム nodeTypes に CardNode を登録

src/features/node-editor/components/CardNode.tsx
  - カード型ノードの React Flow カスタムノードコンポーネント
  - kind に応じて GenericCard / ServiceCard / TableCard を条件分岐でレンダリング

src/features/node-editor/components/GenericCard.tsx
  - 汎用カード（タイトル + 入力ポート + 出力ポート）

src/features/node-editor/components/ServiceCard.tsx
  - API連携図用カード（HTTPメソッドバッジ + エンドポイント）

src/features/node-editor/components/TableCard.tsx
  - ER図用カード（PK/FK/NOT NULL/UNIQUE 表示）

src/features/node-editor/components/PortRow.tsx
  - 各ポート行コンポーネント（ハンドル付き）

src/features/node-editor/components/PortEditPanel.tsx
  - 左パネル内のポート編集 UI

src/features/node-editor/components/NodeEditorPalette.tsx
  - 左パネルのノード追加パレット

src/features/node-editor/components/NodeEditorOutputPanel.tsx
  - 右パネルのテキスト出力（erDiagram / PlantUML / JSON）

src/features/node-editor/components/NodeEditorToolbar.tsx
  - ノードエディタモード専用ツールバー部分（サブモード切替等）
  - shared/components の共通パーツと組み合わせて表示

src/features/node-editor/hooks/useNodeEditorAutoSave.ts
  - ノードエディタ用の自動保存フック（useAutoSave と対称）
```

### 共通パーツ（shared/）

```
src/shared/components/ToolbarCommon.tsx
  - undo/redo ボタン、テーマ切替、言語切替など両モード共通のツールバー要素
  - 既存 Toolbar.tsx から抽出

src/shared/components/PanelRibbon.tsx
  - サイドパネルの開閉リボン（既に使われているパターンを共通化、必要に応じて）
```

### 変更ファイル（既存コードへの最小限の変更）

```
src/components/layout/EditorLayout.tsx
  - isNodeEditorMode: boolean ローカル state を追加
  - ノードエディタモード時は NodeEditorLayout をレンダリング

src/components/layout/Toolbar.tsx
  - 共通部分を shared/components/ToolbarCommon.tsx に抽出
  - フローチャート固有部分のみ残す
  - モード切替 UI を追加

src/lib/constants.ts
  - NODE_EDITOR_STORAGE_KEY = "flowmaid-nodeeditor-state" を追加

src/lib/i18n/locales.ts
  - ノードエディタ関連の翻訳キーを追加
  - 例: nodeEditorMode, addServiceNode, addTableNode, portName, portType 等
```

---

## 出力フォーマット

### ファイル形式: `.nodeeditor`（YAML ベース）

フローチャートの `.flowmaid` と並列の独立ファイル形式。構造は `--- meta ---` + `--- layout ---` の2セクション。

```yaml
--- meta ---
subMode: er-diagram
version: 1

--- layout ---
nodes:
  A:
    position: { x: 100, y: 100 }
    size: { width: 280, height: 160 }
    kind: table
    label: users
    ports:
      - id: p1
        name: id
        direction: output
        dataType: INT
        isPrimaryKey: true
      - id: p2
        name: name
        direction: output
        dataType: VARCHAR
        isNotNull: true
  B:
    position: { x: 500, y: 100 }
    size: { width: 280, height: 140 }
    kind: table
    label: orders
    ports:
      - id: p1
        name: id
        direction: output
        dataType: INT
        isPrimaryKey: true
      - id: p2
        name: user_id
        direction: output
        dataType: INT
        isForeignKey: true
edges:
  A-p1-B-p2:
    source: A
    sourcePortId: p1
    target: B
    targetPortId: p2
    cardinality: "1:N"
    relationLabel: has many
```

### erDiagram 出力（Mermaid）

ER図サブモード時のテキスト出力。右パネルに表示しコピー可能。

```
erDiagram
    users {
        INT id PK
        VARCHAR name
        VARCHAR email
        DATETIME created_at
    }
    orders {
        INT id PK
        INT user_id FK
        DATETIME created_at
    }
    users ||--o{ orders : "has many"
```

### PlantUML シーケンス記法（API連携図サブモード）

```
@startuml
participant UserService
participant OrderService
participant PaymentService

UserService -> OrderService : POST /orders
OrderService -> PaymentService : POST /charge
PaymentService --> OrderService : 200 OK
OrderService --> UserService : 201 Created
@enduml
```

### JSON出力（全サブモード共通）

ノード・エッジのデータを JSON で出力。外部ツールとの連携用。

```json
{
  "nodes": [...],
  "edges": [...]
}
```

---

## 段階的実装計画

### Phase 1: データ基盤と汎用カードノード

**目標**: ノードエディタモードに切替でき、汎用カード型ノードを配置・接続できる状態

1. `src/types/nodeEditor.ts` の型定義作成
2. `src/store/useNodeEditorStore.ts` の独立 zustand ストア作成（zundo 有効）
3. `src/lib/nodeEditor/schema.ts` と `localStorage.ts` の実装
4. `src/components/nodeEditor/GenericCard.tsx` + `PortRow.tsx` の実装
5. `src/components/nodeEditor/NodeEditorCanvas.tsx` の実装
6. `src/components/nodeEditor/NodeEditorLayout.tsx` の最小実装（左パネル省略・右パネル省略）
7. `EditorLayout.tsx` にモード切替 state を追加し、ノードエディタ時は `NodeEditorLayout` に差し替え
8. `Toolbar.tsx` にモード切替 UI を追加
9. `useNodeEditorAutoSave` フックの実装

### Phase 2: ポート編集 UI とスタイル

**目標**: ポートを追加・削除・編集でき、カードのスタイルを変更できる

1. `PortEditPanel.tsx` の実装（左パネル下部への配置）
2. `NodeEditorPalette.tsx` の実装（ノード種別ごとの追加ボタン）
3. カードのスタイル変更 UI（塗りつぶし色・枠線色）
4. ポートのドラッグ並べ替え（react-beautiful-dnd または dnd-kit）
5. ノードの削除アニメーション（フローチャートモードと同じ `isDeleting` パターンを流用）

### Phase 3: ER図サブモード

**目標**: ER図に特化した `TableCard` と erDiagram 出力が動作する

1. `TableCard.tsx` の実装（PK/FK/NOT NULL/UNIQUE バッジ）
2. エッジのカーディナリティ設定 UI
3. `generateErDiagram.ts` の実装
4. `NodeEditorOutputPanel.tsx` の実装（右パネル・erDiagram テキスト表示）
5. `.nodeeditor` ファイルのエクスポート/インポート（ExportDialog の拡張または新規ダイアログ）

### Phase 4: API連携図サブモード

**目標**: API連携図に特化した `ServiceCard` と PlantUML 出力が動作する

1. `ServiceCard.tsx` の実装（HTTPメソッドバッジ・エンドポイントポート）
2. エッジの HTTPメソッド設定 UI
3. `generateApiDiagram.ts` の実装（PlantUML シーケンス）
4. `NodeEditorOutputPanel.tsx` へのタブ追加（erDiagram / PlantUML / JSON 切替）

### Phase 5: 仕上げ・UX改善

1. キーボードショートカット対応（Ctrl+Z/Ctrl+C/Ctrl+V 等）
2. ノードの整列・等間隔分布（フローチャートモードのロジック再利用可能な部分を抽出）
3. スナップガイド（`useSnapGuides` の再利用可否を要検討）
4. ミニマップ表示
5. コンテキストメニュー（`ContextMenu.tsx` を参考に新設または拡張）
6. i18n 対応の全キー追加

---

## 注意事項・制約

### React Flow ハンドルの扱い

フローチャートモードでは各ノードに固定4方向のハンドルを配置しているが、ノードエディタモードではポートごとに動的にハンドルを生成する。ハンドル ID はポート ID と方向の組み合わせ（例: `port-p1-source`）とし、エッジの `sourceHandle` / `targetHandle` に記録する。

ポートが増減した際の既存エッジの整合性チェックが必要（削除されたポートに接続されているエッジは自動的に削除する）。

### フローチャートモードとの完全分離

- `useFlowStore` はノードエディタストアから参照しない
- `useNodeEditorStore` はフローチャートストアから参照しない
- `EditorLayout` だけが両方のストアを知る立場（ただし直接参照せずカスタムフック経由）

### undo/redo の スコープ

ノードエディタモードの undo/redo はフローチャートモードの履歴と完全に独立する。モード切替時に相手モードの undo 履歴はクリアしない（保持する）。

### localStorage キーの分離

| キー | 用途 |
|------|------|
| `flowmaid-state` | フローチャートモードの状態（既存） |
| `flowmaid-nodeeditor-state` | ノードエディタモードの状態（新規） |
| `flowmaid-editor-mode` | 現在のエディタモード（`"flowchart"` or `"node-editor"`）|

### ポート接続のバリデーション

- 同じノードのポート間は接続不可
- 同一ポートへの複数接続は許可（1つのポートから複数エッジが出ることを許容）
- `direction: "input"` のポートをソースにするエッジは警告表示（接続自体は許可、ER図では双方向の場合があるため）

### カードのリサイズ

ポート数が増えた場合にカードの高さが自動拡張する。ユーザーが手動でリサイズした場合は手動サイズを優先し、ポート数による自動拡張は行わない（ユーザー指定サイズを `data.size` に保持する）。

### Mermaid 出力の制限

- 汎用カード（`kind: "generic"`）は erDiagram にも PlantUML にも変換できない
- API連携図（`kind: "service"`）から erDiagram への変換はサポートしない
- サブモードと実際の kind が混在した場合は出力時に警告を出す（変換できないノードはスキップ）

---

## 未決定事項

| 項目 | 現状 | 検討が必要な点 |
|------|------|----------------|
| ツールバー共通化 | **決定: 案C** — 共通部分を `shared/components/ToolbarCommon.tsx` に抽出し、フローチャート用 `Toolbar.tsx` とノードエディタ用 `NodeEditorToolbar.tsx` の両方から利用する | 既存 Toolbar からの抽出タイミングは Phase 1 |
| エクスポートダイアログ | 既存 `ExportDialog` を `.nodeeditor` にも対応させる案と、新規ダイアログを作る案がある | 拡張案では現在のダイアログがフローチャート専用の設計になっており、改修コストが大きい |
| ポート並べ替え | dnd-kit か react-beautiful-dnd か React Flow 内の drag か | Phase 2 の実装時に決定 |
| エッジの接続制約 | input ポートにのみ接続できる方向制約を課すか、制約なしにするか | ER図では bidirectional が多いため、Phase 3 の実装時に検討 |
| PlantUML のシーケンス生成ロジック | エッジの方向から自動的に参加者とメッセージを推論する必要がある。ループ・分岐の扱いが複雑 | Phase 4 の実装時に詳細設計 |
| フローチャートと同じコンテキストメニューを再利用するか | `ContextMenu.tsx` は `useFlowStore` に依存している | ノードエディタ用の独立したコンテキストメニューを新設するのが安全 |
| スナップガイドの再利用 | `useSnapGuides.ts` はノードの bounds 計算に `useFlowStore` ではなく React Flow の `useReactFlow` を使用しているため、再利用しやすい可能性がある | Phase 5 の実装時に要調査 |
| ER図のリレーション名 | エッジのラベルとして表示するか、専用フィールド `relationLabel` を持つか | 現在は `relationLabel` を専用フィールドとして設計しているが、ラベルと重複する懸念あり |
