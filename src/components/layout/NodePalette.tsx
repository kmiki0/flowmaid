"use client";

import { useEffect, useRef, useState } from "react";
import { useDnD } from "@/hooks/useDnD";
import { Shapes, Component, Plus, Minus } from "lucide-react";
import { useLocale } from "@/lib/i18n/useLocale";
import { useFlowStore } from "@/store/useFlowStore";
import type { TranslationKey } from "@/lib/i18n/locales";
import { Github } from "lucide-react";
import { ComponentManagerPanel } from "@/components/flowComponent/ComponentManagerPanel";
import { GITHUB_ISSUES_URL } from "@/lib/constants";

const shapes: { type: string; key: TranslationKey; tooltipKey: TranslationKey; icon: React.ReactNode }[] = [
  { type: "rectangle", key: "rectangle", tooltipKey: "rectangleDesc", icon: <rect x="4" y="8" width="24" height="16" rx="0" /> },
  { type: "roundedRect", key: "roundedRect", tooltipKey: "roundedRectDesc", icon: <rect x="4" y="8" width="24" height="16" rx="6" /> },
  { type: "diamond", key: "diamond", tooltipKey: "diamondDesc", icon: <polygon points="16 4, 28 16, 16 28, 4 16" /> },
  { type: "circle", key: "circle", tooltipKey: "circleDesc", icon: <circle cx="16" cy="16" r="12" /> },
  { type: "stadium", key: "stadium", tooltipKey: "stadiumDesc", icon: <rect x="4" y="8" width="24" height="16" rx="8" /> },
  { type: "parallelogram", key: "parallelogram", tooltipKey: "parallelogramDesc", icon: <polygon points="8 8, 28 8, 24 24, 4 24" /> },
  { type: "cylinder", key: "cylinder", tooltipKey: "cylinderDesc", icon: (
    <>
      <path d="M 6 12 Q 6 8 16 8 Q 26 8 26 12 L 26 22 Q 26 26 16 26 Q 6 26 6 22 Z" />
      <path d="M 6 12 Q 6 16 16 16 Q 26 16 26 12" />
    </>
  )},
  { type: "hexagon", key: "hexagon", tooltipKey: "hexagonDesc", icon: <polygon points="10 6, 22 6, 28 16, 22 26, 10 26, 4 16" /> },
  { type: "trapezoid", key: "trapezoid", tooltipKey: "trapezoidDesc", icon: <polygon points="10 8, 22 8, 28 24, 4 24" /> },
  { type: "document", key: "document", tooltipKey: "documentDesc", icon: (
    <path d="M 4 8 L 28 8 L 28 22 Q 22 26 16 22 Q 10 18 4 22 Z" />
  )},
  { type: "manualInput", key: "manualInput", tooltipKey: "manualInputDesc", icon: <polygon points="4 12, 28 8, 28 24, 4 24" /> },
  { type: "internalStorage", key: "internalStorage", tooltipKey: "internalStorageDesc", icon: (
    <>
      <rect x="4" y="8" width="24" height="16" rx="0" />
      <line x1="8" y1="8" x2="8" y2="24" />
      <line x1="4" y1="12" x2="28" y2="12" />
    </>
  )},
  { type: "display", key: "display", tooltipKey: "displayDesc", icon: (
    <path d="M 9 8 L 22 8 Q 28 16 22 24 L 9 24 Q 4 16 9 8 Z" />
  )},
  { type: "text", key: "freeText", tooltipKey: "freeTextDesc", icon: <text x="16" y="20" textAnchor="middle" fill="currentColor" stroke="none" fontSize="16" fontWeight="bold">T</text> },
];

/** 折りたたみ時に1列で表示する代表的なシェイプ数 */
const PRIMARY_SHAPE_COUNT = 5;

/** 展開時グリッドの要素ごとのアニメーション遅延（パパパッと順次表示） */
const POP_IN_STAGGER_MS = 25;

