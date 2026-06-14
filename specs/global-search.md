# グローバル検索／ジャンプ 仕様書

## 概要

通常のフローチャート編集モードで、ノード・エッジをラベルやIDで検索し、ヒット要素に選択＋ズームフォーカスできるグローバル検索UIを提供する。大きな図でも目的の要素に素早くジャンプすることが目的。BulkEditモードのテーブル内検索とは独立した機能として実装する。

---

## 実装方針の検討

### 案A: フローティングダイアログ（モーダルレス）

キャンバス上に重なるフローティングパネルとして実装する。`position: absolute` でキャンバス内部に配置し、ヒット結果リストをDropdown状に表示。EditorLayout.tsx の既存フローティング要素（NodePalette、MermaidPreview、FormatBar）と同じ構造で追加できる。

- 利点: キャンバスを狭めない、他のパネルと干渉しない、開閉状態の管理がシンプル
- 欠点: キャンバス上のノードと重なる可能性がある

### 案B: Commandパレット（Ctrl+K 方式）

画面上部中央に固定されるCommand-palette形式。キーボードショートカット1発で呼び出し、背景にスクリム（半透明overlay）。shadcn/ui の `Command` コンポーネントを使いたいが、現プロジェクトには `src/components/ui/command.tsx` が存在しないため、新規追加が必要。

- 利点: モダンなUX、呼び出しが直感的、結果が見やすい
- 欠点: shadcn/ui Command コンポーネントの追加インストールが必要、スクリムがキャンバス操作を遮断する

### 案C: ツールバー内の小型インライン検索バー

Toolbarコンポーネント内に常設の検索入力欄を置く。既存ツールバーのスペースを削る。

- 利点: 常時アクセス可能
- 欠点: ツールバースペースを圧迫、isBulkEditMode/isDiffMode など複数モードでの条件分岐が複雑になる

### 推奨案: 案A（フローティングダイアログ）を採用

既存アーキテクチャへの影響が最小で、BulkEdit・コンポーネント編集モード・DiffモードをまたいでFloating UIの挙動を統一しやすい。Command パレット風のキーボード操作性（上下矢印・Enter・Esc）は案Aでも実現できる。

Ctrl+Fはブラウザの標準検索と衝突するため `e.preventDefault()` が必要。代替として **Ctrl+Shift+F** を主ショートカットとしながら、Ctrl+Fも `preventDefault` したうえで奪う方式にする（詳細はUX仕様を参照）。

---

## UX仕様

### 呼び出し方法

| ショートカット | 動作 |
|---|---|
| `Ctrl+Shift+F` | 検索パネルを開く（主ショートカット） |
| `Ctrl+F` | 同上（ブラウザデフォルトを奪う） |

- 有効な呼び出し条件: 通常フローチャート編集モード（`isBulkEditMode` も `isDiffMode` も `isEditingComponent` も false）
- BulkEditモード・DiffMode・コンポーネント編集モードでは無効（ショートカット反応なし、パネルも表示しない）

### パネル外観と配置

- キャンバス内 absolute 配置（top-center）: `position: absolute; top: 48px; left: 50%; transform: translateX(-50%); z-index: 30`
- 幅 480px（小画面では `min(480px, 85vw)`）
- `glass-panel` クラスを適用（既存スタイル統一）
- 構成:
  ```
  [ 🔍 検索ワード入力欄... ] [×]
  ---
  [ ● Node  A  ] 開始処理       ←ヒット行
  [ ● Node  B  ] 条件分岐
  [ → Edge  A→B ] はい
  ---
  ヒット件数 / 3件中 2番目  [↑][↓]
  ```

### 検索入力

- プレースホルダー: `Search nodes and edges... (Esc to close)` / `ノード・エッジを検索... (Esc で閉じる)`
- 入力のたびに即時リアルタイムフィルタリング（デバウンスなし、高速）
- 空欄時: 結果リスト非表示、件数ゼロ表示なし

### 結果リスト

- 最大表示件数: 50件（スクロール可能、ScrollArea使用）
- 各行の構成: `[アイコン] [種別タグ: Node/Edge] [ID] ラベルテキスト`
  - ノード行: BulkEditNodeIconを流用（形状・色を反映した16px SVGアイコン）
  - エッジ行: BulkEditEdgeIconを流用（`source→target` を小文字でサブテキスト表示）
  - コンポーネントインスタンス行: インスタンス名を優先表示、`[comp]` タグ付加
