"use client";

import { useState } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
import { useFlowStore } from "@/store/useFlowStore";
import { useLocale } from "@/lib/i18n/useLocale";
import { useDnD } from "@/hooks/useDnD";
import { Input } from "@/components/ui/input";

export function ComponentManagerPanel() {
  const { t } = useLocale();
  const definitions = useFlowStore((s) => s.componentDefinitions);
  const nodes = useFlowStore((s) => s.nodes);
  const deleteComponentDefinition = useFlowStore((s) => s.deleteComponentDefinition);
  const createAndEditComponent = useFlowStore((s) => s.createAndEditComponent);
  const enterComponentEditMode = useFlowStore((s) => s.enterComponentEditMode);
  const renameComponentDefinition = useFlowStore((s) => s.renameComponentDefinition);
  const { onDragStartComponent, onDragEnd, placeComponentToCenter } = useDnD();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const handleDelete = (id: string) => {
    const inUse = nodes.some((n) => n.data.componentDefinitionId === id);
    if (inUse) {
      window.alert(t("componentInUseWarning"));
      return;
    }
    if (!window.confirm(t("deleteComponentConfirm"))) return;
    deleteComponentDefinition(id);
  };

  const startRename = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      renameComponentDefinition(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  return (
    <div>
      <div className="space-y-2">
        {definitions.map((def) => (
          <div
            key={def.id}
            className="p-2 rounded border-2 border-primary/30 bg-primary/5 cursor-grab active:cursor-grabbing"
            draggable
            onDragStart={(e) => onDragStartComponent(e, def.id)}
            onDragEnd={onDragEnd}
            onDoubleClick={() => placeComponentToCenter(def.id)}
          >
            <div className="flex items-center gap-1 mb-1">
              {renamingId === def.id ? (
                <Input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  className="h-6 text-sm flex-1"
                  autoFocus
                />
              ) : (
                <span
                  className="text-sm font-medium truncate flex-1 cursor-text rounded px-1 hover:bg-muted border border-transparent hover:border-border"
                  onDoubleClick={(e) => { e.stopPropagation(); startRename(def.id, def.name); }}
                  title={def.name}
                >
                  {def.name}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground">v{def.version}</span>
            </div>
            <div className="flex gap-1 items-center pl-1" onDoubleClick={(e) => e.stopPropagation()}>
              <span className="text-[10px] text-muted-foreground border border-muted-foreground/40 rounded px-1 py-0.5 leading-none">{def.direction === "LR" ? "LR" : "TD"}</span>
              <button
                className="p-1 rounded hover:bg-primary/15 text-primary ml-auto"
                onClick={() => enterComponentEditMode(def.id)}
                title={t("editComponent")}
              >
                <Pencil size={14} />
              </button>
              <button
                className="p-1 rounded hover:bg-destructive/15 text-destructive"
                onClick={() => handleDelete(def.id)}
                title={t("deleteComponent")}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {/* New component card (dashed) */}
        <button
          className="w-full p-4 rounded border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5 flex flex-col items-center gap-1 transition-colors cursor-pointer"
          onClick={() => createAndEditComponent()}
        >
          <Plus size={24} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{t("createComponent")}</span>
        </button>
      </div>
    </div>
  );
}
