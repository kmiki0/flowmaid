# UI全面リデザイン 仕様書

## 概要

Flowmaid の全 UI を「シンプル版プレミアムガラス × ウォームグレー基調 × ダスティブルーアクセント」テーマに統一する。
確定デザインは `specs/references/design-preview.html` の `cd-blue` テーマ。

### デザインコンセプト

- **グラスモーフィズム**: `backdrop-filter: blur(12px) saturate(1.25)` + 白アルファのみ（rgba(255,255,255, .035〜.055)）+ 内側1pxハイライト。グロー演出なし（`--glow-active: none`）
- **配色意味論**: 画面の 99% はウォームグレー無彩色。「色が付く＝選択中・アクティブ状態」という一貫したルール
- **背景**: 静止オーロラブロブ（blur 90px、极めて控えめ）+ 20px ドットグリッド

---

## 1. デザイントークン定義表

### 1-1. 新規カスタム CSS 変数（globals.css に追加）

以下を `:root` および `.dark` ブロックの末尾に追加する。

| 変数名 | ダーク値 | ライト値 | 用途 |
|--------|---------|---------|------|
| `--fm-bg` | `#262624` | `#f0eee6` | キャンバス背景 |
| `--fm-panel-solid` | `rgba(31,30,29,.95)` | `rgba(255,253,248,.95)` | 非ガラスパネル（左パネル・右パネル） |
| `--fm-glass-bg` | `rgba(255,255,255,.035)` | `rgba(255,255,255,.55)` | ガラス要素背景 |
| `--fm-glass-border` | `rgba(255,255,255,.08)` | `rgba(61,57,41,.10)` | ガラス要素ボーダー |
| `--fm-glass-highlight` | `rgba(255,255,255,.06)` | `rgba(255,255,255,.90)` | ガラス要素内側上辺ハイライト |
| `--fm-glass-blur` | `12px` | `12px` | backdrop-blur 値 |
| `--fm-glass-shadow` | `rgba(0,0,0,.4)` | `rgba(80,70,50,.16)` | ガラス要素ドロップシャドウ |
| `--fm-accent` | `#8aa9d6` | `#5b7fb5` ※要確認 | アクセント（ダスティブルー）|
| `--fm-accent-rgb` | `138,169,214` | `91,127,181` ※要確認 | rgba() 用 RGB トリプレット |
| `--fm-text` | `#f0eee6` | `#3d3929` | 主テキスト |
| `--fm-text-dim` | `#98948a` | `#8d877a` | 補助テキスト |
| `--fm-node-bg` | `rgba(31,30,29,.88)` | `rgba(255,255,255,.82)` | ノード背景 |
| `--fm-node-border` | `#4a4742` | `rgba(61,57,41,.28)` | ノード通常枠線 |
| `--fm-node-border-hover` | `#6b6358` | `rgba(61,57,41,.50)` | ノードホバー枠線 |
| `--fm-edge` | `#6b6358` | `#b3ab9c` | エッジ通常色 |
| `--fm-edge-active` | `#8a8378` | `#8d877a` | エッジ選択/強調色 |
| `--fm-dot` | `rgba(255,255,255,.05)` | `rgba(61,57,41,.12)` | 背景ドットグリッド色 |
| `--fm-aurora1` | `rgba(255,250,240,.025)` | `rgba(217,119,87,.10)` | オーロラブロブ1 |
| `--fm-aurora2` | `rgba(138,169,214,.020)` | `rgba(138,169,214,.12)` | オーロラブロブ2（ブルー寄り） |
| `--fm-mermaid-kw` | `var(--fm-accent)` | `var(--fm-accent)` | Mermaid キーワード色 |
| `--fm-mermaid-str` | `#a3be8c` | `#5f7a4a` | Mermaid 文字列色 |

### 1-2. shadcn/ui セマンティックトークンへのマッピング（globals.css 上書き）

既存の `:root` / `.dark` の各トークンを以下の値に置き換える。

