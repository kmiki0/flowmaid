# subgraph（視覚的グループ）仕様書

## 概要

Mermaidの `subgraph ... end` 構文を、「コンポーネント」とは別の概念である「視覚的グループ」として取り込み・表示・出力する機能。

### コンポーネントとの違い

| 観点 | subgraph（視覚的グループ） | コンポーネント（既存） |
|---|---|---|
| 目的 | 複数ノードの視覚的グループ化 | 再利用可能テンプレート |
| 内部ノードの編集 | キャンバス上で直接編集可 | 専用編集モードが必要 |
| Start/End | なし | あり（ロックされた Entry/Exit） |
| 外部エッジ接続 | 子ノードに直接接続 | ブリッジエッジ経由 |
| 折りたたみ | なし（将来課題） | あり |
| React Flowの `parentId` | 使用する | 使用する |

### スコープ（今回）

- Mermaid import 時に subgraph を正しく取り込む（`parseMermaid` の変更）
- subgraph ノードとその子ノードを React Flow の parentId 親子関係で表現
- 外部エッジを子ノードに直接接続（リマップ）
- subgraph のネスト対応
- Mermaid 出力（generate.ts）で `subgraph ... end` として再出力
- `.flowmaid` シリアライズ・デシリアライズ対応

UIからの手動 subgraph 作成は今回のスコープ外。

---

## 実装方針

### 方針A: subgraph を「グループノード」として React Flow の parentId 親子で表現（推奨）

subgraph をコンテナノード（`type: "subgraphGroup"`）として作成し、子ノードに `parentId` を設定する。子ノードはキャンバス上で直接選択・ドラッグ・編集が可能。React Flow の標準的な子ノード機能をそのまま活用できる。

**利点**
- React Flow の親子関係（`parentId` + `extent: "parent"`）を使うため、グループ移動が標準挙動で動く
- 子ノードをその場で編集可能（専用モード不要）
- コンポーネントとは独立した概念として設計できる
- Mermaid 出力が素直（subgraph ブロックに子ノードを列挙するだけ）

**欠点**
- 子ノードのサイズ・位置が subgraph 親に対して相対座標になる（パース時にオフセット計算が必要）
- `extent: "parent"` を付けると子ノードが親の枠外に出せなくなる（グループリサイズ時に問題）

### 方針B: subgraph を ComponentDefinition と同じデータ構造で表現

既存の ComponentDefinition 型を再利用し、`entryNodeId: null / exitNodeId: null` でブリッジなし・直接接続モードの「subgraph型コンポーネント」として扱う。

**利点**
- 既存のシリアライズ・デシリアライズロジックをそのまま流用できる

**欠点**
- 「コンポーネント編集モードへの切替が必要」という制約も引き継いでしまう
- 設計思想が違うものを同じ構造に無理やり収めることになる
- `entryNodeId: null` の特例分岐が至るところに入り、既存コードの複雑性が増す

### 方針C: 子ノードを独立したトップレベルノードとして持ち、subgraph は枠のみのオーバーレイで表現

子ノードを親なしのトップレベルノードとして管理し、`subgraphGroupId` フィールドで所属グループを示す。subgraph 枠は別レイヤーの SVG オーバーレイで描画する。

**利点**
- 子ノードのドラッグ・編集が最も自由
- `extent: "parent"` の制約がない

**欠点**
- グループ移動時に「グループ枠と全子ノードをまとめて動かす」カスタムロジックが必要
- 子ノードの所属判定が複雑
- React Flow の標準機能から外れる

### 推奨案: 方針A

React Flow の `parentId` 親子関係を使う方針A を採用する。理由：

1. React Flow の標準的なグループノード機能（`parentId`）を使うことで、グループ全体の移動が自動的に動く
2. 子ノードをキャンバス上でそのまま編集できる（subgraph の要件に最も合致）
3. コンポーネントとのデータモデル上の独立性を保てる
4. `extent: "parent"` は付けない方針とし、代わりに子ノードを親の範囲外にドラッグできるものとする（Mermaid subgraph の仕様に準じ、「グループは視覚的ヒントに過ぎない」という位置付け）

---

## データモデル

### subgraphGroup ノード（親）

