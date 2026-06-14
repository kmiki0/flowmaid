# スマートコネクト 仕様書

## 概要

Lucidchart / draw.io 的な操作感を目指す接続UX強化機能。
以下の2つの独立したサブ機能で構成し、それぞれ単体で実装・有効化できる。

- **A: 磁石スナップ（Magnetic Snap）** — エッジ接続ドラッグ中、カーソルがノード近辺に近づくと最寄りハンドルへ自動吸着
- **B: 自動ルーティング強化（Auto-Routing Enhancement）** — 折れ線（step）エッジの障害物回避精度向上 + 新規エッジ作成時のハンドル自動選択

---

## 1. 現状の構造整理

設計判断の前提として、既存実装の主要な構成要素を整理する。

### 1-1. 接続フロー（FlowCanvas.tsx）

| フック / 関数 | 役割 |
|---|---|
| `onConnectStart` | ドラッグ開始。リングハンドルによる付け替えか新規接続かを判定し、`reconnectingEdgeRef` / `reconnectingTypeRef` をセット。固定端 (`reconnectFixedEnd`) を計算 |
| `ReconnectConnectionLine` | ドラッグ中の接続ラインをカスタム描画。`reconnectFixedEnd` があれば固定端→カーソルへ描画 |
| `onConnect(connection)` | ドロップ成功時。付け替えなら `reconnectEdge`、新規なら `addEdge`。ハンドルIDのsuffix正規化（`-source`/`-target`）をここで実施 |
| `onConnectEnd` | ドロップ失敗（キャンセル）時のクリーンアップ |
| `ConnectionMode.Loose` | ターゲット側ハンドルからのドラッグも許可（React Flowが内部でsource/targetをスワップする） |
| `connectOnClick={false}` | クリックによる接続は無効 |

### 1-2. ハンドル構成（ConnectHandle.tsx / NodeWrapper.tsx）

- 各ノードに4方向（`top`, `right`, `bottom`, `left`）× 2種（`source`, `target`）= 8ハンドル
- ハンドルID命名規則: `{direction}-{type}`（例: `bottom-source`, `top-target`）
- **表示ルール**: ノードホバー時のみドット表示、ノード選択時は非表示（パフォーマンス最適化）
- **リングハンドル**: エッジ選択時 or ホバー中ノードで接続済みハンドルに ⊙ 表示
- **ヒットエリア**: 30px 透明ラッパー + ズーム補正 `calc(size / var(--rf-zoom, 1))`

### 1-3. 折れ線ノード回避ルーティング（LabeledEdge.tsx）

| 関数 | 役割 |
|---|---|
| `computeStepCorners` | 方向別 waypoint 生成（2コーナー基本パス） |
| `computeStepCornersAvoidingNodes` | 2コーナーパスのみ midY/midX シフトでノード回避（最大5回反復） |
| `getObstacleRects` | ソース/ターゲット以外の全トップレベル可視ノードのバウンディングボックス取得 |
| `segOverlapsRect` | 軸平行セグメント vs 矩形の衝突判定（マージン付き） |
| `buildWaypointPath` | waypoint列 → SVGパス文字列（角丸Q曲線付き） |

**既存の限界:**
- 回避できるのは「2コーナー基本パス」の中間セグメント（midY or midX）のみ
- 複数の障害物が上下両側にある場合、単純な「上か下か」の2択しかなくループしうる
- L字パス（1コーナー）やU字迂回パス（same-direction handles）は回避未対応
- 3個以上のwaypointがある手動編集パスには一切手を加えない（意図的）

### 1-4. パフォーマンス上の制約（CLAUDE.md / memory）

- zustand セレクタからは `s.nodes` 全体を返してはいけない（ドラッグ中に毎フレーム再レンダリング）
- セレクタはプリミティブか安定参照を返す
- イベント駆動コールバック内では `useFlowStore.getState()` で都度取得するのが安全

---

## 2. 実装方針の検討

### A: 磁石スナップ

