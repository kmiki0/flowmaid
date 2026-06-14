"use client";

import { ArrowUpDown } from "lucide-react";
import type { EditorMode } from "@/features/node-editor/types";

interface ModeTitleProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
}

/** ツールバー側のスペーサー（w-[130px]）と幅を合わせること */
const TITLE_WIDTH = 130;
const TITLE_HEIGHT = 30;
/** ワードマーク1行ぶんの高さ（縦スライドの移動量） */
const LINE_HEIGHT = 20;
/** スライドするプレフィックス（Flow/Node）の固定幅。右揃えで「maid」に密着させる */
const PREFIX_WIDTH = 40;

export function ModeTitle({ mode, onModeChange }: ModeTitleProps) {
  const isNodeEditor = mode === "node-editor";

  return (
    <button
      onClick={() => onModeChange(isNodeEditor ? "flowchart" : "node-editor")}
      className="group flex items-center justify-between select-none cursor-pointer"
      style={{ width: TITLE_WIDTH, height: TITLE_HEIGHT }}
      title={isNodeEditor ? "Switch to Flowmaid" : "Switch to Nodemaid"}
    >
      {/* ワードマーク: プレフィックス（Flow/Node）だけ縦スライドし、「maid」は固定 */}
      <span
        className="flex items-center text-sm font-bold tracking-wide"
        style={{ lineHeight: `${LINE_HEIGHT}px` }}
      >
        <span className="overflow-hidden" style={{ height: LINE_HEIGHT, width: PREFIX_WIDTH }}>
          <span
            className="block transition-transform duration-300 ease-in-out"
            style={{
              transform: isNodeEditor ? `translateY(-${LINE_HEIGHT}px)` : "translateY(0)",
            }}
          >
            <span className="block text-right" style={{ lineHeight: `${LINE_HEIGHT}px` }}>Flow</span>
            <span className="block text-right" style={{ lineHeight: `${LINE_HEIGHT}px` }}>Node</span>
          </span>
        </span>
        <span className="text-primary">maid</span>
      </span>

      {/* 切替アイコン（縦スライドに合わせて上下矢印） */}
      <ArrowUpDown
        size={14}
        className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
      />
    </button>
  );
}