- マッチ箇所のハイライト: `<mark>` タグで背景黄色強調

### キーボードナビゲーション

| キー | 動作 |
|---|---|
| `↑` / `↓` | 結果リスト内でフォーカス移動 |
| `Enter` | フォーカス中の要素にジャンプ（選択＋ズーム） |
| `Escape` | パネルを閉じる |
| `Tab` / `Shift+Tab` | 結果リストをループ移動（入力欄から下方向へ） |

### ジャンプ挙動（選択＋ズーム）

1. 対象要素の全選択をリセット（既存選択をクリア）
2. 対象ノードの `selected: true` をセット（useFlowStore.setState経由）
3. React Flow の `fitView({ nodes: [{ id }], padding: 0.4, duration: 400 })` でズームアニメーション
   - 実装は `reactFlowInstance.current` を参照するカスタムイベント `flowmaid:jumpTo` を介して FlowCanvas.tsx で処理する（BulkEditCanvas の focusTarget 方式を参考）
   - イベント detail: `{ type: "node" | "edge", id: string }`
4. エッジジャンプ時: エッジの source/target ノードを両端含む `fitView` で対象エッジが確実に画面内に収まるようにする

### 複数ヒット時の next/prev ナビゲーション

- 検索結果が2件以上ある場合、パネル下部に `[↑] 2/5件 [↓]` のインジケーターを表示
- `↑` / `↓` ボタンクリック or キーボード上下矢印でナビゲート
- Enter/クリックでそのままジャンプしてパネルは開いたまま
- 件数が0件の場合: 「見つかりませんでした」メッセージを表示

---

## 検索対象とマッチングルール

### 対象フィールド（優先順）

| 対象 | 参照フィールド |
|---|---|
| ノード | `node.id` / `node.data.label` / `node.data.componentInstanceName`（インスタンス名） |
| エッジ | `edge.data?.label` / `edge.source + "→" + edge.target`（ID組合せ文字列） |

### マッチング方法

- 大文字・小文字を無視（`toLowerCase()` 正規化比較）
- 部分一致（`includes()`）
- 複数語スペース区切りの場合: 全語が各フィールドいずれかにマッチする AND 条件（例: `"A 開始"` → id に "A" が含まれ、かつ label に "開始" が含まれるもの）

### 除外する要素

| 除外対象 | 理由 |
|---|---|
| ゴーストノード（ID が `__ghost__` で始まる） | 仮ノード、実体なし |
| ブリッジエッジ（`edge.data.isBridgeEdge === true`） | 自動生成エッジ、ユーザーが命名・識別不可 |
| コンポーネント子ノード（`node.data.componentParentId` あり） | プレビュー専用、個別ジャンプ対象外 |
| `isLocked` ノード（entry/exit） | コンポーネント編集モード中のみ存在、通常モードでは除外対象 |

### コンポーネントインスタンスの扱い

- インスタンスノード自体（`type === "componentInstance"`）は通常ノードと同様に検索対象に含める
- 表示ラベルは `node.data.componentInstanceName ?? node.data.label` を優先
- 種別タグを `[comp]` と表示して区別する
- コンポーネント子ノードは除外（上記参照）

---

## 実装ファイル一覧と変更概要

### 新規作成

| ファイルパス | 役割 |
|---|---|
| `src/components/search/GlobalSearchPanel.tsx` | 検索パネルのメインコンポーネント。入力欄・結果リスト・next/prev ナビゲーターを含む |
| `src/components/search/SearchResultItem.tsx` | 結果リスト1行の表示コンポーネント（BulkEditNodeIcon/BulkEditEdgeIcon を流用） |
| `src/hooks/useGlobalSearch.ts` | 検索ロジックをまとめたカスタムフック。`useFlowStore` からノード・エッジを取得し、クエリに対してマッチング処理を行う |

### 変更: 既存ファイル

