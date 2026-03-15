"use client";

import { useState, useCallback, useEffect } from "react";
import { PANEL_STATE_KEY } from "@/lib/constants";

interface PanelState {
  leftOpen: boolean;
  rightOpen: boolean;
  leftWidth: number;
  rightWidth: number;
}

const defaults: PanelState = {
  leftOpen: true,
  rightOpen: true,
  leftWidth: 180,
  rightWidth: 320,
};

export function usePanelState() {
  const [state, setState] = useState<PanelState>(defaults);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PANEL_STATE_KEY);
      if (stored) {
        setState({ ...defaults, ...JSON.parse(stored) });
      }
    } catch {
      // ignore
    }
  }, []);

  const persist = useCallback((next: PanelState) => {
    setState(next);
    try {
      localStorage.setItem(PANEL_STATE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const toggleLeft = useCallback(() => {
    persist({ ...state, leftOpen: !state.leftOpen });
  }, [state, persist]);

  const toggleRight = useCallback(() => {
    persist({ ...state, rightOpen: !state.rightOpen });
  }, [state, persist]);

  return { ...state, toggleLeft, toggleRight };
}
