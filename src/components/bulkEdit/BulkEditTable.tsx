"use client";

import { memo, useCallback, useRef, useMemo, useState } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useFlowStore } from "@/store/useFlowStore";
import { useLocale } from "@/lib/i18n/useLocale";
import { BulkEditNodeIcon } from "./BulkEditNodeIcon";
import { BulkEditEdgeIcon } from "./BulkEditEdgeIcon";
import type { FlowNode, FlowEdge } from "@/store/types";
import type { FlowDirection } from "@/types/flow";
import type { NodeShape, EdgeType } from "@/types/flow";
import type { TranslationKey } from "@/lib/i18n/locales";

type ViewMode = "category" | "flow";
type BulkEditItem =
  | { kind: "node"; node: FlowNode }
  | { kind: "edge"; edge: FlowEdge }
  | { kind: "section"; label: string };

interface BulkEditTableProps {
  onFocusNode: (nodeId: string) => void;
  onFocusEdge: (edgeId: string) => void;
  highlightId: string | null;
  selectedIds: string[];
}

const SHAPE_FILTER_OPTIONS: { value: NodeShape; key: TranslationKey }[] = [
  { value: "rectangle", key: "rectangle" },
  { value: "roundedRect", key: "roundedRect" },
  { value: "diamond", key: "diamond" },
  { value: "circle", key: "circle" },
  { value: "stadium", key: "stadium" },
  { value: "parallelogram", key: "parallelogram" },
  { value: "cylinder", key: "cylinder" },
  { value: "hexagon", key: "hexagon" },
  { value: "trapezoid", key: "trapezoid" },
  { value: "document", key: "document" },
  { value: "predefinedProcess", key: "predefinedProcess" },
  { value: "manualInput", key: "manualInput" },
  { value: "internalStorage", key: "internalStorage" },
  { value: "display", key: "display" },
  { value: "text", key: "freeText" },
];

const EDGE_FILTER_OPTIONS: { value: EdgeType; key: TranslationKey }[] = [
  { value: "bezier", key: "bezier" },
  { value: "straight", key: "straight" },
  { value: "step", key: "step" },
];

const DEFAULT_EDGE_TYPE: EdgeType = "bezier";

// ---- Row components ----

const NodeRow = memo(function NodeRow({
  node,
  isHighlighted,
  onFocus,
  onLabelChange,
  index,
  inputRefsRef,
}: {
  node: FlowNode;
  isHighlighted: boolean;
  onFocus: (id: string) => void;
  onLabelChange: (id: string, label: string) => void;
  index: number;
  inputRefsRef: React.RefObject<(HTMLInputElement | null)[]>;
}) {
  const isComponentInstance = !!node.data.componentDefinitionId;
  const displayLabel = isComponentInstance
    ? (node.data.componentInstanceName ?? node.data.label)
    : node.data.label;

  const setRef = useCallback(
    (el: HTMLInputElement | null) => {
      if (inputRefsRef.current) inputRefsRef.current[index] = el;
    },
    [index, inputRefsRef]
  );

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors ${
        isHighlighted ? "bg-primary/10" : "hover:bg-muted/50"
      }`}
      onClick={() => onFocus(node.id)}
    >
      <BulkEditNodeIcon
        shape={node.data.shape}
        fillColor={node.data.fillColor}
        fillOpacity={node.data.fillOpacity}
        fillLightness={node.data.fillLightness}
        borderColor={node.data.borderColor}
        borderOpacity={node.data.borderOpacity}
        borderLightness={node.data.borderLightness}
        borderWidth={node.data.borderWidth}
        borderStyle={node.data.borderStyle}
      />
      <Input
        ref={setRef}
        className="h-7 text-sm flex-1"
        value={displayLabel}
        onChange={(e) => onLabelChange(node.id, e.target.value)}
        onFocus={() => onFocus(node.id)}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
});

const EdgeRow = memo(function EdgeRow({
  edge,
  isHighlighted,
  onFocus,
  onLabelChange,
  index,
  inputRefsRef,
}: {
  edge: FlowEdge;
  isHighlighted: boolean;
  onFocus: (id: string) => void;
  onLabelChange: (id: string, label: string) => void;
  index: number;
  inputRefsRef: React.RefObject<(HTMLInputElement | null)[]>;
}) {
  const setRef = useCallback(
    (el: HTMLInputElement | null) => {
      if (inputRefsRef.current) inputRefsRef.current[index] = el;
    },
    [index, inputRefsRef]
  );

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors ${
        isHighlighted ? "bg-primary/10" : "hover:bg-muted/50"
      }`}
      onClick={() => onFocus(edge.id)}
    >
      <BulkEditEdgeIcon
        strokeColor={edge.data?.strokeColor}
        strokeOpacity={edge.data?.strokeOpacity}
        strokeLightness={edge.data?.strokeLightness}
        strokeWidth={edge.data?.strokeWidth}
        strokeStyle={edge.data?.strokeStyle}
        markerEnd={edge.data?.markerEnd}
        markerStart={edge.data?.markerStart}
      />
      <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
        {edge.source}→{edge.target}
      </span>
      <Input
        ref={setRef}
        className="h-7 text-sm flex-1"
        value={edge.data?.label ?? ""}
        onChange={(e) => onLabelChange(edge.id, e.target.value)}
        onFocus={() => onFocus(edge.id)}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
});