| ファイルパス | 変更内容 |
|---|---|
| `src/components/layout/EditorLayout.tsx` | `GlobalSearchPanel` の表示制御ステート（`isSearchOpen`, `searchFocusTarget`）を追加。通常フローチャートモードのキャンバス上 absolute 位置に `GlobalSearchPanel` を配置。`handleJumpTo` コールバックを定義し `GlobalSearchPanel` に渡す |
| `src/hooks/useKeyboardShortcuts.ts` | `Ctrl+F` および `Ctrl+Shift+F` のハンドラを追加。カスタムイベント `flowmaid:globalSearch:open` を dispatch する。呼び出し可否の判定はイベントリスナー側（EditorLayout）で行う |
| `src/components/canvas/FlowCanvas.tsx` | カスタムイベント `flowmaid:jumpTo` のリスナーを追加（fitview イベントの実装パターン `addEventListener("flowmaid:fitview", ...)` を参考）。イベント detail から `{ type, id }` を受け取り、`reactFlowInstance.current.fitView()` を呼び出す |
| `src/lib/constants.ts` | 以下の定数を追加: `GLOBAL_SEARCH_STORAGE_KEY = "flowmaid-global-search"` / `GLOBAL_SEARCH_MAX_RESULTS = 50` |
| `src/lib/i18n/locales.ts` | 以下のキーを ja/en 両方に追加（詳細は下記 i18n セクションを参照） |

---

## クラス設計

### `useGlobalSearch` フック (`src/hooks/useGlobalSearch.ts`)

```
入力:
  query: string           // 検索クエリ文字列

出力:
  results: SearchResult[] // マッチ結果（最大 GLOBAL_SEARCH_MAX_RESULTS 件）
  total: number           // ヒット総件数

型定義:
  SearchResult = {
    kind: "node" | "edge"
    id: string
    displayLabel: string    // 表示用ラベル（instanceName優先）
    subLabel?: string       // エッジの場合 "source→target"、コンポーネントの場合 "[comp]"
    nodeData?: FlowNode["data"]  // ノードのスタイル情報（アイコン描画用）
    edgeData?: FlowEdge["data"]  // エッジのスタイル情報（アイコン描画用）
    highlightRanges?: { field: "label" | "id"; start: number; end: number }[]
  }

zustand セレクタ:
  nodes = useFlowStore((s) => s.nodes)  // ← ドラッグ中再レンダリング注意（下記パフォーマンス参照）
  edges = useFlowStore((s) => s.edges)
```

フィルタリング処理は `useMemo` でメモ化し、`query` と `nodes`/`edges` が変化した場合のみ再計算する。

### `GlobalSearchPanel` コンポーネント (`src/components/search/GlobalSearchPanel.tsx`)

```
Props:
  isOpen: boolean
  onClose: () => void
  onJump: (type: "node" | "edge", id: string) => void

内部ステート:
  query: string              // 入力値
  activeIndex: number        // フォーカス中の結果インデックス

主要な ref:
  inputRef: RefObject<HTMLInputElement>  // open時に自動フォーカス
  listRef: RefObject<HTMLDivElement>     // スクロール制御用

動作:
  - isOpen が true になったら inputRef.current?.focus()
  - query が変化したら activeIndex を 0 にリセット
  - ↑↓キーで activeIndex を更新し、対応する行が viewport 内に収まるよう scrollIntoView
  - Enter で onJump(results[activeIndex].kind, results[activeIndex].id)
  - Escape で onClose()
```

### `EditorLayout.tsx` の変更点

```
追加ステート:
  [isSearchOpen, setIsSearchOpen] = useState(false)

追加ハンドラ:
  handleOpenSearch: () => setIsSearchOpen(true)
  handleCloseSearch: () => setIsSearchOpen(false)
  handleJumpTo: (type, id) => {
    window.dispatchEvent(new CustomEvent("flowmaid:jumpTo", { detail: { type, id } }))
    // ノードの場合: useFlowStore の nodes を更新して selected: true にする
    // ストアに直接アクセスして selected フラグを更新（useKeyboardShortcuts の Ctrl+A パターンを参照）
  }

配置（通常フローチャートモードのキャンバス内部 absolute 位置）:
  {!isBulkEditMode && !isDiffMode && !isEditingComponent && (
    <>
      {/* 検索パネル呼び出しボタン（任意。ショートカット主体なら省略可） */}
      <GlobalSearchPanel
        isOpen={isSearchOpen}
        onClose={handleCloseSearch}
        onJump={handleJumpTo}
      />
    </>
  )}
```

### `FlowCanvas.tsx` の変更点（jumpTo イベントリスナー）

