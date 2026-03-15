"use client";

import { createContext, useContext, useState } from "react";

export interface DnDPayload {
  kind: "shape" | "component";
  value: string; // shape type or component definition ID
}

type DnDContextType = [DnDPayload | null, (payload: DnDPayload | null) => void];

const DnDContext = createContext<DnDContextType>([null, () => {}]);

export function DnDProvider({ children }: { children: React.ReactNode }) {
  const [type, setType] = useState<DnDPayload | null>(null);
  return (
    <DnDContext.Provider value={[type, setType]}>
      {children}
    </DnDContext.Provider>
  );
}

export function useDnDContext() {
  return useContext(DnDContext);
}
