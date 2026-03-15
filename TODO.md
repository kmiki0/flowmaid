# Flowmaid TODO

未実装の機能一覧。各項目の詳細仕様は specs/ または CLAUDE.md を参照。

## Phase 3

- [ ] **予測入力機能**（Predictive Node Placement）
  - Visio AutoConnect 風のノード自動配置
  - ノード外側にマウスが近づくと方向矢印を表示、ホバーでゴーストノードプレビュー、クリックで確定配置+エッジ自動接続
  - 候補: フルコピー / 形状のみコピー / ペア最頻値（最大4件）
  - 仕様書: [specs/predictive-input.md](specs/predictive-input.md)

## Phase 4

- [ ] **差分比較機能**
  - 2つの .flowmaid ファイルをインポートして差分を検出
  - キャンバス上に追加(緑)/削除(赤)/変更(黄)/移動(青)をハイライト表示
  - Mermaidプレビュー上でもテキスト差分を色分け表示
  - ノードID基準でマッチングし、構造の変化を検出
  - 仕様書: なし（CLAUDE.md に概要のみ）

## Phase 5

- [ ] **コンポーネント折りたたみ時のサイズ変更**
  - 現状は固定150x50、ユーザーによるリサイズ不可
  - React Flow v12 の ResizeObserver との競合が根本原因
  - 7つのアプローチを試行済み、A案（DOM構造再設計）が有望
  - 調査記録: [specs/todo4-collapsed-resize-investigation.md](specs/todo4-collapsed-resize-investigation.md)