```typescript
// type: "subgraphGroup" の FlowNode
{
  id: "myGroup",
  type: "subgraphGroup",
  position: { x: 50, y: 100 },   // 子ノードのバウンディングボックスから算出
  data: {
    label: "認証処理",              // subgraph のラベル
    shape: "rectangle",
    isSubgraphGroup: true,          // subgraph 識別フラグ
  },
  style: { width: 400, height: 300 },  // 子ノード全体を包む枠サイズ
  zIndex: -1,                      // 子ノードより背面に表示
}
```

### 子ノード（既存 FlowNode に parentId を追加）

`FlowNodeData` に新たに `subgraphParentId?: string` フィールドを追加する。

```typescript
// 既存の FlowNode に parentId + data.subgraphParentId を追加
{
  id: "A",
  type: "rectangle",
  parentId: "myGroup",              // React Flow 親子関係
  position: { x: 20, y: 60 },      // 親の左上角からの相対座標
  data: {
    label: "処理A",
    shape: "rectangle",
    subgraphParentId: "myGroup",    // 識別用（componentParentId と区別するため専用フィールド）
  },
}
```

### FlowNodeData への追加フィールド

```typescript
// src/types/flow.ts の FlowNodeData に追加
isSubgraphGroup?: boolean;    // このノードが subgraph グループ枠であることを示す
subgraphParentId?: string;    // subgraph の子ノードであることを示す（親 ID を参照）
```

### .flowmaid レイアウトスキーマへの追加

```typescript
// src/lib/flowmaid/schema.ts の FlowmaidNodeLayout に追加
isSubgraphGroup?: boolean;
subgraphParentId?: string;
```

---

## 変更・追加ファイル

### 新規作成

| ファイルパス | 役割 |
|---|---|
| `src/components/nodes/SubgraphGroupNode.tsx` | subgraph グループ枠のノードコンポーネント（ラベル表示、半透明背景、ドラッグ可能な枠） |
| `src/lib/mermaid/renderLayout.ts` | mermaid.js レンダリングでSVGからノード・subgraphの位置・サイズを抽出 |

### 変更

| ファイルパス | 変更内容 |
|---|---|
| `src/types/flow.ts` | `FlowNodeData` に `isSubgraphGroup?: boolean`、`subgraphParentId?: string` を追加 |
| `src/lib/mermaid/parse.ts` | subgraph → subgraphGroup ノード生成に変更、autoLayout呼び出し削除、mermaid.jsレイアウト結果を適用 |
| `src/lib/mermaid/generate.ts` | `isSubgraphGroup: true` のノードを `subgraph ... end` として出力 |
| `src/lib/flowmaid/schema.ts` | `FlowmaidNodeLayout` に `isSubgraphGroup`、`subgraphParentId` を追加 |
| `src/lib/flowmaid/serialize.ts` | subgraph 子ノード（`subgraphParentId` あり）を通常ノードとしてシリアライズ（`componentParentId` の場合と異なりスキップしない） |
| `src/lib/flowmaid/deserialize.ts` | `isSubgraphGroup: true` のノードを `type: "subgraphGroup"` で復元、子ノードに `parentId` を設定 |
| `src/components/canvas/FlowCanvas.tsx` | `nodeTypes` に `subgraphGroup: SubgraphGroupNode` を追加 |
| `src/components/layout/MermaidImportDialog.tsx` | parseMermaid呼び出し後にrenderMermaidLayoutを挟む（async化） |
| `src/store/useFlowStore.ts` | `removeNodes` で subgraphGroup 削除時に子ノードも連動削除するロジックを追加 |
| `package.json` | `mermaid` パッケージを依存に追加 |

---

## クラス設計

### parse.ts の変更方針

現在の `parseMermaid` 関数内（行 157〜376）では、subgraph を ComponentDefinition に変換する処理が行われている。この処理を以下のように変更する。

#### 変更前の動作（現状）

1. subgraph の子ノードを ComponentDefinition に登録
2. 子ノードをトップレベルから除外してコンポーネントインスタンスノード（`type: "componentInstance"`）を生成
3. 外部エッジをインスタンスノードにリマップ

#### 変更後の動作

