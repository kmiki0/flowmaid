"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useUpdateNodeInternals } from "@xyflow/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, GripVertical, Upload, Download } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useNodeEditorStore } from "../store/useNodeEditorStore";
import { useLocale } from "@/lib/i18n/useLocale";
import type { NodeEditorPort } from "../types";

const CSV_HEADER = "logical_name,physical_name,type,PK,FK,NN,UQ";
const CSV_TEMPLATE = `${CSV_HEADER}\nユーザーID,user_id,INT,1,0,1,0\n名前,name,VARCHAR,0,0,1,0\nメール,email,VARCHAR,0,0,0,1\n`;

function parseCsvToPorts(csv: string): EditablePort[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  // Skip header row
  return lines.slice(1)
    .filter((line) => line.trim())
    .map((line) => {
      const cols = line.split(",").map((c) => c.trim());
      const [logicalName, name, dataType, pk, fk, nn, uq] = cols;
      return {
        id: `p${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: name || logicalName || "",
        logicalName: logicalName || undefined,
        direction: "bidirectional" as const,
        dataType: dataType || undefined,
        isPrimaryKey: pk === "1",
        isForeignKey: fk === "1",
        isNotNull: nn === "1",
        isUnique: uq === "1",
        _key: nextPortKey(),
      };
    })
    .filter((p) => p.name);
}

interface TableEditDialogProps {
  nodeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EditablePort extends NodeEditorPort {
  _key: string; // stable key for React rendering
}

let portKeyCounter = 0;
function nextPortKey() {
  return `pk_${++portKeyCounter}`;
}

export function TableEditDialog({ nodeId, open, onOpenChange }: TableEditDialogProps) {
  const { t } = useLocale();
  const node = useNodeEditorStore((s) => s.nodes.find((n) => n.id === nodeId));
  const updateNodeLabel = useNodeEditorStore((s) => s.updateNodeLabel);
  const updateNodeStyle = useNodeEditorStore((s) => s.updateNodeStyle);
  const updateNodeInternals = useUpdateNodeInternals();
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Local editable state
  const [physicalName, setPhysicalName] = useState("");
  const [logicalName, setLogicalName] = useState("");
  const [ports, setPorts] = useState<EditablePort[]>([]);
  const [csvTextOpen, setCsvTextOpen] = useState(false);
  const [csvText, setCsvText] = useState("");

  // Sync from store when dialog opens
  useEffect(() => {
    if (open && node) {
      setPhysicalName(node.data.label);
      setLogicalName(node.data.logicalName ?? "");
      setPorts(
        node.data.ports.map((p) => ({ ...p, _key: nextPortKey() }))
      );
    }
  }, [open, node]);

  const handleDownloadTemplate = useCallback(() => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "columns_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleCsvImportFile = useCallback(() => {
    csvInputRef.current?.click();
  }, []);

  const handleCsvImportText = useCallback(() => {
    setCsvTextOpen((prev) => !prev);
    setCsvText("");
  }, []);

  const handleCsvTextApply = useCallback(() => {
    const imported = parseCsvToPorts(csvText);
    if (imported.length > 0) {
      setPorts(imported);
    }
    setCsvTextOpen(false);
    setCsvText("");
  }, [csvText]);

  const handleCsvFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        const imported = parseCsvToPorts(content);
        if (imported.length > 0) {
          setPorts(imported);
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    []
  );

  const handleAddPort = useCallback(() => {
    setPorts((prev) => [
      ...prev,
      {
        id: `p${Date.now()}`,
        name: "",
        direction: "bidirectional",
        dataType: "",
        _key: nextPortKey(),
      },
    ]);
  }, []);

  const handleRemovePort = useCallback((key: string) => {
    setPorts((prev) => prev.filter((p) => p._key !== key));
  }, []);

  const handlePortChange = useCallback(
    (key: string, field: keyof NodeEditorPort, value: unknown) => {
      setPorts((prev) =>
        prev.map((p) => (p._key === key ? { ...p, [field]: value } : p))
      );
    },
    []
  );

  // D&D reorder state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    setPorts((prev) => {
      const next = [...prev];
      const [removed] = next.splice(dragIndex, 1);
      next.splice(index, 0, removed);
      return next;
    });
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleSave = useCallback(() => {
    if (!node) return;

    // Update label and logicalName
    if (physicalName.trim() && physicalName !== node.data.label) {
      updateNodeLabel(nodeId, physicalName.trim());
    }
    updateNodeStyle(nodeId, { logicalName: logicalName.trim() || undefined });

    // Replace all ports via store
    const cleanPorts: NodeEditorPort[] = ports
      .filter((p) => p.name.trim())
      .map(({ _key, ...rest }) => ({
        ...rest,
        name: rest.name.trim(),
        dataType: rest.dataType?.trim() || undefined,
      }));

    // Use setState directly to replace ports atomically
    useNodeEditorStore.setState((s) => ({
      nodes: s.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        return { ...n, data: { ...n.data, ports: cleanPorts } };
      }),
      // Remove edges connected to deleted ports
      edges: s.edges.filter((e) => {
        const deletedPortIds = new Set(
          node.data.ports
            .filter((op) => !cleanPorts.some((np) => np.id === op.id))
            .map((op) => op.id)
        );
        if (e.source === nodeId && e.data?.sourcePortId && deletedPortIds.has(e.data.sourcePortId)) return false;
        if (e.target === nodeId && e.data?.targetPortId && deletedPortIds.has(e.data.targetPortId)) return false;
        return true;
      }),
    }));

    // Force React Flow to recalculate handle positions after port reorder
    requestAnimationFrame(() => {
      updateNodeInternals(nodeId);
    });

    onOpenChange(false);
  }, [nodeId, node, physicalName, logicalName, ports, updateNodeLabel, updateNodeStyle, onOpenChange]);

  if (!node) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[900px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("neTableEdit")}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 py-2">
          {/* Table names */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("neLogicalNameLabel")}</Label>
              <Input
                value={logicalName}
                onChange={(e) => setLogicalName(e.target.value)}
                placeholder="ユーザー"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("nePhysicalName")}</Label>
              <Input
                value={physicalName}
                onChange={(e) => setPhysicalName(e.target.value)}
                placeholder="users"
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Columns header */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">{t("neColumns")}</Label>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={handleDownloadTemplate}>
                  <Download size={12} /> {t("neCsvTemplate")}
                </Button>
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={handleCsvImportFile}>
                  <Upload size={12} /> {t("neCsvImport")}
                </Button>
                <Button variant={csvTextOpen ? "secondary" : "outline"} size="sm" className="h-7 gap-1 text-xs" onClick={handleCsvImportText}>
                  {t("neCsvPaste")}
                </Button>
                <Separator orientation="vertical" className="h-5 mx-1" />
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={handleAddPort}>
                  <Plus size={12} /> {t("neAddColumn")}
                </Button>
              </div>
            </div>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvFileChange}
            />

            {/* CSV text input (collapsible) */}
            {csvTextOpen && (
              <div className="space-y-1.5">
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={CSV_TEMPLATE}
                  className="w-full h-24 text-xs font-mono bg-muted/50 border border-border rounded-md p-2 resize-y outline-none focus:border-primary"
                />
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setCsvTextOpen(false); setCsvText(""); }}>
                    {t("betaClose")}
                  </Button>
                  <Button size="sm" className="h-7 text-xs" onClick={handleCsvTextApply}>
                    {t("neCsvApply")}
                  </Button>
                </div>
              </div>
            )}

            {/* Column table header */}
            <div className="grid grid-cols-[24px_minmax(150px,1fr)_minmax(150px,1fr)_150px_24px_24px_24px_24px_28px] gap-1 px-1 text-[10px] text-muted-foreground font-semibold">
              <span />
              <span>{t("neColLogical")}</span>
              <span>{t("neColPhysical")}</span>
              <span>{t("neColType")}</span>
              <span className="text-center">PK</span>
              <span className="text-center">FK</span>
              <span className="text-center">NN</span>
              <span className="text-center">UQ</span>
              <span />
            </div>

            {/* Column rows */}
            {ports.map((port, index) => (
              <div
                key={port._key}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
                className={`grid grid-cols-[24px_minmax(150px,1fr)_minmax(150px,1fr)_150px_24px_24px_24px_24px_28px] gap-1 items-center px-1 rounded transition-colors ${
                  dragOverIndex === index ? "bg-primary/10" : ""
                } ${dragIndex === index ? "opacity-40" : ""}`}
              >
                {/* Drag handle */}
                <div className="flex items-center justify-center cursor-grab active:cursor-grabbing">
                  <GripVertical size={12} className="text-muted-foreground" />
                </div>

                {/* Logical Name */}
                <Input
                  value={port.logicalName ?? ""}
                  onChange={(e) => handlePortChange(port._key, "logicalName", e.target.value)}
                  placeholder="カラム名"
                  className="h-7 text-xs"
                />

                {/* Physical Name */}
                <Input
                  value={port.name}
                  onChange={(e) => handlePortChange(port._key, "name", e.target.value)}
                  placeholder="column_name"
                  className="h-7 text-xs"
                />

                {/* Type */}
                <Input
                  value={port.dataType ?? ""}
                  onChange={(e) => handlePortChange(port._key, "dataType", e.target.value)}
                  placeholder="VARCHAR"
                  className="h-7 text-xs"
                />

                {/* PK */}
                <div className="flex justify-center">
                  <Checkbox
                    tabIndex={-1}
                    checked={!!port.isPrimaryKey}
                    onCheckedChange={(v: boolean) => handlePortChange(port._key, "isPrimaryKey", v)}
                  />
                </div>

                {/* FK */}
                <div className="flex justify-center">
                  <Checkbox
                    tabIndex={-1}
                    checked={!!port.isForeignKey}
                    onCheckedChange={(v: boolean) => handlePortChange(port._key, "isForeignKey", v)}
                  />
                </div>

                {/* NN */}
                <div className="flex justify-center">
                  <Checkbox
                    tabIndex={-1}
                    checked={!!port.isNotNull}
                    onCheckedChange={(v: boolean) => handlePortChange(port._key, "isNotNull", v)}
                  />
                </div>

                {/* UQ */}
                <div className="flex justify-center">
                  <Checkbox
                    tabIndex={-1}
                    checked={!!port.isUnique}
                    onCheckedChange={(v: boolean) => handlePortChange(port._key, "isUnique", v)}
                  />
                </div>

                {/* Delete */}
                <button
                  tabIndex={-1}
                  className="flex justify-center text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemovePort(port._key)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            {ports.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-4">
                {t("neNoColumns")}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("betaClose")}
          </Button>
          <Button onClick={handleSave}>
            {t("neSave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