```
追加 useEffect（fitview イベントの直後に配置）:
  useEffect(() => {
    const handler = (e: Event) => {
      const { type, id } = (e as CustomEvent).detail as { type: "node" | "edge"; id: string };
      if (!reactFlowInstance.current) return;
      if (type === "node") {
        reactFlowInstance.current.fitView({
          nodes: [{ id }],
          padding: 0.4,
          duration: 400,
        });
      } else {
        // エッジジャンプ: source/target ノードを両端に含む fitView
        const edge = useFlowStore.getState().edges.find((e) => e.id === id);
        if (!edge) return;
        reactFlowInstance.current.fitView({
          nodes: [{ id: edge.source }, { id: edge.target }],
          padding: 0.4,
          duration: 400,
        });
      }
    };
    window.addEventListener("flowmaid:jumpTo", handler);
    return () => window.removeEventListener("flowmaid:jumpTo", handler);
  }, []);
```

### `useKeyboardShortcuts.ts` の変更点

```
追加ハンドラ（既存の Ctrl+F が存在しないことを確認済み）:
  // Global search: Ctrl+F (override browser default) and Ctrl+Shift+F
  if (isCtrl && (e.key === "f" || e.key === "F")) {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent("flowmaid:globalSearch:open"));
  }

注意:
  - "INPUT" / "TEXTAREA" の早期 return が先に来るため、
    フォーカスが検索パネルの入力欄にある場合はこのハンドラが呼ばれない
    → 検索パネルが開いているときに Ctrl+F を押すと再度 openイベントが飛ぶが、
      EditorLayout 側の isSearchOpen が既に true なら無害
```

---

## i18n 追加キー

`src/lib/i18n/locales.ts` に以下のキーを `en` と `ja` の両方に追加する。

| キー名 | en | ja |
|---|---|---|
| `globalSearch` | `"Search"` | `"検索"` |
| `globalSearchPlaceholder` | `"Search nodes and edges... (Esc to close)"` | `"ノード・エッジを検索... (Esc で閉じる)"` |
| `globalSearchNoResults` | `"No results found"` | `"見つかりませんでした"` |
| `globalSearchResultCount` | `"{current} of {total}"` | `"{total}件中 {current}番目"` |
| `globalSearchTagNode` | `"Node"` | `"ノード"` |
| `globalSearchTagEdge` | `"Edge"` | `"エッジ"` |
| `globalSearchTagComp` | `"comp"` | `"コンポ"` |
| `helpCtrlFSearch` | `"Ctrl+Shift+F to search"` | `"Ctrl+Shift+F で検索"` |

`helpCtrlFSearch` は `FlowCanvas.tsx` の操作ガイドパネル（HelpPanel）の「Keyboard Shortcuts」カテゴリにも追加する。

---

## パフォーマンス上の注意事項

### zustand セレクタの注意

CLAUDE.md のパフォーマンス最適化パターンに記載の通り、`useFlowStore((s) => s.nodes)` はドラッグ中に毎フレーム再レンダリングを引き起こす。

`useGlobalSearch` フックは検索パネルが**開いているときのみ**マウントされるようにする（`GlobalSearchPanel` をキャンバスに常時 render せず、`isOpen === true` のときだけ DOM に挿入する）ことで、非表示中は zustand のサブスクリプション自体が存在しない状態を維持する。

実装方針:
- `EditorLayout.tsx` 側で `{isSearchOpen && <GlobalSearchPanel ... />}` として条件レンダリング
- `GlobalSearchPanel` 内の `useGlobalSearch` は常にマウントされた状態でサブスクライブするため、パネルが閉じている間はサブスクリプションがない

### フィルタリングコストの抑制

- `useMemo` で `[query, nodes, edges]` 依存でフィルタリング結果をキャッシュ
- `query` が空文字列の場合は早期 return で空配列を返す
- 結果を `GLOBAL_SEARCH_MAX_RESULTS` 件でスライスして DOM 構築コストを抑える

### selected フラグの更新方法

`handleJumpTo` でノード選択状態を更新する際、`useFlowStore.setState` を直接呼び出す（`useKeyboardShortcuts.ts` の Ctrl+A パターン参照）。`onNodesChange` 経由の select イベントを使うと zundo 履歴に積まれるため、`setState` 直接更新で履歴をスキップする。ただし、undo 対象にならないよう注意。

```
// 参考パターン (useKeyboardShortcuts.ts 内の全選択):
storeRef.current.setState({
  nodes: state.nodes.map((n) => ({ ...n, selected: n.id === targetId })),
  edges: state.edges.map((edge) => ({ ...edge, selected: false })),
});
```

---

## 既存機能との非干渉