1. subgraph の子ノードを収集し、バウンディングボックス（左上 minX/minY）を計算
2. subgraphGroup ノードを生成（バウンディングボックス + パディング）
3. 子ノードに `parentId` と `data.subgraphParentId` を設定、位置を相対座標に変換
4. 外部エッジは**子ノードに直接接続**（リマップ不要、子ノード ID はそのまま保持）
5. ComponentDefinition は生成しない

#### ネスト subgraph の処理

`subgraphStack` はスタック構造を維持。`subgraphStack.length > 1` の場合、内側の subgraph の子ノードを外側 subgraph の「子」ではなく内側 subgraph の「子」として独立して処理する。

各 subgraph グループノードも子ノードとして外側 subgraph の `parentId` を持てる（React Flow の parentId チェーン）。

#### subgraph ノード枠サイズの計算

```
SUBGRAPH_PADDING_X = 40  // 左右パディング
SUBGRAPH_PADDING_Y_TOP = 40  // 上パディング（ラベル分）
SUBGRAPH_PADDING_Y_BOTTOM = 20  // 下パディング

subgraphWidth = (maxX - minX + childMaxWidth) + SUBGRAPH_PADDING_X * 2
subgraphHeight = (maxY - minY + childMaxHeight) + SUBGRAPH_PADDING_Y_TOP + SUBGRAPH_PADDING_Y_BOTTOM

subgraphPosition.x = minX - SUBGRAPH_PADDING_X
subgraphPosition.y = minY - SUBGRAPH_PADDING_Y_TOP

// 子ノードの相対座標
childRelX = childAbsX - subgraphPosition.x
childRelY = childAbsY - subgraphPosition.y
```

### generate.ts の変更方針

```typescript
// subgraphGroup ノードを subgraph ブロックとして出力
if (node.data.isSubgraphGroup) {
  lines.push(`    subgraph ${node.id}[${escapeMermaid(node.data.label)}]`);
  // 子ノードを出力
  for (const child of nodes.filter(n => n.data.subgraphParentId === node.id)) {
    lines.push(nodeToMermaid(child));  // ID はそのまま（例: "A"）
  }
  // 子ノード間のエッジを出力
  for (const edge of edges) {
    if (childIds.has(edge.source) && childIds.has(edge.target) &&
        subgraphChildBelongsTo(edge.source, node.id, nodes) &&
        subgraphChildBelongsTo(edge.target, node.id, nodes)) {
      lines.push(edgeToMermaid(edge));
    }
  }
  lines.push(`    end`);
  continue;
}
```

外部エッジ（一方が subgraph 子ノード、他方が外部ノード）は通常のエッジとして出力する（子ノード ID をそのまま使用）。

### SubgraphGroupNode コンポーネント

```typescript
// src/components/nodes/SubgraphGroupNode.tsx
// - 半透明背景（fillColor が設定されていれば優先、デフォルトは --muted/30 程度）
// - ラベルを左上に表示
// - NodeResizer でリサイズ可能
// - selectable: true（通常ノードと同様に選択・移動可）
// - zIndex: -1 で常に子ノードより背面
```

### serialize.ts の変更

```typescript
// subgraph グループノード → 通常ノードとして出力（shape: "rectangle" + isSubgraphGroup: true）
// subgraph 子ノード → componentParentId がある場合と「異なり」スキップしない
//   （子ノードも個別に nodesLayout に含める）
if (node.data.componentParentId) continue;  // 既存: componentの子はスキップ
// subgraphParentId があっても continue しない（そのまま出力）

// 追加フィールド
if (node.data.isSubgraphGroup) entry.isSubgraphGroup = true;
if (node.data.subgraphParentId) entry.subgraphParentId = node.data.subgraphParentId;
```

### deserialize.ts の変更

```typescript
// isSubgraphGroup: true のノード → type: "subgraphGroup" で復元
const type = n.isSubgraphGroup
  ? "subgraphGroup"
  : (n.componentDefinitionId ? "componentInstance" : n.shape);

// subgraphParentId があるノード → parentId を設定
if (n.subgraphParentId) {
  node.parentId = n.subgraphParentId;
  node.data.subgraphParentId = n.subgraphParentId;
}
```

### useFlowStore.ts の変更

`removeNodes` アクション内で、削除対象に subgraphGroup ノードが含まれる場合、その子ノード（`subgraphParentId` が一致）も自動削除する。

