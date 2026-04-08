import { useState, useEffect } from "react";

/**
 * Track whether the Shift key is currently pressed.
 * Shared across components via a module-level listener (only one pair of
 * keydown/keyup listeners is registered regardless of how many components
 * call this hook).
 */

let pressed = false;
const listeners = new Set<(v: boolean) => void>();

function onKey(e: KeyboardEvent) {
  const next = e.shiftKey;
  if (next !== pressed) {
    pressed = next;
    for (const fn of listeners) fn(next);
  }
}

function subscribe(fn: (v: boolean) => void) {
  listeners.add(fn);
  if (listeners.size === 1) {
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
  }
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    }
  };
}

export function useShiftKey(): boolean {
  const [shift, setShift] = useState(pressed);
  useEffect(() => subscribe(setShift), []);
  return shift;
}

/** Read shift state imperatively (e.g., from non-hook contexts). */
export function isShiftPressed(): boolean {
  return pressed;
}
