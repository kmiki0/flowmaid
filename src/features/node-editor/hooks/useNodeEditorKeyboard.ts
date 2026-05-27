"use client";

import { useEffect, useRef } from "react";
import { useNodeEditorStore } from "../store/useNodeEditorStore";
import type { NodeEditorNode, NodeEditorEdge } from "../store/types";

interface ClipboardData {
  nodes: NodeEditorNode[];
  edges: NodeEditorEdge[];
}

const clipboardRef: { current: ClipboardData | null } = { current: null };

export function useNodeEditorKeyboard() {
  const storeRef = useRef(useNodeEditorStore);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Skip if typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;

      // Ctrl+C — Copy
      if (isCtrl && e.key === "c") {
        const state = storeRef.current.getState();
        const selectedNodes = state.nodes.filter((n) => n.selected);
        if (selectedNodes.length === 0) return;

        e.preventDefault();
        const selectedIds = new Set(selectedNodes.map((n) => n.id));
        const selectedEdges = state.edges.filter(
          (edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target)
        );
        clipboardRef.current = { nodes: selectedNodes, edges: selectedEdges };
      }

      // Ctrl+V — Paste
      if (isCtrl && e.key === "v") {
        if (!clipboardRef.current || clipboardRef.current.nodes.length === 0) return;

        e.preventDefault();
        const state = storeRef.current.getState();
        const { nodes: copiedNodes, edges: copiedEdges } = clipboardRef.current;

        // Generate new IDs
        let counter = state.nextIdCounter;
        const idMap = new Map<string, string>();

        function counterToId(n: number): string {
          let result = "";
          let val = n;
          do {
            result = String.fromCharCode(65 + (val % 26)) + result;
            val = Math.floor(val / 26) - 1;
          } while (val >= 0);
          return result;
        }

        const newNodes: NodeEditorNode[] = [];
        for (const node of copiedNodes) {
          const newId = counterToId(counter);
          idMap.set(node.id, newId);
          newNodes.push({
            ...node,
            id: newId,
            position: {
              x: (node.position?.x ?? 0) + 40,
              y: (node.position?.y ?? 0) + 40,
            },
            data: { ...node.data, isNew: true },
            selected: true,
          });
          counter++;
        }

        // Remap edges
        const newEdges: NodeEditorEdge[] = [];
        let edgeIdx = 0;
        for (const edge of copiedEdges) {
          const newSource = idMap.get(edge.source);
          const newTarget = idMap.get(edge.target);
          if (!newSource || !newTarget) continue;

          // Remap handle IDs
          const sourceHandle = edge.sourceHandle?.replace(
            /^port-(.+)-(source|target)$/,
            (_, portId, suffix) => `port-${portId}-${suffix}`
          );
          const targetHandle = edge.targetHandle?.replace(
            /^port-(.+)-(source|target)$/,
            (_, portId, suffix) => `port-${portId}-${suffix}`
          );

          newEdges.push({
            ...edge,
            id: `${newSource}-${newTarget}-paste${edgeIdx++}`,
            source: newSource,
            target: newTarget,
            sourceHandle: sourceHandle ?? edge.sourceHandle,
            targetHandle: targetHandle ?? edge.targetHandle,
            selected: false,
          });
        }

        // Deselect existing nodes
        const deselectedNodes = state.nodes.map((n) => ({ ...n, selected: false }));

        storeRef.current.setState({
          nodes: [...deselectedNodes, ...newNodes],
          edges: [...state.edges, ...newEdges],
          nextIdCounter: counter,
        });

        // Clear isNew flags
        setTimeout(() => {
          storeRef.current.setState((s) => ({
            nodes: s.nodes.map((n) =>
              n.data.isNew ? { ...n, data: { ...n.data, isNew: false } } : n
            ),
          }));
        }, 300);
      }

      // Ctrl+Z — Undo
      if (isCtrl && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        storeRef.current.temporal.getState().undo();
      }

      // Ctrl+Shift+Z — Redo
      if (isCtrl && e.shiftKey && e.key === "z") {
        e.preventDefault();
        storeRef.current.temporal.getState().redo();
      }

      // Ctrl+A — Select all
      if (isCtrl && e.key === "a") {
        e.preventDefault();
        const state = storeRef.current.getState();
        storeRef.current.setState({
          nodes: state.nodes.map((n) => ({ ...n, selected: true })),
          edges: state.edges.map((e) => ({ ...e, selected: true })),
        });
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}