// ---- Flow order computation ----

/** Topological sort via BFS from root nodes (no incoming edges).
 *  Interleaves nodes and their outgoing edges in traversal order. */
function buildFlowOrder(nodes: FlowNode[], edges: FlowEdge[]): BulkEditItem[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const incomingCount = new Map<string, number>();
  const outgoingEdges = new Map<string, FlowEdge[]>();

  for (const n of nodes) {
    incomingCount.set(n.id, 0);
    outgoingEdges.set(n.id, []);
  }
  for (const e of edges) {
    incomingCount.set(e.target, (incomingCount.get(e.target) ?? 0) + 1);
    outgoingEdges.get(e.source)?.push(e);
  }

  // Start from nodes with no incoming edges
  const queue: string[] = [];
  for (const n of nodes) {
    if ((incomingCount.get(n.id) ?? 0) === 0) {
      queue.push(n.id);
    }
  }

  const visited = new Set<string>();
  const visitedEdges = new Set<string>();
  const items: BulkEditItem[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const node = nodeMap.get(id);
    if (node) items.push({ kind: "node", node });

    for (const edge of outgoingEdges.get(id) ?? []) {
      if (visitedEdges.has(edge.id)) continue;
      visitedEdges.add(edge.id);
      items.push({ kind: "edge", edge });

      if (!visited.has(edge.target)) {
        // Decrement and enqueue if all incoming visited
        const remaining = (incomingCount.get(edge.target) ?? 1) - 1;
        incomingCount.set(edge.target, remaining);
        if (remaining <= 0) {
          queue.push(edge.target);
        }
      }
    }
  }

  // Add any remaining unvisited nodes (disconnected or in cycles)
  for (const n of nodes) {
    if (!visited.has(n.id)) {
      items.push({ kind: "node", node: n });
      for (const edge of outgoingEdges.get(n.id) ?? []) {
        if (!visitedEdges.has(edge.id)) {
          visitedEdges.add(edge.id);
          items.push({ kind: "edge", edge });
        }
      }
    }
  }

  // Add any remaining edges not yet included
  for (const e of edges) {
    if (!visitedEdges.has(e.id)) {
      items.push({ kind: "edge", edge: e });
    }
  }

  return items;
}

/** Sort nodes by canvas position: TD → y-primary then x, LR → x-primary then y */
function sortNodesByPosition(nodes: FlowNode[], direction: FlowDirection): FlowNode[] {
  return [...nodes].sort((a, b) => {
    if (direction === "LR") {
      return a.position.x - b.position.x || a.position.y - b.position.y;
    }
    return a.position.y - b.position.y || a.position.x - b.position.x;
  });
}

/** Sort edges by source node position, then target node position */
function sortEdgesByPosition(edges: FlowEdge[], nodes: FlowNode[], direction: FlowDirection): FlowEdge[] {
  const posMap = new Map(nodes.map((n) => [n.id, n.position]));
  const zero = { x: 0, y: 0 };
  return [...edges].sort((a, b) => {
    const srcA = posMap.get(a.source) ?? zero;
    const srcB = posMap.get(b.source) ?? zero;
    const tgtA = posMap.get(a.target) ?? zero;
    const tgtB = posMap.get(b.target) ?? zero;
    if (direction === "LR") {
      return srcA.x - srcB.x || srcA.y - srcB.y || tgtA.x - tgtB.x || tgtA.y - tgtB.y;
    }
    return srcA.y - srcB.y || srcA.x - srcB.x || tgtA.y - tgtB.y || tgtA.x - tgtB.x;
  });
}

// ---- Main component ----

