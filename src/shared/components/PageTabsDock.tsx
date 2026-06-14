"use client";

import { useState } from "react";
import { FileText, Plus, X, PanelBottom, PanelLeft } from "lucide-react";
import { useLocale } from "@/lib/i18n/useLocale";

/** 縦タブドックの幅（ホバー時/リネーム中: ラベル表示）。通常時はクラス側の w-[54px] */
const PAGE_DOCK_WIDTH_EXPANDED = 120;

export type PageTabsPosition = "left" | "bottom";

export interface PageTabItem {
  id: string;
  name: string;
}

interface PageTabsDockProps {
  pages: PageTabItem[];
  activePageId: string;
  /** タブドックの表示位置（left: 縦タブ / bottom: スプレッドシート風の横タブ） */
  position: PageTabsPosition;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onTogglePosition: () => void;
}

/** ページタブドック（Flowmaid / Nodemaid 共用のプレゼンテーショナルコンポーネント） */
export function PageTabsDock({
  pages,
  activePageId,
  position,
  onSelect,
  onAdd,
  onRemove,
  onRename,
  onTogglePosition,
}: PageTabsDockProps) {
  const { t } = useLocale();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const commitRename = () => {
    if (editingId) onRename(editingId, editingName);
    setEditingId(null);
  };

  const renderRenameInput = () => (
    <input
      autoFocus
      value={editingName}
      onChange={(e) => setEditingName(e.target.value)}
      onBlur={commitRename}
      onKeyDown={(e) => {
        if (e.key === "Enter") commitRename();
        if (e.key === "Escape") setEditingId(null);
      }}
      onClick={(e) => e.stopPropagation()}
      className="flex-1 min-w-0 bg-transparent outline-none border-b border-current text-xs"
    />
  );

  if (position === "bottom") {
    // 横タブ（Googleスプレッドシートのシートタブ風）: ラベル常時表示
    return (
      <div className="shrink-0 flex items-center gap-1 px-2 pb-1 bg-zinc-900 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* 表示位置切り替え（左端） */}
        <button
          className="shrink-0 p-2 rounded-b-lg text-zinc-500 hover:text-zinc-100 hover:bg-white/10 transition-colors"
          onClick={onTogglePosition}
          title={t("neTabsToLeft")}
        >
          <PanelLeft size={14} />
        </button>

        {pages.map((page) => {
          const isActive = page.id === activePageId;
          return (
            <div
              key={page.id}
              className={`group/tab shrink-0 flex items-center gap-1 pl-3 pr-1 py-2 rounded-b-lg cursor-pointer text-xs font-medium transition-colors max-w-[200px] ${
                isActive
                  ? "bg-background text-foreground"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-white/10"
              }`}
              onClick={() => onSelect(page.id)}
              onDoubleClick={() => {
                setEditingId(page.id);
                setEditingName(page.name);
              }}
              title={page.name}
            >
              <FileText size={14} className="shrink-0" />
              {editingId === page.id ? (
                renderRenameInput()
              ) : (
                <span className="truncate">{page.name}</span>
              )}
              {pages.length > 1 && editingId !== page.id && (
                <button
                  className={`shrink-0 p-1 rounded-md opacity-0 group-hover/tab:opacity-100 transition-opacity ${
                    isActive ? "hover:bg-muted" : "hover:bg-white/20"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(t("nePageDeleteConfirm"))) onRemove(page.id);
                  }}
                  title={t("nePageDelete")}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}

        {/* ページ追加 */}
        <button
          className="shrink-0 p-2 rounded-b-lg text-zinc-500 hover:text-zinc-100 hover:bg-white/10 transition-colors"
          onClick={onAdd}
          title={t("nePageAdd")}
        >
          <Plus size={14} />
        </button>
      </div>
    );
  }

  return (
    // 暗色ドック（通常時はアイコンのみ、ホバーでラベル展開）
    <div
      className="group/dock shrink-0 flex flex-col gap-1 py-3 pl-2 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-zinc-900 w-[54px] hover:w-[120px] transition-[width] duration-200 ease-out"
      style={editingId ? { width: PAGE_DOCK_WIDTH_EXPANDED } : undefined}
    >
      {pages.map((page) => {
        const isActive = page.id === activePageId;
        return (
          <div
            key={page.id}
            className={`group/tab flex items-center gap-1 pl-3 pr-1 py-2 rounded-l-lg cursor-pointer text-xs font-medium transition-colors ${
              isActive
                ? "bg-background text-foreground"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-white/10"
            }`}
            onClick={() => onSelect(page.id)}
            onDoubleClick={() => {
              setEditingId(page.id);
              setEditingName(page.name);
            }}
            title={page.name}
          >
            <FileText size={14} className="shrink-0" />
            {editingId === page.id ? (
              renderRenameInput()
            ) : (
              <span className="flex-1 truncate opacity-0 transition-opacity duration-200 group-hover/dock:opacity-100">
                {page.name}
              </span>
            )}
            {pages.length > 1 && editingId !== page.id && (
              <button
                className={`shrink-0 p-1 rounded-md opacity-0 group-hover/tab:opacity-100 transition-opacity ${
                  isActive ? "hover:bg-muted" : "hover:bg-white/20"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(t("nePageDeleteConfirm"))) onRemove(page.id);
                }}
                title={t("nePageDelete")}
              >
                <X size={12} />
              </button>
            )}
          </div>
        );
      })}

      {/* ページ追加 */}
      <button
        className="flex items-center gap-1.5 pl-3 py-2 rounded-l-lg text-xs text-zinc-500 hover:text-zinc-100 hover:bg-white/10 transition-colors whitespace-nowrap"
        onClick={onAdd}
        title={t("nePageAdd")}
      >
        <Plus size={14} className="shrink-0" />
        <span className="truncate opacity-0 transition-opacity duration-200 group-hover/dock:opacity-100">
          {t("nePageAdd")}
        </span>
      </button>

      {/* 表示位置切り替え（左下） */}
      <button
        className="mt-auto flex items-center gap-1.5 pl-3 py-2 rounded-l-lg text-xs text-zinc-500 hover:text-zinc-100 hover:bg-white/10 transition-colors whitespace-nowrap"
        onClick={onTogglePosition}
        title={t("neTabsToBottom")}
      >
        <PanelBottom size={14} className="shrink-0" />
        <span className="truncate opacity-0 transition-opacity duration-200 group-hover/dock:opacity-100">
          {t("neTabsToBottom")}
        </span>
      </button>
    </div>
  );
}
