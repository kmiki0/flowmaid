"use client";

import { useMemo, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import type { DiffResult, DiffFilters } from "@/lib/diff/types";
import type { FlowmaidLayout } from "@/lib/flowmaid/schema";
import { computeLineDiff, type DiffTextLine } from "@/lib/diff/formatTextDiff";
import { buildPlainNodesEdges } from "@/lib/diff/buildDiffNodes";
import { generateMermaid } from "@/lib/mermaid/generate";
import { useLocale } from "@/lib/i18n/useLocale";

type DiffViewMode = "unified" | "sideBySide";

/** Extract target ID and type from a Mermaid line */
function extractMermaidTarget(text: string): { id: string; type: "node" | "edge" } | undefined {
  const trimmed = text.trim();
  // Skip graph direction line, subgraph, end, empty
  if (!trimmed || trimmed.startsWith("graph ") || trimmed === "end" || trimmed.startsWith("subgraph ")) return undefined;
  // Edge: "A --> B", "A -->|label| B" — prefix with "edge:" to distinguish
  const edgeMatch = trimmed.match(/^([A-Za-z_]\w*)\s*--/);
  if (edgeMatch) return { id: edgeMatch[1], type: "edge" };
  // Node definition: "A[label]", "A{label}", "A(label)", etc.
  const nodeMatch = trimmed.match(/^([A-Za-z_]\w*)\s*[\[({]/);
  if (nodeMatch) return { id: nodeMatch[1], type: "node" };
  return undefined;
}

interface DiffTextPanelHeaderProps {
  viewMode: DiffViewMode;
  onViewModeChange: (mode: DiffViewMode) => void;
  onExpand?: () => void;
  isCollapsed?: boolean;
}

interface DiffTextPanelProps {
  diffResult: DiffResult;
  filters: DiffFilters;
  baseLayout: FlowmaidLayout;
  compareLayout: FlowmaidLayout;
  viewMode: DiffViewMode;
  onItemClick?: (targetId: string, targetType: "node" | "edge") => void;
}

/** Width reserved for line number gutter (ch units) */
const LINE_NUM_WIDTH = 4;

function DiffLine({ line, onClick }: { line: DiffTextLine; onClick?: () => void }) {
  const isClickable = !!line.targetId && !!onClick;
  const lineNumStr = line.lineNumber != null
    ? String(line.lineNumber).padStart(LINE_NUM_WIDTH, " ")
    : " ".repeat(LINE_NUM_WIDTH);

  let prefix = "  ";
  let rowClass = "text-foreground/70";
  let bgClass = "";

  switch (line.type) {
    case "added":
      prefix = "+ ";
      rowClass = "text-green-600 dark:text-green-400";
      bgClass = "bg-green-500/10";
      break;
    case "deleted":
      prefix = "- ";
      rowClass = "text-red-600 dark:text-red-400";
      bgClass = "bg-red-500/10";
      break;
    case "section":
      rowClass = "text-muted-foreground font-semibold";
      bgClass = "bg-muted/50";
      break;
    case "context":
    default:
      break;
  }

  return (
    <div
      className={`flex font-mono text-xs leading-5 ${bgClass} ${isClickable ? "cursor-pointer hover:bg-muted/30" : ""}`}
      onClick={isClickable ? onClick : undefined}
    >
      <span
        className="select-none text-muted-foreground/50 pr-2 text-right shrink-0"
        style={{ width: `${LINE_NUM_WIDTH + 1}ch` }}
      >
        {lineNumStr}
      </span>
      <span className={`select-none shrink-0 ${rowClass}`}>{prefix}</span>
      <span className={`${rowClass} whitespace-pre`}>{line.text || "\u00A0"}</span>
    </div>
  );
}

/** A single half-cell in the side-by-side view */
interface HalfLine {
  lineNum: number | null;
  text: string;
  type: "context" | "added" | "deleted" | "empty";
  /** Node/edge ID for click-to-flash */
  targetId?: string;
  targetType?: "node" | "edge";
}

/** Side-by-side diff view: paired rows keep left/right always aligned */
function SideBySideDiff({ baseLines, compareLines, onItemClick }: { baseLines: string[]; compareLines: string[]; onItemClick?: (targetId: string, targetType: "node" | "edge") => void }) {
  const diffLines = useMemo(
    () => computeLineDiff(baseLines, compareLines),
    [baseLines, compareLines],
  );

  // Build paired rows: each row has a left half and a right half
  const rows = useMemo(() => {
    const result: { left: HalfLine; right: HalfLine }[] = [];
    let baseLineNum = 0;
    let compareLineNum = 0;

    // Track YAML context to resolve nodeId from line text
    let contextStack: string[] = [];
    const getTargetId = (text: string): string | undefined => {
      const trimmed = text.trimStart();
      const indent = text.length - trimmed.length;
      // Top-level key
      if (indent === 0 && trimmed.endsWith(":") && !trimmed.includes(" ")) {
        contextStack = [trimmed.slice(0, -1)];
        return undefined;
      }
      // Second-level key (node/edge ID)
      if (indent === 2 && trimmed.endsWith(":") && !trimmed.includes(" ")) {
        contextStack = [contextStack[0] ?? "", trimmed.slice(0, -1)];
        return contextStack[0] === "nodes" ? contextStack[1] : undefined;
      }
      // Deeper: return current node context
      if (contextStack.length >= 2 && contextStack[0] === "nodes") {
        return contextStack[1];
      }
      return undefined;
    };

    // Buffer deleted/added lines to pair them side-by-side when possible
    let deletedBuf: HalfLine[] = [];
    let addedBuf: HalfLine[] = [];

    const flushBuffers = () => {
      const max = Math.max(deletedBuf.length, addedBuf.length);
      for (let k = 0; k < max; k++) {
        result.push({
          left: deletedBuf[k] ?? { lineNum: null, text: "", type: "empty" },
          right: addedBuf[k] ?? { lineNum: null, text: "", type: "empty" },
        });
      }
      deletedBuf = [];
      addedBuf = [];
    };

    for (const line of diffLines) {
      const mTarget = extractMermaidTarget(line.text);
      const targetId = mTarget?.id ?? getTargetId(line.text);
      const targetType = mTarget?.type;
      if (line.type === "context") {
        flushBuffers();
        baseLineNum++;
        compareLineNum++;
        result.push({
          left: { lineNum: baseLineNum, text: line.text, type: "context", targetId, targetType },
          right: { lineNum: compareLineNum, text: line.text, type: "context", targetId, targetType },
        });
      } else if (line.type === "deleted") {
        baseLineNum++;
        deletedBuf.push({ lineNum: baseLineNum, text: line.text, type: "deleted", targetId, targetType });
      } else if (line.type === "added") {
        compareLineNum++;
        addedBuf.push({ lineNum: compareLineNum, text: line.text, type: "added", targetId, targetType });
      }
    }
    flushBuffers();

    return result;
  }, [diffLines]);

  const renderHalf = (half: HalfLine, clickHandler?: () => void) => {
    const isClickable = !!half.targetId && half.type !== "empty" && half.type !== "context" && !!clickHandler;
    let rowClass = "text-foreground/70";
    let bgClass = "";
    let prefix = "  ";

    if (half.type === "deleted") {
      rowClass = "text-red-600 dark:text-red-400";
      bgClass = "bg-red-500/10";
      prefix = "- ";
    } else if (half.type === "added") {
      rowClass = "text-green-600 dark:text-green-400";
      bgClass = "bg-green-500/10";
      prefix = "+ ";
    } else if (half.type === "empty") {
      bgClass = "bg-muted/20";
    }

    const lineNumStr = half.lineNum != null
      ? String(half.lineNum).padStart(LINE_NUM_WIDTH, " ")
      : " ".repeat(LINE_NUM_WIDTH);

    return (
      <div
        className={`flex font-mono text-xs leading-5 ${bgClass} ${isClickable ? "cursor-pointer hover:bg-muted/30" : ""}`}
        onClick={isClickable ? clickHandler : undefined}
      >
        <span
          className="select-none text-muted-foreground/50 pr-2 text-right shrink-0"
          style={{ width: `${LINE_NUM_WIDTH + 1}ch` }}
        >
          {lineNumStr}
        </span>
        {half.type !== "empty" && (
          <>
            <span className={`select-none shrink-0 ${rowClass}`}>{prefix}</span>
            <span className={`${rowClass} whitespace-pre`}>{half.text || "\u00A0"}</span>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="h-full overflow-auto">
      <div className="py-1">
        {rows.map((row, i) => (
          <div key={i} className="flex">
            <div className="flex-1 px-2 border-r border-border">
              {renderHalf(row.left, row.left.targetId && row.left.targetType && onItemClick ? () => onItemClick(row.left.targetId!, row.left.targetType!) : undefined)}
            </div>
            <div className="flex-1 px-2">
              {renderHalf(row.right, row.right.targetId && row.right.targetType && onItemClick ? () => onItemClick(row.right.targetId!, row.right.targetType!) : undefined)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Header bar — rendered outside the collapsible panel so it's always visible */
export function DiffTextPanelHeader({ viewMode, onViewModeChange, onExpand, isCollapsed }: DiffTextPanelHeaderProps) {
  const { t } = useLocale();

  return (
    <div className="flex items-center justify-between border-b border-border px-2 shrink-0 bg-foreground/10">
      <div className="flex items-center gap-0.5 py-1">
        <span className="text-xs font-medium text-muted-foreground mr-2">
          {t("diffSourceCode")}
        </span>
        <button
          onClick={() => onViewModeChange("unified")}
          className={`px-2.5 py-1 text-xs rounded-md cursor-pointer transition-colors ${
            viewMode === "unified"
              ? "bg-accent text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          }`}
        >
          {t("diffViewUnified")}
        </button>
        <button
          onClick={() => onViewModeChange("sideBySide")}
          className={`px-2.5 py-1 text-xs rounded-md cursor-pointer transition-colors ${
            viewMode === "sideBySide"
              ? "bg-accent text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          }`}
        >
          {t("diffViewSplit")}
        </button>
      </div>
      <div className="flex items-center gap-0.5">
        {onExpand && (
          <button
            onClick={onExpand}
            className="p-1 rounded-md cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            title="Expand"
          >
            {isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}

export function DiffTextPanel({ diffResult, filters, baseLayout, compareLayout, viewMode, onItemClick }: DiffTextPanelProps) {
  const { t } = useLocale();

  const baseMermaidLines = useMemo(() => {
    const { displayNodes, displayEdges } = buildPlainNodesEdges(baseLayout);
    const mermaid = generateMermaid(displayNodes, displayEdges, baseLayout.direction, baseLayout.componentDefinitions);
    return mermaid.split("\n");
  }, [baseLayout]);

  const compareMermaidLines = useMemo(() => {
    const { displayNodes, displayEdges } = buildPlainNodesEdges(compareLayout);
    const mermaid = generateMermaid(displayNodes, displayEdges, compareLayout.direction, compareLayout.componentDefinitions);
    return mermaid.split("\n");
  }, [compareLayout]);

  const unifiedLines: DiffTextLine[] = useMemo(() => {
    const diff = computeLineDiff(baseMermaidLines, compareMermaidLines);
    return diff.map((line, i) => {
      const target = extractMermaidTarget(line.text);
      return {
        type: line.type,
        text: line.text,
        lineNumber: i + 1,
        targetId: target?.id,
        targetType: target?.type,
      };
    });
  }, [baseMermaidLines, compareMermaidLines]);

  const isEmpty = unifiedLines.length === 0;

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Content */}
      <div className="flex-1 overflow-auto">
        {viewMode === "sideBySide" ? (
          <SideBySideDiff baseLines={baseMermaidLines} compareLines={compareMermaidLines} onItemClick={onItemClick} />
        ) : isEmpty ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            {t("diffNoDifferences")}
          </div>
        ) : (
          <div className="py-1 px-2">
            {unifiedLines.map((line, i) => (
              <DiffLine
                key={i}
                line={line}
                onClick={line.targetId && line.targetType && onItemClick ? () => onItemClick(line.targetId!, line.targetType as "node" | "edge") : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
