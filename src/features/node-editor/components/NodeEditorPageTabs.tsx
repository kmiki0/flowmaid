"use client";

import { useNodeEditorStore } from "../store/useNodeEditorStore";
import { PageTabsDock, type PageTabsPosition } from "@/shared/components/PageTabsDock";

export type { PageTabsPosition };

interface NodeEditorPageTabsProps {
  position: PageTabsPosition;
  onTogglePosition: () => void;
}

export function NodeEditorPageTabs({ position, onTogglePosition }: NodeEditorPageTabsProps) {
  const pages = useNodeEditorStore((s) => s.pages);
  const activePageId = useNodeEditorStore((s) => s.activePageId);
  const setActivePage = useNodeEditorStore((s) => s.setActivePage);
  const addPage = useNodeEditorStore((s) => s.addPage);
  const removePage = useNodeEditorStore((s) => s.removePage);
  const renamePage = useNodeEditorStore((s) => s.renamePage);

  return (
    <PageTabsDock
      pages={pages}
      activePageId={activePageId}
      position={position}
      onSelect={setActivePage}
      onAdd={addPage}
      onRemove={removePage}
      onRename={renamePage}
      onTogglePosition={onTogglePosition}
    />
  );
}