#### 案A-1: React Flow の `isValidConnection` + カスタム検出
- `isValidConnection` コールバック内でターゲットノードを検出し、最寄りハンドルをハイライト
- **問題**: `isValidConnection` はハンドル上にカーソルが乗った時点でしか呼ばれず、「ノード近辺に近づいたら吸着」は実現不可

#### 案A-2: `onConnectStart` + mousemove リスナーでカーソル位置を監視
- ドラッグ開始時に `mousemove` リスナーを登録し、カーソル座標を `screenToFlowPosition` でフロー座標変換
- 全ノードのバウンディングボックスとの距離を比較し、閾値以内なら「吸着候補ハンドル」を state にセット
- `connectionLineComponent` 内で吸着候補ハンドルの位置に線を引き寄せる
- **問題**: mousemove はドラッグ中に毎フレーム発火するため、フロー座標変換 + 全ノードスキャンのコストが高い。React.stateへのset毎フレーム呼び出しで再レンダリング多発

#### 案A-3（推奨）: `onConnectStart` + pointermove リスナー + ref ベースの軽量実装
- ドラッグ開始時に `pointermove` リスナーを登録（`window` ではなく `ReactFlow` のラッパー要素に限定）
- カーソル位置を `reactFlowInstance.screenToFlowPosition()` でフロー座標に変換
- 吸着候補を `useRef` に保持（stateではなくref → 再レンダリングなし）
- 視覚フィードバックはDOMへの直接クラス付与で実現（ReactのstateやzustandのstateをDOMに反映せず）
- `onConnect` 時に吸着候補 ref からハンドルIDを読み取り、接続に使用
- **採用理由**: 毎フレームの再レンダリングを完全に回避しながら、吸着の視覚フィードバックと接続補正の両方を実現できる

### B: 自動ルーティング強化

#### 案B-1: 既存の midY/midX シフト方式を多障害物対応に拡張
- 現在の「上か下か2択」を「全候補位置を生成して最小コスト選択」に変える
- **限界**: 複雑なレイアウトでは依然として行き詰まりケースが発生。L字・U字パスには未対応

#### 案B-2: A*アルゴリズムによるグリッドルーティング
- キャンバスをグリッド（例: 20px単位）に分割、ノードをOBSTACLE、その他をWALKABLEとしてA*で経路探索
- **問題**: グリッド解像度が低いと見た目が粗く、高いとパス計算コストが爆発。ノード数が多いと毎回の再計算が重い。React Flow のwaypointに変換する手順も複雑

#### 案B-3（推奨）: 既存方式の段階的改善 + ハンドル自動選択の追加
- **回避改善**: 2コーナーパスの回避で「上下の最良を比較して選択」を「全障害物をスキャンして複数候補を生成し衝突スコアで選択」に改善
- **新機能（ハンドル自動選択）**: 新規エッジ作成時（`onConnect` 内で付け替えでない場合）、sourceHandle/targetHandleが指定されていない場合にソース/ターゲットの相対位置から最適辺を選択して注入
- **採用理由**: 既存アーキテクチャへの侵食が最小限。既存waypoint編集との非干渉ルールを確実に維持できる。A*よりも実装リスクが低く段階的に拡張できる

---

## 3. 推奨実装方針

### A: 磁石スナップ（案A-3）

ドラッグ中のカーソル位置を ref で追跡し、DOM クラス付与で視覚フィードバック、`onConnect` 時に吸着結果を注入する。

**判定アルゴリズム**:
1. ドラッグ中のカーソルのフロー座標 `(cx, cy)` を取得
2. 全ノードをスキャンし、ノードのバウンディングボックスとカーソルの距離を計算
3. `MAGNET_NODE_THRESHOLD`（推奨: 50px）以内のノードを「磁石対象」として抽出
4. 磁石対象ノードの各ハンドル（4方向 × 2種 = 8点）とカーソルの距離を計算
5. `MAGNET_HANDLE_THRESHOLD`（推奨: 60px）以内で最も近いハンドルを「吸着候補」とする
6. 吸着候補のハンドル種別（source/target）はドラッグ種別（新規接続 vs 付け替え）に応じて絞り込む