| shadcn トークン | ダーク新値 | ライト新値 | 備考 |
|---------------|-----------|-----------|------|
| `--background` | `#262624` (hex → oklch変換) | `#f0eee6` | キャンバス/ページ背景 |
| `--foreground` | `#f0eee6` | `#3d3929` | 主テキスト |
| `--card` | `rgba(31,30,29,.95)` | `rgba(255,253,248,.95)` | カード/パネル背景 |
| `--card-foreground` | `#f0eee6` | `#3d3929` | |
| `--popover` | `rgba(31,30,29,.97)` | `rgba(255,253,248,.97)` | コンテキストメニュー・ドロップダウン |
| `--popover-foreground` | `#f0eee6` | `#3d3929` | |
| `--primary` | `#8aa9d6` | `#5b7fb5` | **ダスティブルー** ← 現行 `primary` 色を置換 |
| `--primary-foreground` | `#262624` | `#f0eee6` | primary 上のテキスト |
| `--secondary` | `rgba(255,255,255,.06)` | `rgba(61,57,41,.08)` | セカンダリボタン背景 |
| `--secondary-foreground` | `#f0eee6` | `#3d3929` | |
| `--muted` | `rgba(255,255,255,.04)` | `rgba(61,57,41,.06)` | |
| `--muted-foreground` | `#98948a` | `#8d877a` | |
| `--accent` | `rgba(255,255,255,.06)` | `rgba(61,57,41,.08)` | hover ハイライト（shadcn accent = hover bg） |
| `--accent-foreground` | `#f0eee6` | `#3d3929` | |
| `--destructive` | `#ef4444` | `#ef4444` | 削除ボタン等（維持） |
| `--border` | `rgba(255,255,255,.08)` | `rgba(61,57,41,.12)` | 汎用ボーダー |
| `--input` | `rgba(255,255,255,.10)` | `rgba(61,57,41,.10)` | 入力欄ボーダー |
| `--ring` | `#8aa9d6` | `#5b7fb5` | フォーカスリング |
| `--handle-color` | `#8aa9d6` | `#5b7fb5` | 接続ハンドル（カスタム変数） |

**実装上の注意**: Tailwind v4 では `:root { --background: ... }` は oklch 形式が前提だが、
`@theme inline` の `--color-background: var(--background)` を通じて連携している。
hex 値を直接書く場合は `color: #262624` 形式でブラウザが解釈するため問題ない。
ただし oklch 計算の恩恵（自動コントラスト等）を得たい場合は変換が必要。今回は
シンプルさ優先で `hex` / `rgba` 直書きを許容する。

### 1-3. ユーティリティクラス（globals.css に追加）

```css
/* ガラスモーフィズム共通クラス */
.glass {
  background: var(--fm-glass-bg);
  backdrop-filter: blur(var(--fm-glass-blur)) saturate(1.25);
  -webkit-backdrop-filter: blur(var(--fm-glass-blur)) saturate(1.25);
  border: 1px solid var(--fm-glass-border);
  box-shadow:
    inset 0 1px 0 var(--fm-glass-highlight),
    0 8px 28px var(--fm-glass-shadow);
}

/* ガラス：角丸あり（ツールバー・フォーマットバー等） */
.glass-panel {
  /* .glass を継承 */
  border-radius: 13px;
}

/* オーロラ背景（ページ最底層） */
.aurora-bg::before {
  content: "";
  position: fixed;
  inset: 0;
  background:
    radial-gradient(ellipse 60vw 50vh at -10vw -15vh, var(--fm-aurora1), transparent),
    radial-gradient(ellipse 50vw 45vh at 108vw 110vh, var(--fm-aurora2), transparent);
  pointer-events: none;
  z-index: 0;
}

/* 20px ドットグリッド（React Flow Background と統一） */
.dot-grid {
  background-image: radial-gradient(var(--fm-dot) 1px, transparent 1px);
  background-size: 20px 20px;
}
```

---

## 2. ガラス化する対象と共通ルール

### ガラスにする要素（フローティング UI）

