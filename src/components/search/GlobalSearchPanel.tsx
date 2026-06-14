"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGlobalSearch, type SearchResult } from "@/hooks/useGlobalSearch";
import { useLocale } from "@/lib/i18n/useLocale";

interface GlobalSearchPanelProps {
  onClose: () => void;
  onJump: (type: "node" | "edge", id: string) => void;
}

/** マッチ箇所をハイライトした React ノードを返す */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const terms = query.trim().toLowerCase().split(/\s+/);
  // 最初のマッチを1つだけハイライト
  const lower = text.toLowerCase();
  let bestStart = -1;
  let bestEnd = -1;
  for (const term of terms) {
    const idx = lower.indexOf(term);
    if (idx !== -1 && (bestStart === -1 || idx < bestStart)) {
      bestStart = idx;
      bestEnd = idx + term.length;
    }
  }
  if (bestStart === -1) return text;
  return (
    <>
      {text.slice(0, bestStart)}
      <mark className="bg-yellow-300/60 dark:bg-yellow-500/40 rounded-sm px-0.5">
        {text.slice(bestStart, bestEnd)}
      </mark>
      {text.slice(bestEnd)}
    </>
  );
}

export function GlobalSearchPanel({ onClose, onJump }: GlobalSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { t } = useLocale();

  const { results, total } = useGlobalSearch(query);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reset activeIndex when query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const jump = useCallback(
    (result: SearchResult) => {
      onJump(result.kind, result.id);
    },
    [onJump]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
        return;
      }
      if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Enter" && results.length > 0) {
        e.preventDefault();
        jump(results[activeIndex]);
        return;
      }
    },
    [onClose, results, activeIndex, jump]
  );

  const navigatePrev = useCallback(() => {
    if (results.length === 0) return;
    const next = (activeIndex - 1 + results.length) % results.length;
    setActiveIndex(next);
    jump(results[next]);
  }, [results, activeIndex, jump]);

  const navigateNext = useCallback(() => {
    if (results.length === 0) return;
    const next = (activeIndex + 1) % results.length;
    setActiveIndex(next);
    jump(results[next]);
  }, [results, activeIndex, jump]);

  return (
    <div
      className="glass-panel w-[min(480px,85vw)] flex flex-col overflow-hidden"
      onKeyDown={handleKeyDown}
    >
      {/* Search input */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Search size={14} className="shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("globalSearchPlaceholder")}
          className="flex-1 min-w-0 bg-transparent outline-none text-sm"
        />
        <button
          onClick={onClose}
          className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      {/* Results list */}
      {query.trim() && (
        <>
          <ScrollArea className="max-h-[320px]">
            <div ref={listRef} className="py-1">
              {results.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                  {t("globalSearchNoResults")}
                </div>
              ) : (
                results.map((result, i) => (
                  <button
                    key={`${result.kind}-${result.id}`}
                    data-index={i}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors cursor-pointer ${
                      i === activeIndex
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => {
                      setActiveIndex(i);
                      jump(result);
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                  >
                    {/* Type badge */}
                    <span
                      className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        result.kind === "node"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                          : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                      }`}
                    >
                      {result.isComponent
                        ? t("globalSearchTagComp")
                        : result.kind === "node"
                          ? t("globalSearchTagNode")
                          : t("globalSearchTagEdge")}
                    </span>
                    {/* Label */}
                    <span className="flex-1 min-w-0 truncate">
                      {highlightMatch(result.displayLabel, query)}
                    </span>
                    {/* Sub label (edge route) */}
                    {result.subLabel && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {result.subLabel}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Footer: result count + nav */}
          {results.length > 0 && (
            <div className="flex items-center justify-between px-3 py-1.5 border-t border-border text-xs text-muted-foreground">
              <span>
                {t("globalSearchResultCount")
                  .replace("{current}", String(activeIndex + 1))
                  .replace("{total}", String(total))}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={navigatePrev}
                  className="p-0.5 rounded hover:bg-muted transition-colors cursor-pointer"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  onClick={navigateNext}
                  className="p-0.5 rounded hover:bg-muted transition-colors cursor-pointer"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