export function NodePalette() {
  const { onDragStart, onDragEnd } = useDnD();
  const { t } = useLocale();
  const [showAll, setShowAll] = useState(false);
  const isEditingComponent = useFlowStore((s) => !!s.editingComponentId);
  const shapesCardRef = useRef<HTMLDivElement>(null);
  // [−]で閉じた直後はマウスがカード上に残るため、離れるまでホバー展開を抑制
  // （キャンバスクリックで閉じた時とアニメーションを揃える）
  const [suppressHover, setSuppressHover] = useState(false);

  const collapseShapes = () => {
    setShowAll(false);
    setSuppressHover(true);
  };

  // 展開中にカード外（キャンバス等）をクリックしたら折りたたむ
  useEffect(() => {
    if (!showAll) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (shapesCardRef.current && !shapesCardRef.current.contains(e.target as Node)) {
        setShowAll(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [showAll]);

  // アイコンレール幅（コンポーネント/フィードバックは折りたたみ時のみ表示）
  const railWidthClass = "w-[54px]";

  return (
    // pointer-events-none: カード間の隙間ではキャンバス操作を透過させる（オーバーレイ表示）
    <div className="h-full flex flex-col items-start justify-center gap-2 pointer-events-none">
      {/* Shapes card — collapsed: icon-only rail / expanded: same row format, columns flow horizontally */}
      <div
        ref={shapesCardRef}
        // interpolate-size: w-auto（展開）↔ 固定幅（折りたたみ）間のwidth遷移を補間可能にする
        className={`group pointer-events-auto glass-panel flex flex-col min-h-0 shrink-0 overflow-hidden transition-[width] duration-200 ease-out [interpolate-size:allow-keywords] ${
          showAll ? "w-auto" : `w-[54px] max-h-[55%] ${suppressHover ? "" : "hover:w-36"}`
        }`}
        // 展開時はカードの余白クリックで折りたたむ（[−]ボタンと同じ挙動）
        onClick={
          showAll
            ? (e) => {
                if (!(e.target as HTMLElement).closest("button")) collapseShapes();
              }
            : undefined
        }
        onMouseLeave={() => setSuppressHover(false)}
      >
        <div
          className={`pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0 flex items-center gap-1.5 ${
            showAll ? "px-3" : "justify-center px-2"
          }`}
        >
          <Shapes size={12} />
          {showAll && t("nodes")}
        </div>
        {/* 折りたたみ時: スクロールバー非表示 / 展開時: 縦スクロールなし（全件表示） */}
        <div
          className={
            showAll
              ? "p-2"
              : "overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          }
        >
          {showAll ? (
            // 折りたたみ時と同じ行フォーマット（アイコン+ラベル）のまま、
            // 縦6行（PRIMARY_SHAPE_COUNT + トグル行）固定で横方向に列展開
            // 行高は1frでなくautoにして折りたたみ時と縦幅を一致させる
            // 列を明示定義（col-span-fullが暗黙列では1列分にしかならないため3列を明示）
            // 1fr均等割りで3列とも同じ横幅にする
            <div className="grid grid-rows-[repeat(6,auto)] grid-cols-3 grid-flow-col gap-x-2 gap-y-1">
              {shapes.map(({ type, key, tooltipKey, icon }, index) => (
                <button
                  key={type}
                  className="palette-pop-in flex items-center p-2 rounded-lg hover:bg-muted cursor-grab active:cursor-grabbing transition-colors whitespace-nowrap"
                  style={{ animationDelay: `${index * POP_IN_STAGGER_MS}ms` }}
                  draggable
                  onDragStart={(e) => onDragStart(e, type)}
                  onDragEnd={onDragEnd}
                  title={t(tooltipKey)}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 32 32"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="shrink-0 text-muted-foreground"
                  >
                    {icon}
                  </svg>
                  <span className="ml-2 text-xs text-muted-foreground">{t(key)}</span>
                </button>
              ))}
              {/* Collapse toggle — 最下段に全列ぶち抜きで配置 */}
              <button
                className="col-span-full row-start-6 flex w-full items-center justify-center py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                onClick={collapseShapes}
                title={t("showFewerShapes")}
              >
                <Minus size={14} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {shapes.slice(0, PRIMARY_SHAPE_COUNT).map(({ type, key, icon }) => (
                <button
                  key={type}
                  className="flex w-full items-center p-2 rounded-lg hover:bg-muted cursor-grab active:cursor-grabbing transition-colors whitespace-nowrap"
                  draggable
                  onDragStart={(e) => onDragStart(e, type)}
                  onDragEnd={onDragEnd}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 32 32"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="shrink-0 text-muted-foreground"
                  >
                    {icon}
                  </svg>
                  <span className="ml-2 text-xs text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    {t(key)}
                  </span>
                </button>
              ))}

              {/* Expand toggle */}
              <button
                className="flex items-center justify-center w-full py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                onClick={() => setShowAll(true)}
                title={t("showAllShapes")}
              >
                <Plus size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Components card — hide during component editing (nesting prevention) */}
      {!isEditingComponent && (
        <div className={`pointer-events-auto glass-panel min-h-0 flex flex-col overflow-hidden max-h-[35%] ${railWidthClass}`}>
          <div className="pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0 flex items-center justify-center px-2">
            <Component size={12} />
          </div>
          <div className="flex-1 overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ComponentManagerPanel compact />
          </div>
        </div>
      )}

      {/* Feedback button */}
      <div className={`pointer-events-auto shrink-0 ${railWidthClass}`}>
        <a
          href={GITHUB_ISSUES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center size-9 mx-auto text-primary-foreground bg-primary hover:bg-primary/90 rounded-full transition-colors hover:animate-shake"
          title={t("feedbackButton")}
        >
          <Github size={16} />
        </a>
      </div>
    </div>
  );
}