| 要素 | クラス | 備考 |
|------|--------|------|
| ツールバー（Toolbar） | `.glass-panel` | `border-radius: 13px`、上部固定 |
| フォーマットバー（FormatBar、2段） | `.glass-panel` | アニメーション付きスライドダウン維持 |
| ミニマップウィンドウ（MiniMap wrapper） | `.glass` | `border-radius: 10px` |
| 操作ガイドパネル（help-panel） | `.glass` | `border-radius: 10px` |
| コンテキストメニュー（ctx-menu） | `.glass` | `border-radius: 10px` |
| ドロップダウンメニュー（shadcn DropdownMenu） | shadcn `--popover` 変数 | `.glass` 相当の値を変数に設定 |
| ダイアログ（shadcn Dialog） | shadcn `--card` 変数 | パネルと同じ solid 背景 |
| トースト（Sonner） | `.glass` 相当スタイル | `sonner.tsx` でカスタム |
| ツールチップ（shadcn Tooltip） | shadcn `--popover` 変数 | |
| 差分比較フィルターバー（DiffFilterBar） | `.glass-panel` | |
| BulkEdit 検索/フィルター行 | 非ガラス（solid パネル内要素） | パネル背景に埋め込み |

### ガラスにしない要素（パネル = solid 背景）

| 要素 | 背景 |
|------|------|
| 左パネル（NodePalette、ComponentManagerPanel） | `--fm-panel-solid` |
| 右パネル（MermaidPreview） | `--fm-panel-solid` |
| PanelRibbon | `bg-muted/50` → `rgba(255,255,255,.04)` に調整 |
| BulkEdit テーブルエリア | `--fm-panel-solid` |
| 差分比較テキストパネル | `--fm-panel-solid` |
| NodeEditor 左パレット / 出力パネル | `--fm-panel-solid` |

---

## 3. 「色＝選択状態」意味論ルール

アクセント色（`--fm-accent` = ダスティブルー `#8aa9d6`）を**使ってよい場所**の明示リスト。

### アクセント色の許可リスト

1. **選択中ノードの枠線** — `border-color: var(--fm-accent)`
2. **NodeResizer のハンドル / ライン** — `!border-primary` Tailwind クラス（`--primary` = `--fm-accent`）
3. **接続ハンドルのリング（⊙）** — `border: 3px solid var(--primary)`、`box-shadow: 0 0 6px var(--primary)`
4. **接続ハンドルのドット（未接続 hover 時）** — `background: var(--handle-color)` = `--fm-accent`
5. **接続ライン（ドラッグ中）** — `stroke: var(--primary)`
6. **フォーカスリング** — `ring: var(--ring)` = `--fm-accent`
7. **アクティブボタン背景** — `rgba(var(--fm-accent-rgb), .22)`
8. **ToggleGroup アクティブ** — secondary variant = `rgba(var(--fm-accent-rgb), .15)`
9. **ミニマップのビューポート枠** — `border: 1px solid rgba(var(--fm-accent-rgb), .7)`
10. **テキスト入力フォーカスボーダー** — `focus:border-primary`

### アクセント色の禁止リスト

- 非選択・非アクティブのノード枠線（→ `--fm-node-border` を使う）
- 通常エッジ（→ `--fm-edge` を使う）
- 通常テキスト（→ `--fm-text` / `--fm-text-dim` を使う）
- 背景・パネル背景

---

## 4. 変更・追加ファイル一覧

### 4-1. 最優先（Phase 1）: トークン基盤

| ファイル | 変更内容 |
|---------|---------|
| `src/app/globals.css` | `:root` / `.dark` のトークン全面置換、`.glass` / `.glass-panel` / `.aurora-bg` ユーティリティ追加、`--handle-color` 更新、`.minimap-toggle` / `.dark .minimap-toggle` のハードコード色削除 → CSS変数化、`.help-panel` のハードコード `box-shadow` → CSS変数化、`.ctx-menu` の `box-shadow` → CSS変数化 |

### 4-2. Phase 2: パネル・ツールバー・レイアウト