```typescript
// subgraphGroup 削除時に子ノードも連動削除
const subgraphGroupIds = new Set(ids.filter(id => {
  const node = get().nodes.find(n => n.id === id);
  return node?.data.isSubgraphGroup;
}));
const childIdsToRemove = get().nodes
  .filter(n => n.data.subgraphParentId && subgraphGroupIds.has(n.data.subgraphParentId))
  .map(n => n.id);
const allIdsToRemove = [...ids, ...childIdsToRemove];
```

---

## mermaid.js レンダリングによるサイズ・位置取得

### 概要

自前の `autoLayout` を廃止し、mermaid.js の公式レンダリングエンジンを使ってノードのサイズと位置を取得する。これにより Mermaid Live Editor とほぼ同じレイアウト結果が得られる。

### 依存パッケージ

```bash
npm install mermaid
```

バンドルサイズが大きいため、dynamic import でインポート時のみロードする。

### 処理フロー

```
1. MermaidImportDialog でユーザーが Mermaid テキストを入力
2. parseMermaid() を呼び出し（テキスト解析のみ、レイアウトなし）
   - ノード定義（ID, ラベル, 形状）を抽出
   - エッジ定義（source, target, label）を抽出
   - subgraph 構造を抽出
   - direction を抽出
3. renderMermaidLayout() を呼び出し（新規関数）
   - 非表示の DOM 要素に mermaid.render() でSVGを生成
   - SVG内の各ノード要素（.node クラス）から位置・サイズを抽出
   - SVG内の subgraph 要素（.cluster クラス）から位置・サイズを抽出
   - DOM 要素をクリーンアップ
4. 抽出した位置・サイズを FlowNode に適用
5. subgraph → subgraphGroup ノードに変換（子ノードを相対座標に）
```

### renderMermaidLayout 関数

```typescript
// src/lib/mermaid/renderLayout.ts（新規作成）

interface MermaidNodeLayout {
  id: string;
  x: number;       // 中心X座標
  y: number;       // 中心Y座標
  width: number;
  height: number;
}

interface MermaidSubgraphLayout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MermaidLayoutResult {
  nodes: Map<string, MermaidNodeLayout>;
  subgraphs: Map<string, MermaidSubgraphLayout>;
}

export async function renderMermaidLayout(
  mermaidText: string
): Promise<MermaidLayoutResult> {
  // Dynamic import to avoid bundle size impact
  const mermaid = await import("mermaid");
  mermaid.default.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    flowchart: { htmlLabels: false },  // SVGラベルで正確なサイズ取得
  });

  // 非表示コンテナで render
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  document.body.appendChild(container);

  try {
    const { svg } = await mermaid.default.render("mermaid-layout-tmp", mermaidText);
    container.innerHTML = svg;
    const svgEl = container.querySelector("svg")!;

    // ノード位置・サイズ抽出
    const nodes = new Map<string, MermaidNodeLayout>();
    svgEl.querySelectorAll(".node").forEach((el) => {
      const id = el.id?.replace(/^flowchart-/, "").replace(/-\d+$/, "");
      if (!id) return;
      const bbox = (el as SVGGraphicsElement).getBBox();
      // transform を考慮して絶対座標を取得
      const ctm = (el as SVGGraphicsElement).getCTM();
      const svgCtm = svgEl.getCTM();
      // ... 座標変換処理
      nodes.set(id, { id, x, y, width: bbox.width, height: bbox.height });
    });

    // subgraph 位置・サイズ抽出
    const subgraphs = new Map<string, MermaidSubgraphLayout>();
    svgEl.querySelectorAll(".cluster").forEach((el) => {
      const id = el.id?.replace(/^flowchart-/, "").replace(/-\d+$/, "");
      if (!id) return;
      const rect = el.querySelector("rect");
      if (!rect) return;
      // ... 座標・サイズ取得
      subgraphs.set(id, { id, x, y, width, height });
    });

    return { nodes, subgraphs };
  } finally {
    document.body.removeChild(container);
  }
}
```

### SVG要素のID体系（mermaid.js内部）

