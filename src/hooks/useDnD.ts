"use client";

import { useCallback } from "react";
import { useDnDContext } from "@/components/canvas/DnDContext";
import { useFlowStore } from "@/store/useFlowStore";

export function useDnD() {
  const [, setPayload] = useDnDContext();
  const placeComponentInstance = useFlowStore((s) => s.placeComponentInstance);

  const onDragStart = useCallback(
    (event: React.DragEvent, shape: string) => {
      setPayload({ kind: "shape", value: shape });
      event.dataTransfer.effectAllowed = "move";
    },
    [setPayload]
  );

  const onDragStartComponent = useCallback(
    (event: React.DragEvent, definitionId: string) => {
      setPayload({ kind: "component", value: definitionId });
      event.dataTransfer.effectAllowed = "move";
    },
    [setPayload]
  );

  const onDragEnd = useCallback(() => {
    setPayload(null);
  }, [setPayload]);

  const placeComponentToCenter = useCallback(
    (definitionId: string) => {
      placeComponentInstance(definitionId);
    },
    [placeComponentInstance]
  );

  return { onDragStart, onDragStartComponent, onDragEnd, placeComponentToCenter };
}