### BulkEdit モードとの分離

- グローバル検索パネルは `isBulkEditMode === true` のとき表示しない（EditorLayout の条件レンダリングで制御）
- ショートカット `Ctrl+F` は `useKeyboardShortcuts.ts` で処理するが、BulkEditモード中はイベント発火後に EditorLayout 側で無視する（`isSearchOpen` への set を `!isBulkEditMode && !isDiffMode && !isEditingComponent` 条件で guard）
- BulkEditTable の検索バー（`<Input placeholder={t("bulkEditSearch")} ...>` / `src/components/bulkEdit/BulkEditTable.tsx`）には影響なし

### 予測入力（ゴーストノード）との関係

- 検索パネルが開いているとき、`Tab` キーはデフォルト動作（フォーカス移動）として検索パネル内で消費される
- FlowCanvas.tsx の Tab ハンドラは `window.addEventListener("keydown", handler)` で登録されているが、検索パネルの input 要素は `tagName === "INPUT"` に該当するため、`useKeyboardShortcuts.ts` の早期 return には引っかかる
- Tab キーの Ghost 切替ハンドラ（FlowCanvas.tsx の `useEffect` ブロック）は `hasGhosts` チェックを行い、`e.preventDefault()` を実行する。検索パネルが開いているときはキャンバスのゴーストが表示されない（ノードが選択されていない状態になる）ため、実質的に Tab の競合は発生しない

### コンポーネント編集モードとの関係

- `isEditingComponent === true` のとき、グローバル検索は無効（表示しない、ショートカット無反応）
- コンポーネント編集モードでは `useFlowStore` の `nodes`/`edges` はコンポーネント内部の編集内容を指しているため、検索対象が本来と異なる危険がある

### 差分比較モードとの関係

- `isDiffMode === true` のとき、グローバル検索は無効
- DiffCanvas は独立した ReactFlowProvider を使うため、FlowCanvas の `reactFlowInstance.current` とは別物。`flowmaid:jumpTo` イベントは FlowCanvas.tsx のリスナーが受け取るため、DiffMode 中はキャンバスが存在せずイベントが空振りする（問題なし）

---

## 段階実装の提案

### Phase MVP（最小実装）

1. `useGlobalSearch.ts` の実装（ノード・エッジのラベル/ID部分一致）
2. `GlobalSearchPanel.tsx` の実装（入力欄 + ScrollArea リスト + Esc で閉じる）
3. `FlowCanvas.tsx` への `flowmaid:jumpTo` リスナー追加
4. `EditorLayout.tsx` への `isSearchOpen` ステートと条件レンダリング追加
5. `useKeyboardShortcuts.ts` への Ctrl+Shift+F ハンドラ追加
6. i18n キー追加（`globalSearch*` 4件）

MVP での非対応事項:
- ラベルのハイライト表示（`<mark>` タグ）
- next/prev ナビゲーターUI
- コンポーネントインスタンスの `[comp]` タグ
- Ctrl+F のブラウザデフォルト奪取

### Phase 拡張

- マッチ箇所の `<mark>` ハイライト
- next/prev インジケーターと [↑][↓] ボタン
- Ctrl+F のブラウザデフォルト奪取（`e.preventDefault()` 追加）
- HelpPanel の操作ガイドにショートカット追記
- コンポーネントインスタンスの `[comp]` タグ表示
- 複数語スペース区切り AND 検索

---

## 注意事項・制約

- `Ctrl+F` はブラウザがデフォルトで検索バーを開くため、`e.preventDefault()` を確実に呼ぶ必要がある。ブラウザによっては `keydown` 時点で介入できない場合があるため、`Ctrl+Shift+F` を主ショートカットとして案内する
- `reactFlowInstance.current.fitView()` は ReactFlowProvider のスコープ外から呼べない。そのため `flowmaid:jumpTo` カスタムイベント経由で FlowCanvas.tsx 内部からのみ実行する（EditorLayout から直接呼ばない）
- zustandセレクタ内で他のセレクタ結果（クロージャ変数）を参照してはいけない（CLAUDE.md 記載の stale値問題）。`useGlobalSearch` 内で `nodes` と `edges` は必ず独立したセレクタで取得する
- undo/redo 履歴には選択状態の変更を積まない（`useFlowStore.setState` で直接更新）
- コンポーネント子ノード（`componentParentId` あり）はフィルタリング段階で除外し、検索結果に表示しない