mermaid.js が生成するSVG内のノード要素は以下の命名規則:
- ノード: `flowchart-{nodeId}-{数字}` というID、`.node` クラス
- subgraph: `.cluster` クラス、内部に `rect` 要素
- ノードIDの取得: `el.id` からプレフィックス・サフィックスを除去

**注意**: mermaid.js のバージョンによりID体系が異なる可能性がある。実装時に実際のSVG出力を確認して調整すること。

### 座標変換

mermaid.js のSVG座標系はReact Flowのキャンバス座標系と異なる:
- mermaid.js: ノードの中心座標を返す
- React Flow: ノードの左上座標（top-left）を使用

変換:
```
reactFlowX = mermaidCenterX - width / 2
reactFlowY = mermaidCenterY - height / 2
```

### autoLayout の廃止

`src/lib/mermaid/autoLayout.ts` は使用しなくなるが、フォールバック用に残しておく（mermaid.js のレンダリングが失敗した場合に使用）。

`parseMermaid` から `autoLayout` の呼び出しを削除し、代わりに `renderMermaidLayout` の結果を使用する。

---

## Mermaid import フロー（変更後）

```
MermaidImportDialog
  ↓
1. ユーザーが Mermaid テキストを入力
  ↓
2. parseMermaid(text, edgeType) — テキスト解析のみ
   a. ヘッダー解析（direction）
   b. subgraphStack を使いつつ全行を走査
   c. ノード定義・エッジ定義・subgraph構造を抽出
   d. ※ autoLayout は呼ばない、位置・サイズは未定
  ↓
3. renderMermaidLayout(mermaidText) — mermaid.js でレイアウト
   a. mermaid.render() でSVG生成
   b. SVGからノード・subgraphの位置・サイズを抽出
  ↓
4. レイアウト結果を FlowNode に適用
   a. 通常ノード: mermaid.js の座標 → React Flow 座標変換
   b. subgraphGroup ノード: cluster の位置・サイズから生成
   c. 子ノード: 絶対座標 → subgraphGroup に対する相対座標に変換
   d. 外部エッジ: 子ノード ID をそのまま使用（リマップ不要）
  ↓
5. loadState({ nodes, edges, direction, nextIdCounter, componentDefinitions: [] })
```

---

## .flowmaid シリアライズ

### ノードの出力例

```yaml
nodes:
  myGroup:
    position: { x: 10, y: 50 }
    size: { width: 400, height: 300 }
    shape: rectangle
    label: 認証処理
    isSubgraphGroup: true
  A:
    position: { x: 20, y: 60 }    # subgraphGroup に対する相対座標
    size: { width: 150, height: 50 }
    shape: rectangle
    label: 処理A
    subgraphParentId: myGroup
  B:
    position: { x: 20, y: 160 }
    size: { width: 100, height: 100 }
    shape: diamond
    label: 判断
    subgraphParentId: myGroup
```

### エッジの出力例

外部エッジは子ノード ID をそのまま使う（コンポーネントのようなリマップは不要）。

```yaml
edges:
  A-B-bottom-source-top-target:
    source: A
    target: B
  C-A-bottom-source-top-target:   # 外部ノード C → 子ノード A（直接接続）
    source: C
    target: A
```

---

## Mermaid 出力（generate.ts）

コンポーネント（`type: "componentInstance"`）と subgraph（`type: "subgraphGroup"` / `isSubgraphGroup: true`）は同じ `subgraph ... end` 構文で出力されるが、内部ロジックは独立して分岐する。

```
コンポーネント出力フロー（既存）:
  node.type === "componentInstance" → def.nodes から内部ノードを subgraph 展開
  外部エッジ → def.entryNodeId / exitNodeId にリマップして出力

subgraph 出力フロー（新規）:
  node.data.isSubgraphGroup === true → 子ノード（subgraphParentId 一致）を subgraph 展開
  外部エッジ → 子ノード ID そのままで出力（リマップなし）
```

出力例:

```
flowchart TD
    subgraph myGroup[認証処理]
    A[処理A]
    B{判断}
    A --> B
    end
    C[外部ノード] --> A
```

---

## 既存コンポーネントとの区別

### parseMermaid における変更

現在の `parseMermaid`（行 311〜376）は subgraph を ComponentDefinition + componentInstance に変換している。この変換を廃止し、subgraph はすべて subgraphGroup ノードとして扱う。