export const BulkEditTable = memo(function BulkEditTable({
  onFocusNode,
  onFocusEdge,
  highlightId,
  selectedIds,
}: BulkEditTableProps) {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const updateNodeLabel = useFlowStore((s) => s.updateNodeLabel);
  const updateEdgeLabel = useFlowStore((s) => s.updateEdgeLabel);
  const updateComponentInstanceName = useFlowStore(
    (s) => s.updateComponentInstanceName
  );
  const direction = useFlowStore((s) => s.direction);
  const { t } = useLocale();

  const [viewMode, setViewMode] = useState<ViewMode>("category");
  const [searchText, setSearchText] = useState("");
  // Unified filter: "" = all, "shape:rectangle" = node shape, "edge:bezier" = edge type
  const [filter, setFilter] = useState("");

  const shapeFilter = filter.startsWith("shape:") ? filter.slice(6) as NodeShape : "";
  const edgeTypeFilter = filter.startsWith("edge:") ? filter.slice(5) as EdgeType : "";

  // Canvas multi-selection override
  const selectedIdsSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const hasSelection = selectedIdsSet.size > 0;

  const editableNodes = useMemo(
    () => nodes.filter((n) => !n.data.componentParentId && !n.data.isLocked),
    [nodes]
  );
  const editableEdges = useMemo(
    () => edges.filter((e) => !e.data?.isBridgeEdge),
    [edges]
  );

  // Apply text search filter
  const searchLower = searchText.toLowerCase();

  const filteredNodes = useMemo(() => {
    // Canvas multi-selection overrides all filters
    if (hasSelection) {
      return editableNodes.filter((n) => selectedIdsSet.has(n.id));
    }
    // Edge type filter active → hide all nodes
    if (edgeTypeFilter) return [];
    let result = editableNodes;
    if (searchText) {
      result = result.filter((n) => {
        const label = n.data.componentInstanceName ?? n.data.label;
        return label.toLowerCase().includes(searchLower);
      });
    }
    if (shapeFilter) {
      result = result.filter((n) => n.data.shape === shapeFilter);
    }
    return result;
  }, [editableNodes, searchLower, searchText, shapeFilter, edgeTypeFilter, hasSelection, selectedIdsSet]);

  const filteredEdges = useMemo(() => {
    // Canvas multi-selection → show edges connected to selected nodes
    if (hasSelection) {
      return editableEdges.filter(
        (e) => selectedIdsSet.has(e.source) || selectedIdsSet.has(e.target)
      );
    }
    // Shape filter active → only edges connected to matching nodes
    if (shapeFilter) {
      const matchingNodeIds = new Set(filteredNodes.map((n) => n.id));
      let result = editableEdges.filter(
        (e) => matchingNodeIds.has(e.source) || matchingNodeIds.has(e.target)
      );
      if (searchText) {
        result = result.filter((e) =>
          (e.data?.label ?? "").toLowerCase().includes(searchLower)
        );
      }
      return result;
    }
    let result = editableEdges;
    if (edgeTypeFilter) {
      result = result.filter(
        (e) => (e.data?.edgeType ?? DEFAULT_EDGE_TYPE) === edgeTypeFilter
      );
    }
    if (searchText) {
      result = result.filter((e) =>
        (e.data?.label ?? "").toLowerCase().includes(searchLower)
      );
    }
    return result;
  }, [editableEdges, shapeFilter, filteredNodes, edgeTypeFilter, searchLower, searchText, hasSelection, selectedIdsSet]);

  // Build items list based on view mode
  const items = useMemo((): BulkEditItem[] => {
    if (viewMode === "flow") {
      return buildFlowOrder(filteredNodes, filteredEdges);
    }
    // Category mode: nodes sorted by canvas position, edges sorted by source position
    const sortedNodes = sortNodesByPosition(filteredNodes, direction);
    const sortedEdges = sortEdgesByPosition(filteredEdges, editableNodes, direction);
    const result: BulkEditItem[] = [];
    result.push({ kind: "section", label: t("nodes") });
    for (const node of sortedNodes) {
      result.push({ kind: "node", node });
    }
    result.push({ kind: "section", label: t("bulkEditEdges") });
    for (const edge of sortedEdges) {
      result.push({ kind: "edge", edge });
    }
    return result;
  }, [viewMode, filteredNodes, filteredEdges, editableNodes, direction, t]);

  // Refs for keyboard navigation
  const inputRefsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Use useRef to avoid stale closure in handleNodeLabelChange
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
        e.preventDefault();
        const next = index + 1;
        if (inputRefsRef.current[next]) {
          inputRefsRef.current[next]?.focus();
        }
      } else if (e.key === "Tab" && e.shiftKey) {
        e.preventDefault();
        const prev = index - 1;
        if (prev >= 0) {
          inputRefsRef.current[prev]?.focus();
        }
      }
    },
    []
  );

  const handleNodeLabelChange = useCallback(
    (id: string, label: string) => {
      const node = nodesRef.current.find((n) => n.id === id);
      if (node?.data.componentDefinitionId) {
        updateComponentInstanceName(id, label);
      } else {
        updateNodeLabel(id, label);
      }
    },
    [updateNodeLabel, updateComponentInstanceName]
  );

  const handleEdgeLabelChange = useCallback(
    (id: string, label: string) => {
      updateEdgeLabel(id, label);
    },
    [updateEdgeLabel]
  );

  // Compute input index (skip section headers)
  let inputIndex = 0;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Toolbar: search + shape filter + view mode */}
      <div className="px-3 pt-3 pb-2 space-y-2 border-b border-border shrink-0">
        {/* Search with clear button */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            className="h-7 text-sm pl-7 pr-7"
            placeholder={t("bulkEditSearch")}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          {searchText && (
            <button
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setSearchText("")}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Unified filter dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 flex-1 min-w-0 justify-between"
              >
                <span className="flex items-center gap-1.5 truncate">
                  {shapeFilter ? (
                    <>
                      <BulkEditNodeIcon shape={shapeFilter} />
                      {t(SHAPE_FILTER_OPTIONS.find((o) => o.value === shapeFilter)?.key ?? "rectangle")}
                    </>
                  ) : edgeTypeFilter ? (
                    <>
                      <BulkEditEdgeIcon />
                      {t(EDGE_FILTER_OPTIONS.find((o) => o.value === edgeTypeFilter)?.key ?? "bezier")}
                    </>
                  ) : (
                    t("all")
                  )}
                </span>
                <ChevronDown size={12} className="shrink-0 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
              <DropdownMenuItem onClick={() => setFilter("")}>
                {t("all")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px]">{t("nodes")}</DropdownMenuLabel>
              {SHAPE_FILTER_OPTIONS.map(({ value, key }) => (
                <DropdownMenuItem
                  key={value}
                  onClick={() => setFilter(`shape:${value}`)}
                  className="gap-2"
                >
                  <BulkEditNodeIcon shape={value} />
                  <span>{t(key)}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px]">{t("bulkEditEdges")}</DropdownMenuLabel>
              {EDGE_FILTER_OPTIONS.map(({ value, key }) => (
                <DropdownMenuItem
                  key={value}
                  onClick={() => setFilter(`edge:${value}`)}
                  className="gap-2"
                >
                  <BulkEditEdgeIcon />
                  <span>{t(key)}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View mode toggle */}
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(val) => {
              if (val) setViewMode(val as ViewMode);
            }}
            className="h-7 shrink-0"
          >
            <ToggleGroupItem value="category" className="h-7 px-2 text-[10px]">
              {t("bulkEditViewCategory")}
            </ToggleGroupItem>
            <ToggleGroupItem value="flow" className="h-7 px-2 text-[10px]">
              {t("bulkEditViewFlow")}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Items list */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1">
          {items.map((item) => {
            if (item.kind === "section") {
              return (
                <div
                  key={`section-${item.label}`}
                  className="text-xs font-semibold uppercase text-muted-foreground px-2 py-1 mt-1 first:mt-0"
                >
                  {item.label}
                </div>
              );
            }

            if (item.kind === "node") {
              const idx = inputIndex++;
              return (
                <div key={item.node.id} onKeyDown={(e) => handleKeyDown(e, idx)}>
                  <NodeRow
                    node={item.node}
                    isHighlighted={highlightId === item.node.id}
                    onFocus={onFocusNode}
                    onLabelChange={handleNodeLabelChange}
                    index={idx}
                    inputRefsRef={inputRefsRef}
                  />
                </div>
              );
            }

            // edge
            const idx = inputIndex++;
            return (
              <div key={item.edge.id} onKeyDown={(e) => handleKeyDown(e, idx)}>
                <EdgeRow
                  edge={item.edge}
                  isHighlighted={highlightId === item.edge.id}
                  onFocus={onFocusEdge}
                  onLabelChange={handleEdgeLabelChange}
                  index={idx}
                  inputRefsRef={inputRefsRef}
                />
              </div>
            );
          })}

          {items.filter((i) => i.kind !== "section").length === 0 && (
            <div className="text-xs text-muted-foreground px-2 py-2">—</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
});
