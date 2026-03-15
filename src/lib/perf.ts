/**
 * パフォーマンス計測ユーティリティ
 *
 * 使い方:
 *   ブラウザコンソールで `window.__PERF_ENABLED__ = true` を実行すると計測開始
 *   `window.__PERF_REPORT__()` でレポート表示
 *   `window.__PERF_RESET__()` でカウンタリセット
 *   `window.__PERF_ENABLED__ = false` で計測停止
 */

declare global {
  interface Window {
    __PERF_ENABLED__: boolean;
    __PERF_REPORT__: () => void;
    __PERF_RESET__: () => void;
  }
}

interface PerfEntry {
  renderCount: number;
  totalMs: number;
  maxMs: number;
  lastMs: number;
}

const entries = new Map<string, PerfEntry>();

function getEntry(name: string): PerfEntry {
  let entry = entries.get(name);
  if (!entry) {
    entry = { renderCount: 0, totalMs: 0, maxMs: 0, lastMs: 0 };
    entries.set(name, entry);
  }
  return entry;
}

/** レンダリング回数をカウント（コンポーネント先頭で呼ぶ） */
export function perfCount(name: string): void {
  if (typeof window === "undefined" || !window.__PERF_ENABLED__) return;
  const entry = getEntry(name);
  entry.renderCount++;
}

/** 処理時間を計測開始 */
export function perfStart(name: string): number {
  if (typeof window === "undefined" || !window.__PERF_ENABLED__) return 0;
  return performance.now();
}

/** 処理時間を計測終了 */
export function perfEnd(name: string, startTime: number): void {
  if (typeof window === "undefined" || !window.__PERF_ENABLED__ || startTime === 0) return;
  const elapsed = performance.now() - startTime;
  const entry = getEntry(name);
  entry.totalMs += elapsed;
  entry.lastMs = elapsed;
  if (elapsed > entry.maxMs) entry.maxMs = elapsed;
}

/** コンソールにレポート出力 */
function report(): void {
  const sorted = [...entries.entries()].sort((a, b) => b[1].renderCount - a[1].renderCount);

  console.group("%c📊 Perf Report", "font-size: 14px; font-weight: bold;");
  console.table(
    Object.fromEntries(
      sorted.map(([name, e]) => [
        name,
        {
          renders: e.renderCount,
          "avg(ms)": e.renderCount > 0 ? +(e.totalMs / e.renderCount).toFixed(2) : 0,
          "max(ms)": +e.maxMs.toFixed(2),
          "last(ms)": +e.lastMs.toFixed(2),
          "total(ms)": +e.totalMs.toFixed(2),
        },
      ])
    )
  );
  console.groupEnd();
}

/** カウンタリセット */
function reset(): void {
  entries.clear();
  console.log("%c🔄 Perf counters reset", "color: gray;");
}

// グローバル関数を登録
if (typeof window !== "undefined") {
  window.__PERF_ENABLED__ = false;
  window.__PERF_REPORT__ = report;
  window.__PERF_RESET__ = reset;
}
