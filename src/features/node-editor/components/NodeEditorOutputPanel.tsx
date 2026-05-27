"use client";

import { useMemo, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNodeEditorStore } from "../store/useNodeEditorStore";
import { generateErDiagram } from "../lib/generateErDiagram";
import { useLocale } from "@/lib/i18n/useLocale";
import { useState } from "react";

export function NodeEditorOutputPanel() {
  const nodes = useNodeEditorStore((s) => s.nodes);
  const edges = useNodeEditorStore((s) => s.edges);
  const subMode = useNodeEditorStore((s) => s.subMode);
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);

  const output = useMemo(() => {
    if (subMode === "er-diagram") {
      return generateErDiagram(nodes, edges);
    }
    // JSON output for other modes
    return JSON.stringify(
      {
        nodes: nodes.map((n) => ({
          id: n.id,
          label: n.data.label,
          kind: n.data.kind,
          ports: n.data.ports,
          position: n.position,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourcePortId: e.data?.sourcePortId,
          targetPortId: e.data?.targetPortId,
          cardinality: e.data?.cardinality,
        })),
      },
      null,
      2
    );
  }, [nodes, edges, subMode]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [output]);

  const formatLabel = subMode === "er-diagram" ? "Mermaid erDiagram" : "JSON";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground">{formatLabel}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleCopy}
          title={t("copyMermaid")}
        >
          {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
        </Button>
      </div>

      {/* Output */}
      <div className="flex-1 overflow-auto p-3">
        {output ? (
          <pre className="text-xs font-mono whitespace-pre-wrap break-words text-foreground">
            {output}
          </pre>
        ) : (
          <div className="text-xs text-muted-foreground">
            {subMode === "er-diagram" ? t("neNoTables") : t("neNoNodes")}
          </div>
        )}
      </div>
    </div>
  );
}
