"use client";

import type { EditorMode } from "@/features/node-editor/types";

interface ModeTitleProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
}

const TOGGLE_WIDTH = 130;
const TOGGLE_HEIGHT = 30;
const KNOB_SIZE = 22;
const KNOB_PADDING = 4;
const KNOB_TRAVEL = TOGGLE_WIDTH - KNOB_SIZE - KNOB_PADDING * 2;

export function ModeTitle({ mode, onModeChange }: ModeTitleProps) {
  const isNodeEditor = mode === "node-editor";

  return (
    <button
      onClick={() => onModeChange(isNodeEditor ? "flowchart" : "node-editor")}
      className="relative inline-block mr-2 select-none cursor-pointer"
      style={{ width: TOGGLE_WIDTH, height: TOGGLE_HEIGHT }}
      title={isNodeEditor ? "Switch to Flowmaid" : "Switch to Nodemaid"}
    >
      {/* Track */}
      <div
        className="absolute inset-0 rounded-full transition-colors duration-400 ease-in-out border border-border"
        style={{
          backgroundColor: isNodeEditor ? "var(--color-primary)" : "hsl(var(--muted))",
        }}
      />

      {/* Knob */}
      <div
        className={`absolute rounded-full shadow-md transition-all duration-400 ease-in-out flex items-center justify-center ${isNodeEditor ? "bg-black" : "bg-white"}`}
        style={{
          width: KNOB_SIZE,
          height: KNOB_SIZE,
          top: KNOB_PADDING,
          left: KNOB_PADDING,
          transform: isNodeEditor ? `translateX(${KNOB_TRAVEL}px)` : "translateX(0)",
        }}
      >
        {/* Arrow indicating direction */}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          className="transition-transform duration-400 ease-in-out"
          style={{ transform: isNodeEditor ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <path
            d="M3.5 2L6.5 5L3.5 8"
            fill="none"
            stroke={isNodeEditor ? "white" : "var(--color-muted-foreground)"}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Label */}
      <span
        className="absolute inset-0 flex items-center justify-center text-xs font-semibold pointer-events-none transition-colors duration-400"
        style={{
          fontFamily: "var(--font-sans, sans-serif)",
          color: isNodeEditor ? "var(--color-primary-foreground)" : "var(--color-muted-foreground)",
        }}
      >
        {isNodeEditor ? "Nodemaid" : "Flowmaid"}
      </span>
    </button>
  );
}