**接続への注入**:
- `onConnect` 呼び出し時、吸着候補 ref が有効なら connection の sourceHandle/targetHandle を上書き
- 上書き後、ハンドルID suffix を既存の正規化ロジック（`${pos}-source` / `${pos}-target`）でそのまま処理

**相対位置からの最適辺選択**（ハンドル自動選択と共通ロジック）:
- ソースとターゲットの中心座標の差分 `(dx, dy)` から接続辺を選択
- `|dx| > |dy|` なら水平方向（source=right/left, target=left/right）
- `|dx| <= |dy|` なら垂直方向（source=bottom/top, target=top/bottom）
- dx > 0 ならソースは right、dx < 0 なら left
- dy > 0 ならソースは bottom、dy < 0 なら top

### B: 自動ルーティング強化（案B-3）

#### B-1: 2コーナー回避の多障害物対応

既存の `computeStepCornersAvoidingNodes` の反復ロジックを改善する。

現在の問題点:
- `midY` を上下どちらかにしか移動できず、複数の障害物が上下両側を塞いでいる場合に最良の回避が選べない
- 最大5回のイテレーションでも収束保証がない

改善方針:
- 「上を回避した場合のスコア」「下を回避した場合のスコア」を両方計算して比較
- スコア = 回避後パスと全障害物の最小マージン（大きいほど良い）
- 両方が失敗するケース（全障害物が完全に上下を塞ぐ）ではフォールバックとして直線パスを採用

#### B-2: ハンドル自動選択

新規エッジ作成時（`onConnect` 内で `reconnectingEdgeRef.current` が null の場合）:
- `connection.sourceHandle` が null（未指定）の場合のみ適用
- `reactFlowInstance.getNode(source)` と `getNode(target)` から中心座標を計算
- 上記の「相対位置からの最適辺選択」ロジックで最適なhandle IDを決定
- `addEdge` に渡す sourceHandle / targetHandle に注入

---

## 4. 変更・追加ファイル

### 新規作成

| ファイルパス | 役割 |
|---|---|
| `src/lib/smart-connect/magnetSnap.ts` | 磁石スナップのコア計算ロジック（pure function群）。`findMagnetTarget`, `computeOptimalHandle`, `getNodeHandlePositions` を export |
| `src/hooks/useMagnetSnap.ts` | FlowCanvas にマウントするカスタムフック。`onConnectStart`/`onConnectEnd` 時にリスナー管理、吸着候補を ref で保持、DOM クラス付与による視覚フィードバック |

### 変更

| ファイルパス | 変更内容 |
|---|---|
| `src/components/canvas/FlowCanvas.tsx` | `useMagnetSnap` フックを追加、`onConnect` 内でハンドル自動選択ロジックを呼び出し |
| `src/components/edges/LabeledEdge.tsx` | `computeStepCornersAvoidingNodes` の多障害物対応改善 |
| `src/lib/constants.ts` | `MAGNET_NODE_THRESHOLD`, `MAGNET_HANDLE_THRESHOLD` 定数を追加 |
| `src/lib/i18n/locales.ts` | 磁石スナップ ON/OFF ツールチップの i18n テキスト追加（追加する場合） |

---

## 5. クラス・関数設計

### `src/lib/smart-connect/magnetSnap.ts`

```
getNodeHandlePositions(node: FlowNode): Array<{ handleId: string; x: number; y: number; type: "source" | "target" }>
  - ノードの position + size からハンドルの絶対フロー座標を計算
  - 8ハンドル（4方向 × source/target）を返す

findMagnetTarget(
  cursorPos: { x: number; y: number },
  nodes: FlowNode[],
  excludeNodeIds: string[],
  preferType: "source" | "target",
  nodeThreshold: number,
  handleThreshold: number,
): { nodeId: string; handleId: string; handlePos: { x: number; y: number } } | null
  - excludeNodeIds: ゴーストノード(prefix "__ghost__")、ブリッジ接続元/先は除外
  - preferType: 新規接続ならtarget、付け替えのsource側ならsource

computeOptimalHandle(
  sourceCenter: { x: number; y: number },
  targetCenter: { x: number; y: number },
  dragType: "source" | "target",
): { sourceHandle: string; targetHandle: string }
  - 相対位置から最適な辺を選択してハンドルIDを返す
```

