"use client";

import { useFlowStore } from "@/store/useFlowStore";
import { PageTabsDock, type PageTabsPosition } from "@/shared/components/PageTabsDock";

interface FlowPageTabsProps {
  position: PageTabsPosition;
  onTogglePosition: () => void;
}

export function FlowPageTabs({ position, onTogglePosition }: FlowPageTabsProps) {
  const pages = useFlowStore((s) => s.pages);
  const activePageId = useFlowStore((s) => s.activePageId);
  const setActivePage = useFlowStore((s) => s.setActivePage);
  const addPage = useFlowStore((s) => s.addPage);
  const removePage = useFlowStore((s) => s.removePage);
  const renamePage = useFlowStore((s) => s.renamePage);

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
