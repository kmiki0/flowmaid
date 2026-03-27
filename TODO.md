# Flowmaid TODO

未実装の機能一覧。各項目の詳細仕様は specs/ または CLAUDE.md を参照。

## Phase 3

- [x] **予測入力機能**（ゴーストノード方式で実装済み）
  - 選択中ノードの上下左右にゴーストノード（半透明プレビュー）を常時表示
  - クリックで実ノード＋エッジを自動作成、Tab/Shift+Tabで候補切替（最大4候補）
  - 仕様書: [specs/predictive-input.md](specs/predictive-input.md)

## Phase 4

- [ ] **差分比較機能**
  - 2つの .flowmaid ファイルをインポートして差分を検出
  - キャンバス上に追加(緑)/削除(赤)/変更(黄)/移動(青)をハイライト表示
  - Mermaidプレビュー上でもテキスト差分を色分け表示
  - ノードID基準でマッチングし、構造の変化を検出
  - 仕様書: なし（CLAUDE.md に概要のみ）

## Phase 5

- [x] **コンポーネント折りたたみ時のサイズ変更**（実装済み）
  - 調査記録: [specs/todo4-collapsed-resize-investigation.md](specs/todo4-collapsed-resize-investigation.md)

- [ ] **MCPサーバー化**
  - Flowmaidの機能をMCPサーバーとして外部から利用可能にする
  - 仕様書: なし