| ファイル | 変更内容 |
|---------|---------|
| `src/components/layout/Toolbar.tsx` | ルートdivの `bg-background border-b border-border` → `glass-panel` + `fixed top-X left-50% transform` スタイルに変更。ボタン hover 色は shadcn token で自動追従 |
| `src/components/layout/FormatBar.tsx` | ルートdivに `glass-panel` クラス適用。2段目（Edge行）absolute オーバーレイも `glass-panel` |
| `src/components/layout/PanelRibbon.tsx` | `bg-muted/50` → `var(--fm-glass-bg)` ベースに調整（ウォームグレー化） |
| `src/components/layout/CollapsiblePanel.tsx` | 変更なし（中身のパネルコンポーネントで制御） |
| `src/components/layout/NodePalette.tsx` | `bg-background` → `var(--fm-panel-solid)` |
| `src/components/layout/MermaidPreview.tsx` | `bg-background` → `var(--fm-panel-solid)`。コードプレビュー `pre` に Mermaid キーワード色クラス追加（Mermaid シンタックスハイライト対応は Phase 3 で詳細設計） |
| `src/components/layout/EditorLayout.tsx` | `ToggleResizeHandle` の `bg-muted/50 hover:bg-muted border-x` を新テーマ変数ベースに調整 |
| `src/components/flowComponent/ComponentManagerPanel.tsx` | `bg-background` → `var(--fm-panel-solid)` |

### 4-3. Phase 3: キャンバス要素

| ファイル | 変更内容 |
|---------|---------|
| `src/app/globals.css` | ドットグリッド: `BackgroundVariant.Dots` の color 指定を `var(--fm-dot)` に統一（FlowCanvas.tsx 側の `color` prop で渡すかCSS変数で） |
| `src/components/nodes/RectangleNode.tsx` | `className` の `bg-background border-2 border-muted-foreground` → `bg-[var(--fm-node-bg)] border-[var(--fm-node-border)]` |
| `src/components/nodes/RoundedRectNode.tsx` | 同上 |
| `src/components/nodes/StadiumNode.tsx` | 同上 |
| `src/components/nodes/CircleNode.tsx` | 同上 |
| `src/components/nodes/ParallelogramNode.tsx` | SVG `stroke` デフォルト: `var(--color-muted-foreground)` → `var(--fm-node-border)` |
| `src/components/nodes/DiamondNode.tsx` | SVG `stroke` デフォルト: `var(--color-muted-foreground)` → `var(--fm-node-border)` |
| `src/components/nodes/HexagonNode.tsx` | 同上 |
| `src/components/nodes/TrapezoidNode.tsx` | 同上 |
| `src/components/nodes/CylinderNode.tsx` | 同上 |
| `src/components/nodes/DocumentNode.tsx` | 同上 |
| `src/components/nodes/ManualInputNode.tsx` | 同上 |
| `src/components/nodes/InternalStorageNode.tsx` | 同上 |
| `src/components/nodes/DisplayNode.tsx` | 同上 |
| `src/components/nodes/PredefinedProcessNode.tsx` | 同上 |
| `src/components/nodes/NodeWrapper.tsx` | 削除ボタン: `bg-destructive` 維持（機能色）。アスペクト比インジケーター: `stroke="#f97316"` → `stroke="var(--fm-accent)"` に変更（オレンジは統一感なし）。NodeResizer の `!border-primary` は `--primary` = `--fm-accent` になるため自動追従 |
| `src/components/nodes/ConnectHandle.tsx` | `var(--handle-color)` と `var(--primary)` は token 変更で自動追従。追加変更なし |
| `src/components/nodes/ComponentInstanceNode.tsx` | `var(--background)` → `var(--fm-node-bg)`、`color-mix(in srgb, var(--foreground) 50%, transparent)` → `var(--fm-node-border)`。`border-foreground/30` → `border-[var(--fm-node-border)]`。NodeResizer の `!border-primary` は自動追従。アスペクト比インジケーター: `stroke="#f97316"` → `stroke="var(--fm-accent)"` |
| `src/components/nodes/SubgraphGroupNode.tsx` | 同様にノード背景・枠線の変数置換（調査後実施） |
| `src/components/edges/LabeledEdge.tsx` | エッジ選択グロー: `stroke="var(--primary)"` は `--primary` = `--fm-accent` で自動追従するが、**グロー廃止の検討（後述）**。パーティクル: `background: "#fbbf24"` → `background: "var(--fm-accent)"` に変更（ゴールドからダスティブルーへ）。エッジラベルbox: `bg-background border-border` → `bg-[var(--fm-panel-solid)] border-[var(--fm-glass-border)]` |
| `src/components/canvas/FlowCanvas.tsx` | 接続ラインの `stroke="var(--primary)"` は自動追従。Background `color` prop: `var(--color-muted-foreground)` → `var(--fm-dot)` |
| `src/components/canvas/SnapGuides.tsx` | `const COLOR = "#f97316"` → `const COLOR = "var(--fm-accent)"` （オレンジ→ダスティブルーへ変更） |
| `src/components/canvas/ContextMenu.tsx` | `.ctx-menu` は CSS 変数（`--popover`）で自動追従。追加変更なし |

