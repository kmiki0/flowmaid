"use client";

import { useMemo } from "react";
import { useFlowStore } from "@/store/useFlowStore";
import { useLocale } from "@/lib/i18n/useLocale";
import { Button } from "@/components/ui/button";

function hasPath(
  edges: { source: string; target: string }[],
  from: string | null,
  to: string | null
): boolean {
  if (!from || !to) return false;
  if (from === to) return true;
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }
  const visited = new Set<string>();
  const queue = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === to) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of adj.get(current) ?? []) {
      queue.push(next);
    }
  }
  return false;
}

export function ComponentEditingHeader() {
  const { t } = useLocale();
  const editingComponentId = useFlowStore((s) => s.editingComponentId);
  const definitions = useFlowStore((s) => s.componentDefinitions);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const exitComponentEditMode = useFlowStore((s) => s.exitComponentEditMode);
  const discardComponentEdit = useFlowStore((s) => s.discardComponentEdit);

  const def = definitions.find((d) => d.id === editingComponentId);

  const isConnected = useMemo(() => {
    if (!def) return false;
    const nodeIds = new Set(nodes.map((n) => n.id));
    const entryExists = def.entryNodeId && nodeIds.has(def.entryNodeId);
    const exitExists = def.exitNodeId && nodeIds.has(def.exitNodeId);
    if (!entryExists || !exitExists) return false;
    return hasPath(edges, def.entryNodeId, def.exitNodeId);
  }, [def, nodes, edges]);

  const handleBack = () => {
    if (isConnected) {
      exitComponentEditMode();
    } else {
      if (window.confirm(t("discardComponentConfirm"))) {
        discardComponentEdit();
      } else {
        return;
      }
    }
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("flowmaid:fitview"));
    }, 50);
  };

  if (!def) return <div />;

  const headerText = def.version === 1
    ? t("componentEditingNew")
    : `${t("componentEditingName")} ( ${def.name} )`;

  return (
    <div className="flex items-center justify-between px-4 py-1.5 shrink-0 text-background">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">{headerText}</span>
      </div>
      <div className="flex items-center gap-3">
        {isConnected ? (
          <span className="flex items-center gap-1 text-xs text-green-400 dark:text-green-600">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 8 7 12 13 4" />
            </svg>
            {t("entryExitConnected")}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-red-400 dark:text-red-600">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
            {t("entryExitDisconnected")}
          </span>
        )}
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs px-3"
          onClick={handleBack}
        >
          {t("backToMainFlow")}
        </Button>
      </div>
    </div>
  );
}