### `src/hooks/useMagnetSnap.ts`

```
useMagnetSnap(opts: {
  enabled: boolean;
  reactFlowInstance: RefObject<ReactFlowInstance>;
  wrapperRef: RefObject<HTMLDivElement>;
}): {
  magnetTargetRef: RefObject<MagnetTarget | null>;
  onMagnetConnectStart: (params) => void;
  onMagnetConnectEnd: () => void;
}
  - enabled=false の場合はリスナー登録なし（早期 return）
  - pointermove リスナーを wrapperRef 要素に登録（capture=false）
  - 吸着候補を magnetTargetRef に保持（state ではなく ref → 再レンダリング無し）
  - 吸着時: 対象ハンドルの DOM 要素に .magnet-snap-active クラスを付与
  - 非吸着時: .magnet-snap-active クラスを除去
  - 接続終了時: 全 .magnet-snap-active を除去
```

### `FlowCanvas.tsx` の変更点

`onConnect` 内のハンドル自動選択追加部分:
```
// 付け替えでない（新規接続）かつ sourceHandle が未指定の場合
if (!reconnectingEdgeRef.current && !connection.sourceHandle) {
  // reactFlowInstance から source/target ノードの中心を取得
  // computeOptimalHandle で最適ハンドルを決定
  // srcHandle, tgtHandle を上書き
}
```

`connectionLineComponent` の変更:
- 現在の `ReconnectConnectionLine` に磁石吸着中の視覚フィードバックを追加
- 吸着候補がある場合、吸着先ハンドル位置に向かって線を引き寄せる（`toX/toY` を上書き）

### `LabeledEdge.tsx` の変更点

`computeStepCornersAvoidingNodes` の改善:
```
// 現在: 上下どちらかを選んで5回反復
// 改善: 上候補・下候補を両方計算し、衝突スコアで比較
function scoreCandidate(mid: number, segments, rects, margin): number
  - 全障害物との最小距離を返す（0以下 = 衝突）
  - 上候補・下候補のスコアを比較し、高い方を採用
```

---

## 6. 設定トグルの提案

### 磁石スナップ（A）

**推奨: 常時有効、トグル不要**

理由:
- Lucidchart/draw.io の磁石スナップは常時有効が標準的
- 既存のリングハンドル方式と干渉しないため、常時有効でも既存操作を壊さない
- ユーザーが意図的に特定のハンドルに繋げたい場合、ハンドルの真上にカーソルを持っていけば従来通り正確に接続できる（吸着閾値を超えた近さでの優先）

もしトグルが必要な場合:
- `src/lib/constants.ts` に `SMART_CONNECT_STORAGE_KEY = "flowmaid-smart-connect"` を追加
- ツールバーに `Magnet` アイコン（lucide-react の `Magnet`）ボタンを配置
- `FlowCanvas` の `gridSnap`, `ghostEnabled` と同じパターンで props として受け渡す

### 自動ルーティング強化（B）

**推奨: 常時有効、ユーザー設定不要**

理由:
- ハンドル自動選択は新規エッジ作成時のみ機能し、既存エッジに影響しない
- 障害物回避改善はアルゴリズムの精度向上であり、動作の変化は最小限
- ユーザーが手動でwaypointを3個以上追加した場合は既存ルール通り自動回避をスキップ

---

## 7. 既存機能との非干渉確認

### リングハンドル付け替え