### 4-4. Phase 4: 各モード

#### コンポーネント編集モード

| ファイル | 変更内容 |
|---------|---------|
| `src/components/flowComponent/ComponentEditingHeader.tsx` | 現在 `text-background`（テーマ反転フレーム想定）。`text-green-400 dark:text-green-600` → ウォームグレーパレットと調和する機能色（緑は意味論的に妥当なので維持、値は `#4ade80` / `#16a34a` 程度で可）。反転フレーム自体は `EditorLayout.tsx` 側の `bg-foreground text-background` ラッパーで実装されている前提 |

#### BulkEdit モード

| ファイル | 変更内容 |
|---------|---------|
| `src/components/bulkEdit/BulkEditTable.tsx` | 全体的に shadcn token 経由のため、token 変更で大部分自動追従。ハイライト行の色を `bg-primary/10` → `bg-[rgba(var(--fm-accent-rgb),.10)]` に明示 |
| `src/components/bulkEdit/BulkEditCanvas.tsx` | 読み取り専用キャンバス背景。token 経由で自動追従 |
| `src/components/bulkEdit/BulkEditNodeIcon.tsx` | アイコンSVGの stroke デフォルトが `currentColor` ならば自動追従 |
| `src/components/bulkEdit/BulkEditEdgeIcon.tsx` | 同上 |

#### 差分比較モード

| ファイル | 変更内容 |
|---------|---------|
| `src/lib/diff/buildDiffNodes.ts` | `DIFF_COLORS` の `added: "#22c55e"` / `deleted: "#ef4444"` / `modified: "#f59e0b"` は**機能色として維持する**。ただし彩度をウォームグレー背景に合わせて微調整: `added: "#34d399"`, `deleted: "#f87171"`, `modified: "#fbbf24"` 程度（少し明るくして視認性確保） ※最終値は未決定・ユーザー確認要 |
| `src/components/diffComparison/DiffGlowOverlay.tsx` | 差分グロー色は `DIFF_COLORS` 経由のため自動追従 |
| `src/components/diffComparison/DiffBadgeOverlay.tsx` | 同上 |
| `src/components/diffComparison/DiffFilterBar.tsx` | shadcn token 経由で自動追従 |
| `src/components/diffComparison/DiffTextPanel.tsx` | 差分行の背景色: `added` = `rgba(52,211,153,.15)`, `deleted` = `rgba(248,113,113,.15)` 程度に調整（ウォームグレー背景でもわかる濃度） |

### 4-5. Phase 4 続き: Nodemaid ノードエディタモード

