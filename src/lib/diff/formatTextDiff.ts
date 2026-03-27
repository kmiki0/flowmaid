export interface DiffTextLine {
  type: "added" | "deleted" | "context" | "section";
  text: string;
  lineNumber?: number;
  /** Node or edge ID for click-to-flash */
  targetId?: string;
  targetType?: "node" | "edge" | "componentDef";
}

/**
 * Compute a unified diff between two text arrays using a simple LCS-based approach.
 * Returns lines tagged as added/deleted/context.
 */
export function computeLineDiff(
  baseLines: string[],
  compareLines: string[]
): { type: "added" | "deleted" | "context"; text: string; baseLine?: number; compareLine?: number }[] {
  const m = baseLines.length;
  const n = compareLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (baseLines[i - 1] === compareLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  let i = m;
  let j = n;

  const lines: { type: "added" | "deleted" | "context"; text: string; baseLine?: number; compareLine?: number }[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && baseLines[i - 1] === compareLines[j - 1]) {
      lines.push({ type: "context", text: baseLines[i - 1], baseLine: i, compareLine: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      lines.push({ type: "added", text: compareLines[j - 1], compareLine: j });
      j--;
    } else {
      lines.push({ type: "deleted", text: baseLines[i - 1], baseLine: i });
      i--;
    }
  }

  lines.reverse();
  return lines;
}
