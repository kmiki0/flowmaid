# Flowmaid

ドラッグ&ドロップでフローチャートを描き、リアルタイムで Mermaid 記法を生成するWebエディタ。

## Features

### Canvas
- 15種類のノード形状（JIS/Visio準拠: 処理、判断、代替処理、結合子、データ、データベース、準備、端子、手操作、書類、定義済み処理、手入力、内部記憶、表示、テキスト）
- ノード間をエッジ（矢印）で接続、ラベル編集
- ドラッグ&ドロップによる自由配置、リサイズ
- ノード/エッジのスタイル設定（色、枠線、フォント、透明度、明暗）
- フォーマットバー（選択要素に応じた編集ツールバー、ピン固定対応）
- 整列ツール（6方向）、等間隔分布（水平/垂直）
- Z順序変更（最前面/最背面/一つ前/一つ後ろ）
- スナップ/ガイドライン
- ミニマップ

### Selection
- クリック、ドラッグ範囲選択
- Ctrl+クリックで個別トグル
- Ctrl+ドラッグでXOR選択（対称差: 選択済みは解除、未選択は選択）
- エッジ自動選択（両端ノードが選択されている場合のみ）
- Ctrl+A で全選択

### Edge
- 3種類の線種（ベジェ / 直線 / 折れ線）
- 矢印スタイル（始点・終点それぞれ: 矢印 / 開き矢印 / なし）
- 太さ3段階、色10色、実線/破線/点線
- 折れ線のウェイポイント手動編集、角丸、ノード回避ルーティング
- リングハンドルによるエッジ付け替え

### Component
- 再利用可能なサブフロー（テンプレート定義 + インスタンス配置）
- 専用編集モードで内部ノード/エッジを編集
- Entry/Exit ノード（ロック付き）、ブラックボックス表示
- ブリッジエッジによる外部接続の内部中継
- 展開/折りたたみ、インスタンス名変更、スタイル変更
- リサイズ時の子ノード比例スケーリング
- 定義編集終了時にインスタンス自動同期

### Output
- リアルタイム Mermaid 記法生成（TD / LR 切替）
- 独自フォーマット `.flowmaid`（Mermaid + YAML レイアウト）のエクスポート/インポート
- Mermaid 記法からの逆変換（テキスト → フローチャート）
- 選択要素のフィルタ表示

### Bulk Edit
- テーブルUIでノード/エッジのラベルを一括編集
- 読み取り専用キャンバスとの連動（選択、ハイライト、ズームフォーカス）
- 検索フィルター、形状/線種フィルター
- 表示モード切替（分類 / フロー順）

### General
- Undo/Redo（Ctrl+Z / Ctrl+Shift+Z、50履歴）
- コピー&ペースト（関連エッジ含む）
- 右クリックコンテキストメニュー
- ダーク/ライトテーマ
- 日本語/英語（ブラウザ言語自動検出 + 手動切替）
- localStorage 自動保存
- キーボードショートカット

## Tech Stack

- **Framework**: Next.js 16 + TypeScript (strict)
- **Flowchart**: React Flow (@xyflow/react v12)
- **UI**: shadcn/ui (Tailwind CSS v4 + Radix UI)
- **State**: zustand + zundo (undo/redo)
- **i18n**: Custom (zustand + dictionary, ja/en)
- **Theme**: next-themes
- **Serialize**: yaml (.flowmaid format)
- **Test**: vitest + jsdom (70 tests)

## Requirements

- Node.js 20+
- npm 10+

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | 開発サーバー起動 (http://localhost:3000) |
| `npm run build` | 本番ビルド |
| `npm start` | 本番サーバー起動 |
| `npm run lint` | ESLint 実行 |
| `npx vitest run` | テスト実行 (70 tests) |
| `npx tsc --noEmit` | 型チェック |

## Project Structure

```
src/
  app/              ... Next.js App Router (layout, page)
  components/
    canvas/         ... FlowCanvas, ContextMenu, SnapGuides, DnD
    bulkEdit/       ... BulkEditCanvas, BulkEditTable, Icons
    edges/          ... LabeledEdge (ベジェ/直線/折れ線)
    nodes/          ... 15種類のノード形状コンポーネント
    flowComponent/  ... コンポーネント編集モード
    layout/         ... EditorLayout, Toolbar, FormatBar, Panels
    ui/             ... shadcn/ui コンポーネント
    providers/      ... ThemeProvider
  hooks/            ... useCtrlSelection, useSnapGuides, useDnD, etc.
  store/            ... zustand store (useFlowStore, types, selectors)
  lib/
    mermaid/        ... Mermaid生成/パース (pure functions)
    flowmaid/       ... .flowmaidシリアライズ/デシリアライズ
    i18n/           ... 多言語辞書 (ja/en)
specs/              ... 機能仕様書
```

## License

MIT
