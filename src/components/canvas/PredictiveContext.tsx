"use client";

import { createContext, useContext } from "react";
import type { PredictiveDirection } from "@/store/types";

export interface PredictiveContextValue {
  onArrowEnter: (nodeId: string, direction: PredictiveDirection) => void;
  onArrowLeave: () => void;
}

const PredictiveContext = createContext<PredictiveContextValue | null>(null);

export const PredictiveProvider = PredictiveContext.Provider;

export function usePredictiveContext(): PredictiveContextValue | null {
  return useContext(PredictiveContext);
}
