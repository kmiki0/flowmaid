"use client";

import { memo, useCallback, useState, useMemo } from "react";
import { perfCount } from "@/lib/perf";
import { Copy, Check, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMermaidOutput } from "@/hooks/useMermaidOutput";
import { useFlowStore } from "@/store/useFlowStore";
import { serializeFiltered } from "@/lib/flowmaid/serialize";
import { highlightFlowmaid, type HighlightTokenType } from "@/lib/flowmaid/highlight";
import { useLocale } from "@/lib/i18n/useLocale";

const TOKEN_COLORS: Record<HighlightTokenType, string | undefined> = {
  plain: undefined,
  keyword: "var(--fm-mermaid-kw)",
  string: "var(--fm-mermaid-str)",
  dim: "var(--fm-text-dim)",
};

const HighlightedCode = memo(function HighlightedCode({ text }: { text: string }) {
  const lines = useMemo(() => highlightFlowmaid(text), [text]);
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {line.tokens.map((tok, j) => (
            <span key={j} style={TOKEN_COLORS[tok.type] ? { color: TOKEN_COLORS[tok.type] } : undefined}>
              {tok.text}
            </span>
          ))}
          {"\n"}
        </span>
      ))}
    </>
  );
});

const selectSelectedNodeIds = (s: { nodes: { id: string; selected?: boolean }[] }) =>
  s.nodes.filter((n) => n.selected).map((n) => n.id).join(",");
const selectSelectedEdgeIds = (s: { edges: { id: string; selected?: boolean }[] }) =>
  s.edges.filter((e) => e.selected).map((e) => e.id).join(",");

function CopyButton({ text, label, tooltip }: { text: string; label: string; tooltip: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px] gap-1"
          onClick={handleCopy}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {label}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function MermaidPreview({ onClose }: { onClose?: () => void }) {
  perfCount("MermaidPreview");
  const { mermaid, full } = useMermaidOutput();
  const { t } = useLocale();

  const selectedNodeIdStr = useFlowStore(selectSelectedNodeIds);
  const selectedEdgeIdStr = useFlowStore(selectSelectedEdgeIds);
  const selectedNodeIds = useMemo(() => selectedNodeIdStr ? selectedNodeIdStr.split(",") : [], [selectedNodeIdStr]);
  const selectedEdgeIds = useMemo(() => selectedEdgeIdStr ? selectedEdgeIdStr.split(",") : [], [selectedEdgeIdStr]);

  const hasSelection = selectedNodeIds.length > 0 || selectedEdgeIds.length > 0;

  const displayed = useMemo(() => {
    if (!hasSelection) return full;
    const s = useFlowStore.getState();
    return serializeFiltered(
      s.nodes, s.edges, s.direction, s.componentDefinitions,
      selectedNodeIds, selectedEdgeIds
    );
  }, [full, hasSelection, selectedNodeIds, selectedEdgeIds]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
Output
        </h3>
        <div className="flex items-center gap-1">
          <CopyButton text={mermaid} label="Mermaid" tooltip={t("copyMermaid")} />
          <CopyButton text={full} label="All" tooltip={t("copyAll")} />
          {onClose && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
              <X size={12} />
            </Button>
          )}
        </div>
      </div>
      <ScrollArea className="flex-1 p-3">
        <pre className="text-xs font-mono whitespace-pre-wrap break-all">
          <HighlightedCode text={displayed} />
        </pre>
      </ScrollArea>
    </div>
  );
}