| ファイル | 変更内容 |
|---------|---------|
| `src/features/node-editor/components/NodeEditorLayout.tsx` | 左パレット: `bg-background` → `var(--fm-panel-solid)`。`border-r border-border` は token で自動追従 |
| `src/features/node-editor/components/CardNode.tsx` | ルートdiv: `bg-background border-2` → `bg-[var(--fm-node-bg)] border-2`。ヘッダー: `text-white` は動的 `headerColor` と組み合わせ（ユーザーコンテンツ色として維持）。`bg-white/20 hover:bg-white/40` 編集ボタン: 維持。`border-border` / `text-muted-foreground bg-muted/30` などは token 経由 |
| `src/features/node-editor/components/PortRow.tsx` | `border-border` / `focus:border-primary` / `hover:text-primary` は token 変更で自動追従 |
| `src/features/node-editor/components/NodeEditorCanvas.tsx` | Background の color prop を `var(--fm-dot)` に変更 |
| `src/features/node-editor/components/NodeEditorToolbar.tsx` | token 経由で自動追従 |
| `src/features/node-editor/components/NodeEditorFormatBar.tsx` | ガラス化を適用（`.glass-panel`） |
| `src/features/node-editor/components/NodeEditorOutputPanel.tsx` | `var(--fm-panel-solid)` に変更 |
| `src/features/node-editor/components/NodeEditorPalette.tsx` | `var(--fm-panel-solid)` に変更 |
| `src/features/node-editor/components/CardinalityEdge.tsx` | エッジ色を `var(--fm-edge)` ベースに調整（調査後実施） |

### 4-6. Phase 5: 細部

| ファイル | 変更内容 |
|---------|---------|
| `src/components/ui/sonner.tsx` | トーストのガラス化: shadcn Sonner のカスタムクラスで `.glass` 相当を適用 |
| `src/components/ui/button.tsx` | `primary` / `secondary` / `ghost` variant の見直し（token 変更で自動追従するか確認） |
| `src/components/ui/toggle.tsx` | アクティブ状態: `data-[state=on]:bg-accent` → token 経由で追従 |
| `src/components/ui/toggle-group.tsx` | 同上 |
| `src/components/ui/input.tsx` | `border-input` / `focus:ring-ring` は token 経由 |
| `src/components/ui/slider.tsx` | スライダートラック / サム色を `--fm-accent` に統一 |
| `src/components/ui/dialog.tsx` | `bg-background` → token 変更で追従（card 扱い） |
| `src/components/layout/ExportDialog.tsx` | token 経由で自動追従 |
| `src/components/layout/MermaidImportDialog.tsx` | token 経由で自動追従 |
| `src/components/layout/BetaNoticeDialog.tsx` | token 経由で自動追従 |

---

## 5. 既存演出の扱い

### エッジ選択グロー

**現状**: 選択時に `stroke="var(--primary)"` の半透明グロー（`strokeWidth + 10`、`strokeOpacity: 0.4`）を重ねる。

**方針**: グロー廃止 or 大幅減。デザインコンセプト「グロー演出なし」に従い、
選択エッジは**グロー廃止 + エッジ色を `--fm-accent` に変化させる**方式を推奨。

```
通常エッジ色: var(--fm-edge) = #6b6358
選択エッジ色: var(--fm-accent) = #8aa9d6（グロー不要）
```

実装: `LabeledEdge.tsx` の選択グローパスを削除し、選択時の `strokeColor` を `var(--fm-accent)` にフォールバックする条件分岐を追加。

### ノード作成・削除アニメーション

`node-pop-in` / `node-pop-out` キーフレームは維持（動き自体はデザインに中立）。

### エッジ接続パーティクル

色を `#fbbf24`（ゴールド）→ `var(--fm-accent)`（ダスティブルー）に変更。
アニメーション自体は維持。

### スナップガイド（SnapGuides）

現在 `#f97316`（オレンジ）。アクセント色（`--fm-accent`）に変更することでデザイン統一。
ただし整列ガイドは「一時的な視覚フィードバック」のため、若干目立つ色のほうが機能的。
**オレンジ維持 or アクセント変更は未決定（後述の未決定事項へ）**。

### NodeResizer アスペクト比インジケーター（斜線）

`stroke="#f97316"` → `stroke="var(--fm-accent)"` に変更。

---

## 6. ユーザーコンテンツ色（パレットスウォッチ）の扱い

