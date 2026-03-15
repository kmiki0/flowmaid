"use client";

import { useEffect, useRef } from "react";
import { useUndoRedo } from "./useUndoRedo";
import { useFlowStore } from "@/store/useFlowStore";
import type { FlowNode, FlowEdge } from "@/store/types";
import { counterToId } from "@/lib/id";

interface ClipboardData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

let clipboard: ClipboardData | null = null;

export function useKeyboardShortcuts() {
  const { undo, redo } = useUndoRedo();
  const storeRef = useRef(useFlowStore);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const isCtrl = e.ctrlKey || e.metaKey;

      if (isCtrl && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      if (isCtrl && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }

      if (isCtrl && e.key === "Z") {
        e.preventDefault();
        redo();
      }

      if (isCtrl && e.key === "s") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("flowmaid:export"));
      }

      // Select all nodes and edges
      if (isCtrl && e.key === "a") {
        e.preventDefault();
        const state = storeRef.current.getState();
        storeRef.current.setState({
          nodes: state.nodes.map((n) => ({ ...n, selected: true })),
          edges: state.edges.map((edge) => ({ ...edge, selected: true })),
        });
      }

      // Copy selected nodes
      if (isCtrl && e.key === "c") {
        const state = storeRef.current.getState();
        const selectedNodes = state.nodes.filter((n) => n.selected);
        if (selectedNodes.length === 0) return;
        const nodeIds = new Set(selectedNodes.map((n) => n.id));
        const relatedEdges = state.edges.filter(
          (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)
        );
        clipboard = { nodes: selectedNodes, edges: relatedEdges };
      }

      // Paste
      if (isCtrl && e.key === "v") {
        if (!clipboard || clipboard.nodes.length === 0) return;
        e.preventDefault();
        const state = storeRef.current.getState();
        let counter = state.nextIdCounter;
        const idMap = new Map<string, string>();

        const newNodes: FlowNode[] = clipboard.nodes.map((n) => {
          const newId = counterToId(counter++);
          idMap.set(n.id, newId);
          return {
            ...n,
            id: newId,
            position: { x: n.position.x + 30, y: n.position.y + 30 },
            data: { ...n.data },
            selected: true,
          };
        });

        const newEdges: FlowEdge[] = clipboard.edges.map((edge) => {
          const newSource = idMap.get(edge.source) ?? edge.source;
          const newTarget = idMap.get(edge.target) ?? edge.target;
          return {
            ...edge,
            id: `${newSource}-${newTarget}-${edge.sourceHandle ?? "d"}-${edge.targetHandle ?? "d"}`,
            source: newSource,
            target: newTarget,
            selected: false,
          };
        });

        // Deselect existing nodes
        const deselectedNodes = state.nodes.map((n) => ({ ...n, selected: false }));

        storeRef.current.setState({
          nodes: [...deselectedNodes, ...newNodes],
          edges: [...state.edges, ...newEdges],
          nextIdCounter: counter,
        });
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);
}