変更後の parseMermaid は `componentDefinitions: []` を返す（Mermaid インポートからはコンポーネントを生成しない）。

### 既存ユーザーへの影響

- 既存の `.flowmaid` ファイルに `componentDefinitions` が含まれる場合はデシリアライズ時に従来通りコンポーネントインスタンスとして復元される（デシリアライズロジックは変更なし）
- Mermaid テキストをインポートした場合のみ subgraphGroup として取り込まれるようになる（従来は componentInstance として取り込まれていたが、これは機能追加に伴う仕様変更）

### generate.ts における区別

```typescript
// 出力時の分岐
if (node.data.isSubgraphGroup) {
  // subgraph グループとして出力（子ノードは直接参照）
} else if (node.type === "componentInstance" && node.data.componentDefinitionId) {
  // コンポーネントインスタンスとして出力（definition から内部ノードを展開）
}
```

---

## ネスト対応

Mermaid の subgraph ネスト:

```
flowchart TD
    subgraph outer[外部グループ]
    subgraph inner[内部グループ]
    A[処理A]
    B[処理B]
    end
    C[処理C]
    end
```

処理方針:

1. `subgraphStack` を維持しながら走査
2. inner の subgraphGroup ノードを生成し、`parentId: "outer"` を設定
3. A, B には `parentId: "inner"` + `subgraphParentId: "inner"` を設定
4. C には `parentId: "outer"` + `subgraphParentId: "outer"` を設定
5. outer の枠サイズは inner グループ + C を含むバウンディングボックスから計算
6. シリアライズ時はすべてのノードを個別に保持（ネスト関係は `subgraphParentId` フィールドで保持）

---

## 注意事項・制約

### React Flow の parentId 挙動

- `parentId` を持つノードは親ノードに対して相対座標で配置される
- `extent: "parent"` を設定しない場合、子ノードは親の枠外にドラッグ可能（意図した仕様）
- 親ノード（subgraphGroup）を移動すると子ノードも連動して移動する（React Flow 標準動作）
- `zIndex` に `-1` を設定することで subgraphGroup 枠が子ノードの背面に表示される

### undo/redo（zundo）

- subgraphGroup と子ノードを同時に追加する操作は1アクションとしてコミットする必要がある
- parseResult を `loadState` で一括ロードする Mermaid インポートフローでは問題ない
- 将来的に UI から subgraphGroup を作成する際は `temporal.pause()` を使って複数操作を1コミットにまとめること

### セレクタ・削除の連動

- subgraphGroup ノードを Delete キーで削除した場合、子ノード（`subgraphParentId` 一致）も連動削除する（useFlowStore の `removeNodes` で対応）
- 子ノードのみを削除した場合、subgraphGroup ノードは残る（空グループになる）

### コンポーネント子ノードとの識別

- `componentParentId` → コンポーネント子ノード（選択不可・ドラッグ不可）
- `subgraphParentId` → subgraph 子ノード（選択可・ドラッグ可・編集可）
- serialize.ts では `componentParentId` のノードはスキップするが `subgraphParentId` のノードはスキップしない

### autoLayout の廃止

mermaid.js レンダリングに切り替えるため、`autoLayout` はインポート時に使用しない。ファイルはフォールバック用に残すが、`parseMermaid` からの呼び出しは削除する。

### テキスト型ノード

`shape: "text"` のノードは Mermaid 出力から除外される（generate.ts の既存ロジック）。subgraphGroup の子ノードにテキストノードがある場合も同様に除外する。

### BulkEdit モード

BulkEdit テーブルでは `subgraphParentId` を持つ子ノードも通常ノードとして列挙する（コンポーネント子ノードとは異なる）。`isSubgraphGroup: true` の親ノード自体はラベル編集対象に含めてよい。

### 差分比較（DiffComparison）

差分比較モードでは subgraphGroup ノードも通常ノードとして比較対象に含まれる。`isSubgraphGroup: true` フィールドの差異も変更として検出する。

---

## 将来課題（今回スコープ外）

- UI からの手動 subgraph 作成（複数ノード選択 → 右クリック → 「グループ化」）
- subgraph の折りたたみ
- subgraph のスタイル設定（背景色、枠線）
- 子ノードを subgraph から取り出す操作