- 磁石スナップは `onConnectStart` 時点で `reconnectingEdgeRef` が非 null（付け替えモード）かどうかを確認できる
- 付け替えモードでは磁石スナップのドラッグ開始も行うが、吸着候補は「固定端でないハンドル型」に限定する（例: source側を付け替え中なら target ハンドルへの吸着のみ）
- `onConnect` でのハンドルID suffix正規化（`${pos}-source`/`${pos}-target`）は磁石スナップによるハンドルID上書き後にも同様に適用されるため、既存の正規化ロジックを変更する必要はない

### 予測入力ゴーストノード

- ゴーストノードのIDは `__ghost__` プレフィックスを持つ
- `findMagnetTarget` の `excludeNodeIds` にゴーストノードIDを含めることで、ゴーストノードへの磁石吸着を防ぐ
- ゴーストクリック（実ノード作成）は通常の `onNodeClick` 内で処理され、`onConnect` を経由しないため干渉しない

### コンポーネントのブリッジエッジ

- ブリッジエッジは `data.isBridgeEdge = true` で識別、`selectable: false`
- 磁石スナップの `findMagnetTarget` では、ブリッジエッジが接続されているハンドル（`bridge-entry-source`, `bridge-exit-target`）は通常ノードのハンドル一覧に含まれないため、自然に除外される
- コンポーネントインスタンスノード自体は磁石スナップの対象となるが、ComponentInstanceNode の外部接続ハンドルのみに吸着する

### 手動waypoint編集

- `LabeledEdge.tsx` の既存ルール: `waypoints.length >= 3` の場合は自動回避しない
- この条件は変更しない。改善する `computeStepCornersAvoidingNodes` は `basic.length === 2` の場合のみ呼ばれるため（`computeStepCornersAvoidingNodes` 内の最初の `if (basic.length !== 2) return basic;` チェック）、非干渉が保証される

### BulkEdit モード（一括編集）

- BulkEdit の左側キャンバスは読み取り専用（`NodeEditorCanvas` とは別の独立した `ReactFlowProvider`）
- 磁石スナップは `FlowCanvas.tsx` のみに実装するため、BulkEdit モードには影響しない

### 差分比較モード

- 差分比較の両キャンバスも読み取り専用で `onConnect` は登録されない
- 影響なし

---

## 8. 段階的実装計画

### Phase 1（MVP）: ハンドル自動選択のみ

**変更ファイル**: `FlowCanvas.tsx`, `src/lib/smart-connect/magnetSnap.ts`（`computeOptimalHandle` のみ）, `src/lib/constants.ts`

実装内容:
- `computeOptimalHandle` 関数を `src/lib/smart-connect/magnetSnap.ts` に実装
- `FlowCanvas.tsx` の `onConnect` 内（付け替えでない新規接続、かつ sourceHandle が null の場合）で呼び出し
- `reactFlowInstance.getNode()` でソース/ターゲットの中心座標を取得して注入

検証方法:
- パレットからノードをドロップし、別ノードへドラッグ接続する
- ソースがターゲットより左にある → `right-source` → `left-target` で接続されることを確認
- ソースがターゲットより上にある → `bottom-source` → `top-target` で接続されることを確認
- ゴーストノードクリックで作成したエッジ（`addEdge` 直接呼び出し）は変更されないことを確認

### Phase 2: 自動ルーティング回避改善

**変更ファイル**: `src/components/edges/LabeledEdge.tsx`, `src/lib/constants.ts`

実装内容:
- `computeStepCornersAvoidingNodes` 内でスコアベースの上下比較を実装
- `scoreCandidate` ヘルパー関数を追加
- 既存の5回反復ループを、「上候補」「下候補」の2パスに変更

検証方法:
- ノードAとノードBの間に障害物ノードCを配置
- step エッジでA→Bを接続し、Cを回避することを確認
- Cの上下両方に障害物を配置した場合も正しく回避（よりマージンの広い側を選択）することを確認
- ユーザーが waypoint を3個以上追加した場合、自動回避が発動しないことを確認

### Phase 3: 磁石スナップ（視覚フィードバック付き）

**変更ファイル**: `src/hooks/useMagnetSnap.ts`（新規）, `src/lib/smart-connect/magnetSnap.ts`（`findMagnetTarget`, `getNodeHandlePositions` 追加）, `src/components/canvas/FlowCanvas.tsx`, `src/app/globals.css`（`.magnet-snap-active` スタイル追加）