`FormatBar.tsx` および `ContextMenu.tsx` の `COLORS` 配列（10色）は**変更しない**。
これらはユーザーがノード・エッジに自由に設定するコンテンツ用パレットであり、
テーマに関わらず一定のカラーを提供する必要がある。

```typescript
// 維持する
const COLORS = [
  { key: "colorDefault", value: "" },     // デフォルト（テーマ連動）
  { key: "colorRed",    value: "#ef4444" },
  { key: "colorOrange", value: "#f97316" },
  { key: "colorYellow", value: "#eab308" },
  { key: "colorGreen",  value: "#22c55e" },
  { key: "colorBlue",   value: "#3b82f6" },
  { key: "colorPurple", value: "#a855f7" },
  { key: "colorPink",   value: "#ec4899" },
  { key: "colorWhite",  value: "#ffffff" },
  { key: "colorBlack",  value: "#000000" },
];
```

**テーマ連動スウォッチ**（`colorDefault = ""`）: ノードに色未設定の場合、
`computeColor()` が `undefined` を返し CSS 変数ベース（`--fm-node-bg` / `--fm-node-border`）が使われる。
この動作は維持する。

---

## 7. 実装フェーズ分け

### Phase 1: トークン基盤（最優先・単一ファイル）

- `src/app/globals.css` のみ変更
- デザイントークン全定義、shadcn セマンティックトークン上書き
- `.glass` / `.glass-panel` / `.aurora-bg` ユーティリティ追加
- **ゴール**: token 変更だけで全体の色味が新テーマに近づく

**影響範囲の見積もり**: この 1 ファイルだけで以下が自動追従する
- shadcn/ui 全コンポーネント（Button, Dialog, DropdownMenu, Tooltip, Input 等）
- NodeResizer (`!border-primary` → `--fm-accent`)
- ConnectHandle リング (`var(--primary)`)
- エッジ選択グロー (`var(--primary)`)
- フォーカスリング (`var(--ring)`)

### Phase 2: パネル・ツールバー・レイアウト（最もユーザーが目にする面積）

- Toolbar → `.glass-panel` 適用
- FormatBar → `.glass-panel` 適用
- NodePalette / MermaidPreview → `--fm-panel-solid` 適用
- PanelRibbon / ToggleResizeHandle → ウォームグレー調整

### Phase 3: キャンバス要素（ノード・エッジ・ハンドル）

- 全 15 種ノード形状の `bg-background` / `stroke="var(--color-muted-foreground)"` を
  `--fm-node-bg` / `--fm-node-border` に置換
- LabeledEdge: エッジグロー廃止、パーティクル色変更
- SnapGuides: 色変更
- NodeWrapper / ComponentInstanceNode: アスペクト比インジケーター色変更

### Phase 4: 各モード

- コンポーネント編集モードの反転フレーム: ダーク時は `#f0eee6` 背景 + `#262624` テキストが反転版。既存 `bg-foreground text-background` 実装が正しく動作するか確認
- BulkEdit: ハイライト色調整
- 差分比較: `DIFF_COLORS` 微調整、DiffTextPanel の差分行背景色
- Nodemaid: CardNode / PortRow / 各レイアウトコンポーネント

### Phase 5: 細部・ポリッシュ

- トースト（Sonner）のガラス化
- スライダーコンポーネントのアクセント色
- Mermaid プレビューのシンタックスハイライト（キーワード / 文字列を色分け）
- オーロラ背景ブロブの実装（`aurora-bg` クラスを body または最底層 div に適用）
- ライトテーマの細部調整

---

## 8. 決定事項（2026-06-11 ユーザー確認済み）

