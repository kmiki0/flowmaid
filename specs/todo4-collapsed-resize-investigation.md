# TODO #4: 折りたたみ時のサイズ変更対応 — 調査・試行錯誤記録

## 概要

コンポーネントインスタンスの折りたたみ（collapsed）時に、ノードサイズをユーザーがリサイズできるようにする機能。
現状は折りたたみ時に150x50固定で、NodeResizerによるサイズ変更ができない。

## 根本原因

### React Flow v12 の寸法管理の仕組み

1. **NodeResizer** がドラッグ時に `onDimensionsChange({ width, height, setAttributes: true })` を発行
2. **ResizeObserver** が DOM の実際のサイズ変化を検知して `onDimensionsChange({ width, height, setAttributes: undefined })` を発行
3. `setAttributes` フラグで発行元を区別できる:
   - `true` = NodeResizer 起点
   - `undefined` = ResizeObserver 起点

### 問題の核心

折りたたみ時の DOM コンテンツ（ヘッダー + 子ノード群）は実際には約240px以上の高さを持つが、
`node.style.height: 50` で見た目上は制約されている。

- **NodeResizer** はリサイズ開始時に DOM の `offsetHeight`（~240px）を読み取る
- そのため height を50から縮小しようとすると、NodeResizer は240pxからのリサイズとして処理
- 結果: 50px → 一気に297px にジャンプする

### React Flow のスタイル適用順序

```
node.style → { ...node.style, ...inlineDimensions }
```

`node.width` / `node.height`（= inlineDimensions）が存在すると `node.style` の width/height を上書きする。
ResizeObserver が DOM サイズを読んで dimensions に反映するため、DOM の実サイズが勝ってしまう。

## 試行した6つのアプローチと失敗理由

### アプローチ1: ResizeObserver の dimensions 変更をブロック

**方法**: `applyNodeChanges` で `setAttributes: undefined`（= ResizeObserver 起点）の dimensions 変更を無視

**結果**: NodeResizer によるリサイズも動かなくなった。NodeResizer の変更後に ResizeObserver が追随し、
両方の dimensions change が必要だったため。

### アプローチ2: 内側に overflow-hidden の div を追加

**方法**: コンポーネントの内側コンテンツを `overflow: hidden` の div で囲む

**結果**: NodeResizer のリサイズハンドル（ノードの外側に出る部分）がクリップされ、操作不能に。

### アプローチ3: node.style に overflow: "hidden" を設定

**方法**: 折りたたみ時に `node.style = { ..., overflow: "hidden" }` を設定

**結果**:
- Canvas 上でサイズ変更が反映されない（ミニマップには反映される）
- NodeResizer のハンドルがクリップされる

### アプローチ4: applyNodeChanges 後に width/height を強制クランプ

**方法**: dimensions 変更適用後に、折りたたみノードの width/height を最小値に強制設定

**結果**: すべてのリサイズが無効化された（NodeResizer の変更も上書きしてしまう）。

### アプローチ5: setAttributes フラグでフィルタリング

**方法**: `setAttributes: true`（NodeResizer 起点）のみ許可し、`undefined`（ResizeObserver 起点）をブロック

**結果**: NodeResizer が DOM の `offsetHeight`（~240px）をリサイズ開始点として使用するため、
50px → 240px にジャンプ。根本的に NodeResizer の初期値が DOM サイズに依存している問題は解決できず。

### アプローチ6: setAttributes フィルタ + overflow: hidden

**方法**: アプローチ5 + node.style に overflow: hidden

**結果**: ハンドルがクリップされて操作不能（アプローチ2, 3と同じ問題）。

### アプローチ7: setAttributes フィルタ + content div を absolute inset-0

**方法**: アプローチ5 + コンテンツ部分を `position: absolute; inset: 0; overflow: hidden` にして
親ノードのサイズに影響を与えないようにする

**結果**: ユーザーの判断でテスト前にリバートされた（試行錯誤が長引いたため）。

## 未テストの有望なアプローチ

### A案: DOM 構造の根本的な再設計（最有望）

**コンセプト**: 折りたたみ時のコンテンツすべてを `position: absolute; inset: 0; overflow: hidden` にし、
DOM のフローサイズをゼロにする。

**期待される効果**:
- DOM の `offsetHeight` が `node.style.height`（50px）のみを反映
- NodeResizer が正しい初期値（50px）からリサイズ開始
- overflow: hidden がノード内部のみに適用され、NodeResizer ハンドルは親要素の外側なのでクリップされない

**リスク**:
- 通常（展開）モードとの切り替え時にレイアウトシフトが発生する可能性
- 子ノードの配置座標計算に影響する可能性

### B案: カスタムリサイザー実装

NodeResizer を使わず、独自のリサイズハンドルを実装して `offsetHeight` ではなく
`node.style.height` を読み取るようにする。

**リスク**: 実装コストが高い、React Flow のエッジ計算との整合性。

### C案: NodeResizer の minHeight/maxHeight を動的制御

折りたたみ時に `minHeight={50} maxHeight={200}` などで制約をかける。

**リスク**: DOM の offsetHeight 問題は解決しない（NodeResizer の初期値ジャンプは残る）。

## 発見した React Flow v12 の内部仕様

| 仕様 | 詳細 |
|------|------|
| `setAttributes` フラグ | `true` = NodeResizer, `undefined` = ResizeObserver |
| サイズ優先順位 | `node.width` > `node.style.width` |
| スタイル適用 | `{ ...node.style, ...inlineDimensions }` で上書き |
| NodeResizer 初期値 | DOM の `offsetHeight` / `offsetWidth` を使用 |
| ResizeObserver | DOM サイズ変化を自動検知して dimensions change を発行 |
| NodeWrapper | `getNodeInlineStyleDimensions()` で inline dimensions を計算 |

## ステータス

**保留中** — A案が最も有望だが、未テスト。将来的に再着手する際はA案から試すこと。