実装内容:
- `useMagnetSnap` フック実装
- `FlowCanvas.tsx` に `useMagnetSnap` を追加
- `ReconnectConnectionLine` に吸着中の線引き寄せロジックを追加
- `.magnet-snap-active` の CSS スタイル（ハンドルのグロー強調）を追加

検証方法:
- ノードからドラッグし、別ノードに近づいたとき吸着候補ハンドルがハイライトされることを確認
- 閾値外では通常表示に戻ることを確認
- 磁石吸着でドロップした場合、想定のハンドルに接続されることを確認
- ゴーストノードへの吸着が発生しないことを確認
- コンポーネントインスタンスの内部子ノードへの吸着が発生しないことを確認

---

## 9. リスクと対策

| リスク | 内容 | 対策 |
|---|---|---|
| パフォーマンス劣化 | `pointermove` 中の全ノードスキャンが高コスト | ノード数が多い場合は空間インデックス（簡易グリッド）を使うか、スキャン頻度をthrottleする（16ms = 60fps相当）。throttle は `requestAnimationFrame` ベースで実装 |
| 意図しない吸着 | ユーザーが特定のハンドルに接続しようとしているのに別ハンドルに吸着 | 吸着閾値 `MAGNET_HANDLE_THRESHOLD` を保守的な値（60px）に設定。ハンドルの真上（10px以内）の場合はそのハンドルを優先（磁石より近接ハンドルが優先） |
| ハンドルID正規化との競合 | 磁石スナップで注入したハンドルIDを後続の正規化が上書き | 磁石スナップは正規化済みのハンドルID（`{dir}-source`/`{dir}-target`）を返す設計にする。`onConnect` の正規化は磁石スナップ注入後に実行されるが、すでに正しいsuffixなので結果は変わらない |
| `ConnectionMode.Loose` との相互作用 | React Flowがsource/targetをスワップする場合がある | 磁石スナップの吸着候補を確定した後、`onConnect` 内の既存swap-detection（`origNodeId` の比較）と組み合わせる。磁石スナップはハンドルIDのみを注入し、source/targetのスワップ検出は既存ロジックに委ねる |
| `reconnectFixedEnd` モジュール変数 | グローバル変数で付け替えの固定端を管理しているため、磁石スナップ状態と競合する可能性 | `useMagnetSnap` フックは `reconnectingEdgeRef` の状態を参照して「付け替えか新規接続か」を判定し、吸着の preferType を切り替える。既存の `reconnectFixedEnd` 変数には触れない |

---

## 10. 注意事項・制約

- **コンポーネント子ノードへの磁石吸着禁止**: `data.componentParentId` が設定されているノードは `findMagnetTarget` の `excludeNodeIds` に含める
- **ブリッジハンドルへの吸着禁止**: `bridge-entry-source`, `bridge-exit-target` はコンポーネントインスタンスの内部ハンドルであり、ユーザーが直接接続してはいけない。`getNodeHandlePositions` の返却対象から除外する
- **ゴーストノードへの吸着禁止**: `__ghost__` プレフィックスのノードは除外
- **isLocked ノードへの吸着**: コンポーネント編集モードの Entry/Exit ノード（`data.isLocked = true`）は通常キャンバスには存在しないため問題ないが、念のため `isLocked` なノードへの吸着も除外対象とする
- **ズーム補正**: `getNodeHandlePositions` が返すフロー座標はズームに依存しないが、DOM クラス付与によるハイライトはズームに関わらず表示する。CSS 変数 `--rf-zoom` を参照する場合はConnectHandle同様の補正を適用する
- **手動waypoint非干渉ルール**: `computeStepCornersAvoidingNodes` の改善は `waypoints.length <= 2` の場合のみ。この条件は既存コードに存在する `if (basic.length !== 2) return basic;` チェックで保証済み。改善実装でもこのチェックを維持する