| # | 項目 | 決定 |
|---|------|------|
| 1 | **ライトテーマのアクセント最終値** | `#5b7fb5`（仮）で実装し、画面確認後に微調整。WCAG AA（背景 `#f0eee6` と 4.5:1 以上）をチェック |
| 2 | **エッジ選択グロー** | **廃止**。選択エッジは色が `--fm-accent` に変わるのみ |
| 3 | **スナップガイド色** | オレンジ `#f97316` **維持**（一時的な機能フィードバックのため視認性優先。差分色と同じ「機能色」扱い） |
| 4 | **差分色の微調整値** | `added: "#34d399"`, `deleted: "#f87171"`, `modified: "#fbbf24"` で実装 |
| 5 | **オーロラ背景** | **実装する**（静止・無彩色寄り極微光、静的CSS） |
| 6 | **Mermaid シンタックスハイライト** | **追加する**（キーワード=アクセント、文字列/ラベル=`--fm-mermaid-str`、簡易トークナイザーを実装） |
| 7 | **ツールバーの形状** | **フローティング型**（画面上部中央の角丸ガラスタブレット、キャンバスはツールバー下にも広がる） |
| 8 | **React Flow Controls** | 新トークンに更新（非表示にはしない） |

---

## 9. クラス設計補足

### globals.css への追記パターン

```css
/* === Flowmaid: Design System 2.0 === */

/* トークン（ダークテーマ） */
.dark {
  --fm-bg: #262624;
  --fm-panel-solid: rgba(31, 30, 29, .95);
  /* ... 全トークン ... */
}

/* トークン（ライトテーマ） */
:root {
  --fm-bg: #f0eee6;
  --fm-panel-solid: rgba(255, 253, 248, .95);
  /* ... 全トークン ... */
}
```

**注意**: next-themes は `<html>` に `.dark` クラスを付与する方式。
Tailwind v4 の `@custom-variant dark (&:is(.dark *))` と整合しているため、
`.dark { --fm-* }` で定義すれば `dark:*` ユーティリティクラスと共存できる。

### Tailwind クラスでのトークン参照

Tailwind v4 では `bg-[var(--fm-node-bg)]` のような任意値で CSS 変数を直接参照できる。
ただし頻出パターンは `@theme inline` に追加してクラス名を短縮することを推奨:

```css
@theme inline {
  --color-fm-accent: var(--fm-accent);
  --color-fm-node-bg: var(--fm-node-bg);
  --color-fm-node-border: var(--fm-node-border);
  --color-fm-panel: var(--fm-panel-solid);
  --color-fm-text-dim: var(--fm-text-dim);
}
```

これにより `bg-fm-node-bg` / `border-fm-node-border` / `text-fm-text-dim` 等の
Tailwind ユーティリティが使えるようになる。

---

## 10. 注意事項・制約

1. **React Flow の `@xyflow/react/dist/style.css`** はインポートしたまま維持。
   React Flow 内部のデフォルトスタイルを上書きするため、`globals.css` の後半に上書きルールを記述する（現行方式を踏襲）。

2. **oklch vs hex**: globals.css は現在 oklch 形式を使用しているが、今回追加する `--fm-*` 変数は
   hex / rgba で定義する。`--background` などの shadcn 変数を hex に変換する際、
   `oklch(0.145 0 0)` ≈ `#252525` / `oklch(0.985 0 0)` ≈ `#fafafa` 程度の対応だが、
   今回はウォームグレーに置換するため元の白黒系 oklch 値は完全に上書きされる。

3. **ユーザーが設定したノード色** (`fillColor` / `borderColor` 等の hex 値) は、
   `computeColor()` 関数を通じてそのままインラインスタイルに渡されるため、
   テーマ変更の影響を受けない（意図通り）。

4. **NodeEditor（Nodemaid）の CardNode ヘッダー色** は `data.fillColor ?? KIND_DEFAULT_COLORS[kind]` で
   決まり、`service: "#3b82f6"`, `table: "#8b5cf6"` はハードコード。
   これらはユーザーコンテンツ色として扱い、変更しない。
   ただし `generic: "var(--color-primary)"` → `var(--fm-accent)` への変更を Phase 4 で実施。

5. **差分機能色（DIFF_COLORS）** は機能的意味（赤=削除、緑=追加、オレンジ=変更）を持つため、
   新パレットと調和させながらも機能色の意味論は維持する。
   「ウォームグレー背景でも十分視認できる」ことを最優先に微調整する。
