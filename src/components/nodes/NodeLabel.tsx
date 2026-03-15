"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useFlowStore } from "@/store/useFlowStore";
import type { TextAlign } from "@/types/flow";

interface NodeLabelProps {
  id: string;
  label: string;
  fontSize?: number;
  textColor?: string;
  textAlign?: TextAlign;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  isLocked?: boolean;
}

export function NodeLabel({
  id,
  label,
  fontSize,
  textColor,
  textAlign,
  bold,
  italic,
  underline,
  isLocked,
}: NodeLabelProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const updateNodeLabel = useFlowStore((s) => s.updateNodeLabel);

  useEffect(() => {
    setValue(label);
  }, [label]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
      autoResize(textareaRef.current);
    }
  }, [editing]);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  const commit = useCallback(() => {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed && trimmed !== label) {
      updateNodeLabel(id, trimmed);
    } else {
      setValue(label);
    }
  }, [value, label, id, updateNodeLabel]);

  const textStyle: React.CSSProperties = {
    fontSize: fontSize ? `${fontSize}px` : undefined,
    color: textColor || undefined,
    textAlign: textAlign || "center",
    fontWeight: bold ? "bold" : undefined,
    fontStyle: italic ? "italic" : undefined,
    textDecoration: underline ? "underline" : undefined,
  };

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        className="nodrag nowheel bg-transparent text-sm outline-none border-b border-foreground/30 w-full resize-none overflow-hidden"
        style={textStyle}
        value={value}
        rows={1}
        onChange={(e) => {
          setValue(e.target.value);
          autoResize(e.target);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            commit();
          }
          if (e.key === "Escape") {
            setValue(label);
            setEditing(false);
          }
        }}
      />
    );
  }

  const hasNewlines = label.includes("\n");

  return (
    <span
      className="node-label-text select-none max-w-full w-full"
      style={textStyle}
      onDoubleClick={() => !isLocked && setEditing(true)}
    >
      {hasNewlines
        ? label.split("\n").map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {line}
            </span>
          ))
        : label}
    </span>
  );
}
