"use client";

import { useCallback, useState, useMemo } from "react";
import { perfCount } from "@/lib/perf";
import { Copy, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMermaidOutput } from "@/hooks/useMermaidOutput";
import { useFlowStore } from "@/store/useFlowStore";
import { serializeFiltered } from "@/lib/flowmaid/serialize";
import { useLocale } from "@/lib/i18n/useLocale";

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

export function MermaidPreview() {
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
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
Output
        </h3>
        <div className="flex gap-1">
          <CopyButton text={mermaid} label="Mermaid" tooltip={t("copyMermaid")} />
          <CopyButton text={full} label="All" tooltip={t("copyAll")} />
        </div>
      </div>
      <ScrollArea className="flex-1 p-3">
        <pre className="text-xs font-mono whitespace-pre-wrap break-all">
          {displayed}
        </pre>
      </ScrollArea>
    </div>
  );
}
