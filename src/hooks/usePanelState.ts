"use client";

import { useState, useCallback, useEffect } from "react";
import { PANEL_STATE_KEY } from "@/lib/constants";

interface PanelState {
  rightOpen: boolean;
}

const defaults: PanelState = {
  rightOpen: true,
};

/** コードプレビュー（Output）パネルの開閉状態をlocalStorageに永続化する */
export function usePanelState() {
  const [state, setState] = useState<PanelState>(defaults);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PANEL_STATE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<PanelState>;
        setState({ rightOpen: parsed.rightOpen ?? defaults.rightOpen });
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleRight = useCallback(() => {
    setState((prev) => {
      const next = { rightOpen: !prev.rightOpen };
      try {
        localStorage.setItem(PANEL_STATE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { ...state, toggleRight };
}
