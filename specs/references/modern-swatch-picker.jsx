import { useState, useRef, useEffect, useCallback } from "react";

/* ── Colors ── */
const BASE_COLORS = [
  { label: "デフォルト", hex: "#888888" },
  { label: "赤", hex: "#ef4444" },
  { label: "橙", hex: "#f97316" },
  { label: "黄", hex: "#eab308" },
  { label: "緑", hex: "#22c55e" },
  { label: "青", hex: "#3b82f6" },
  { label: "紫", hex: "#a855f7" },
  { label: "桃", hex: "#ec4899" },
];
const NC = BASE_COLORS.length;
const SLICE = 360 / NC;
const LS = 5;

/* ── Layout ── */
const SWATCH_R = 15;
const BASE_RING_R = 76;
const SHADE_GAP = 36;   // vertical gap between shade swatches
const LABEL_R = 128;
const MENU_SIZE = 340;
const DEADZONE = 20;
const HIT_R = SWATCH_R + 6;

/* ── Utils ── */
function hexToHSL(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslC(h, s, l, a = 1) {
  return `hsla(${h.toFixed(1)},${s.toFixed(1)}%,${l.toFixed(1)}%,${a})`;
}

function variant(hex, step) {
  const [h, s, l] = hexToHSL(hex);
  const t = step / (LS - 1);
  return { h, s: s * (1 - t * 0.35), l: Math.min(l * (0.3 + t * 0.7) + t * 20, 96) };
}

function varCSS(hex, step, a = 1) {
  const v = variant(hex, step);
  return hslC(v.h, v.s, v.l, a);
}

function dst(ax, ay, bx, by) {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

const C = MENU_SIZE / 2;

function basePos(ci) {
  const a = (ci * SLICE * Math.PI) / 180;
  return { x: C + Math.cos(a) * BASE_RING_R, y: C + Math.sin(a) * BASE_RING_R };
}

function shadePos(ci, li) {
  const centerDeg = ci * SLICE;
  const offset = (li - (LS - 1) / 2) * (SHADE_ARC_SPAN / (LS - 1));
  const deg = centerDeg + offset;
  const rad = (deg * Math.PI) / 180;
  return { x: C + Math.cos(rad) * SHADE_R, y: C + Math.sin(rad) * SHADE_R };
}

/* ── Swatch ── */
function Swatch({ x, y, color, size, isHover, ringColor, delay, label, fading }) {
  return (
    <div style={{
      position: "absolute", left: x, top: y,
      transform: `translate(-50%,-50%) ${isHover ? "scale(1.22)" : "scale(1)"}`,
      transition: "transform 100ms cubic-bezier(0.34,1.56,0.64,1), opacity 130ms ease",
      opacity: fading ? 0 : 1,
      zIndex: isHover ? 20 : 5,
      cursor: "pointer",
      animation: `pop 180ms cubic-bezier(0.34,1.56,0.64,1) ${delay}ms both`,
    }}>
      <div style={{
        position: "absolute", inset: -5, borderRadius: "50%",
        border: `2px solid ${isHover ? (ringColor || color) + "77" : "transparent"}`,
        transition: "border-color 100ms ease",
      }} />
      <div style={{
        width: size * 2, height: size * 2, borderRadius: "50%",
        background: `radial-gradient(circle at 36% 30%, ${color}dd, ${color})`,
        boxShadow: isHover
          ? `0 0 16px ${color}55, 0 4px 12px #000000aa, inset 0 1px 2px #ffffff25`
          : `0 2px 8px #00000088, inset 0 1px 1px #ffffff15`,
        transition: "box-shadow 100ms ease",
      }} />
      {isHover && label && (
        <div style={{
          position: "absolute", left: "50%", bottom: -(size + 14),
          transform: "translateX(-50%)",
          color: "#ffffff66", fontSize: 9, fontWeight: 500,
          whiteSpace: "nowrap", pointerEvents: "none",
          animation: "labelUp 100ms ease-out",
        }}>{label}</div>
      )}
    </div>
  );
}

/* ── Main ── */
export default function ModernSwatchPicker() {
  const [menuPos, setMenuPos] = useState(null);
  const [expanded, setExpanded] = useState(-1);
  const [hoverBase, setHoverBase] = useState(-1);
  const [hoverShade, setHoverShade] = useState(-1);
  const [selected, setSelected] = useState(null);
  const [opacity, setOpacity] = useState(100);
  const [toast, setToast] = useState(null);
  const [phase, setPhase] = useState("base");
  const mousePosRef = useRef({ x: 0, y: 0 });
  const toastTimer = useRef(null);

  useEffect(() => {
    const fn = (e) => { mousePosRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener("mousemove", fn);
    return () => window.removeEventListener("mousemove", fn);
  }, []);

  useEffect(() => {
    const fn = (e) => {
      if (e.repeat || e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "r" || e.key === "R") {
        setMenuPos((prev) => {
          if (prev) return null;
          setExpanded(-1); setHoverBase(-1); setHoverShade(-1); setPhase("base");
          return { x: mousePosRef.current.x, y: mousePosRef.current.y };
        });
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  useEffect(() => {
    const fn = (e) => { if (menuPos) { e.preventDefault(); setMenuPos(null); } };
    window.addEventListener("contextmenu", fn);
    return () => window.removeEventListener("contextmenu", fn);
  }, [menuPos]);

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  const toLocal = useCallback((e) => ({
    x: e.clientX - (menuPos?.x ?? 0) + C,
    y: e.clientY - (menuPos?.y ?? 0) + C,
  }), [menuPos]);

  const handleMouseMove = useCallback((e) => {
    if (!menuPos) return;
    const { x: mx, y: my } = toLocal(e);

    if (phase === "shade" && expanded >= 0) {
      let found = -1;
      for (let li = 0; li < LS; li++) {
        const p = shadePos(expanded, li);
        if (dst(mx, my, p.x, p.y) < HIT_R) { found = li; break; }
      }
      setHoverShade(found);
      setHoverBase(-1);
    } else if (phase === "base") {
      let found = -1;
      for (let ci = 0; ci < NC; ci++) {
        const p = basePos(ci);
        if (dst(mx, my, p.x, p.y) < HIT_R) { found = ci; break; }
      }
      setHoverBase(found);
      setHoverShade(-1);
    }
  }, [menuPos, phase, expanded, toLocal]);

  const transTo = (target, ci = -1) => {
    if (target === "shade") {
      setPhase("toShade");
      setTimeout(() => { setExpanded(ci); setPhase("shade"); }, 130);
    } else {
      setPhase("toBase");
      setTimeout(() => { setExpanded(-1); setPhase("base"); }, 130);
    }
  };

  const handleClick = useCallback((e) => {
    if (!menuPos) return;
    const { x: mx, y: my } = toLocal(e);
    const dc = dst(mx, my, C, C);

    if (phase === "shade" && expanded >= 0) {
      for (let li = 0; li < LS; li++) {
        const p = shadePos(expanded, li);
        if (dst(mx, my, p.x, p.y) < HIT_R) {
          const css = varCSS(BASE_COLORS[expanded].hex, li, opacity / 100);
          setSelected({ ci: expanded, li, css, opacity });
          showToast(`${BASE_COLORS[expanded].label} 明${(li + 1) * 20}% 透${opacity}%`);
          setMenuPos(null);
          return;
        }
      }
      if (dc < DEADZONE + 10) { transTo("base"); return; }
      if (dc > SHADE_R + 50) setMenuPos(null);
    } else if (phase === "base") {
      for (let ci = 0; ci < NC; ci++) {
        const p = basePos(ci);
        if (dst(mx, my, p.x, p.y) < HIT_R) { transTo("shade", ci); return; }
      }
      if (dc > BASE_RING_R + 60) setMenuPos(null);
    }
  }, [menuPos, phase, expanded, opacity, toLocal]);

  const handleWheel = useCallback((e) => {
    if (!menuPos) return;
    e.preventDefault();
    setOpacity((prev) => Math.max(10, Math.min(100, prev + (e.deltaY < 0 ? 10 : -10))));
  }, [menuPos]);

  let preview = null;
  if (phase === "shade" && hoverShade >= 0)
    preview = varCSS(BASE_COLORS[expanded].hex, hoverShade, opacity / 100);
  else if (phase === "base" && hoverBase >= 0)
    preview = BASE_COLORS[hoverBase].hex;

  const showBase = phase === "base" || phase === "toShade";
  const showShade = phase === "shade" || phase === "toBase";
  const fadingOut = phase === "toShade";
  const fadingBack = phase === "toBase";

  return (
    <div
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onWheel={handleWheel}
      style={{
        position: "fixed", inset: 0,
        background: "#08080f",
        cursor: menuPos ? "crosshair" : "default",
        fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
        userSelect: "none", overflow: "hidden",
      }}
    >
      <div style={{
        position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)",
        color: "#ffffff1e", fontSize: 11, letterSpacing: 0.4,
      }}>
        R — メニュー ┃ ホイール — 透明度 ┃ 右クリック — 閉じる
      </div>

      {menuPos && (
        <div style={{
          position: "fixed",
          left: menuPos.x - C, top: menuPos.y - C,
          width: MENU_SIZE, height: MENU_SIZE,
          animation: "menuOpen 200ms cubic-bezier(0.34,1.56,0.64,1)",
        }}>

          {/* Center disc */}
          <div style={{
            position: "absolute",
            left: C - DEADZONE, top: C - DEADZONE,
            width: DEADZONE * 2, height: DEADZONE * 2,
            borderRadius: "50%",
            background: preview || "#ffffff06",
            border: `1.5px solid ${preview ? "#ffffff22" : "#ffffff08"}`,
            transition: "all 150ms ease",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 10,
            boxShadow: preview ? `0 0 20px ${preview}33` : "none",
          }}>
            {phase === "shade" && (
              <span style={{ color: "#ffffff33", fontSize: 11, cursor: "pointer" }}>‹</span>
            )}
          </div>

          {/* BASE */}
          {showBase && BASE_COLORS.map((c, ci) => {
            const p = basePos(ci);
            return (
              <Swatch key={`b-${ci}`}
                x={p.x} y={p.y} color={c.hex}
                size={SWATCH_R} isHover={hoverBase === ci}
                delay={ci * 22} fading={fadingOut}
              />
            );
          })}

          {showBase && BASE_COLORS.map((c, ci) => {
            const a = (ci * SLICE * Math.PI) / 180;
            return (
              <div key={`bl-${ci}`} style={{
                position: "absolute",
                left: C + Math.cos(a) * LABEL_R,
                top: C + Math.sin(a) * LABEL_R,
                transform: "translate(-50%,-50%)",
                color: hoverBase === ci ? "#ffffffaa" : "#ffffff20",
                fontSize: 10, fontWeight: hoverBase === ci ? 600 : 400,
                transition: "all 120ms ease",
                pointerEvents: "none",
                opacity: fadingOut ? 0 : 1,
              }}>{c.label}</div>
            );
          })}

          {/* SHADES */}
          {showShade && expanded >= 0 && (
            <>
              <div style={{
                position: "absolute", left: C, top: C - DEADZONE - 16,
                transform: "translateX(-50%)",
                color: BASE_COLORS[expanded].hex,
                fontSize: 10, fontWeight: 600, pointerEvents: "none",
                opacity: fadingBack ? 0 : 1, transition: "opacity 130ms ease",
              }}>{BASE_COLORS[expanded].label}</div>

              {Array.from({ length: LS }).map((_, li) => {
                const p = shadePos(expanded, li);
                const col = varCSS(BASE_COLORS[expanded].hex, li, opacity / 100);
                const colFull = varCSS(BASE_COLORS[expanded].hex, li);
                return (
                  <Swatch key={`s-${li}`}
                    x={p.x} y={p.y} color={col}
                    ringColor={colFull}
                    size={SWATCH_R + li * 1}
                    isHover={hoverShade === li}
                    delay={li * 30} fading={fadingBack}
                    label={`明${(li + 1) * 20}%`}
                  />
                );
              })}

              {BASE_COLORS.map((c, ci) => {
                if (ci === expanded) return null;
                const p = basePos(ci);
                return (
                  <div key={`dim-${ci}`} style={{
                    position: "absolute", left: p.x, top: p.y,
                    transform: "translate(-50%,-50%)",
                    width: 6, height: 6, borderRadius: "50%",
                    background: c.hex + "22", pointerEvents: "none",
                    opacity: fadingBack ? 0 : 1, transition: "opacity 130ms ease",
                  }} />
                );
              })}
            </>
          )}

          {/* Opacity */}
          <div style={{
            position: "absolute", bottom: -44, left: "50%", transform: "translateX(-50%)",
            display: "flex", alignItems: "center", gap: 10,
            background: "#10101a", padding: "5px 14px", borderRadius: 20,
            border: "1px solid #ffffff08",
          }}>
            <span style={{ color: "#ffffff22", fontSize: 10 }}>透明度</span>
            <input type="range" min={10} max={100} step={10} value={opacity}
              onChange={(e) => { e.stopPropagation(); setOpacity(Number(e.target.value)); }}
              onClick={(e) => e.stopPropagation()}
              style={{ width: 90, cursor: "pointer" }}
            />
            <span style={{ color: "#ffffff66", fontSize: 10, fontWeight: 600, minWidth: 30, textAlign: "right" }}>
              {opacity}%
            </span>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: "fixed", bottom: 36, left: "50%", transform: "translateX(-50%)",
          padding: "8px 22px", borderRadius: 20,
          background: "#10101a", border: "1px solid #ffffff08",
          color: "#ffffffbb", fontSize: 12, fontWeight: 500,
          boxShadow: "0 8px 32px #00000055",
          animation: "toastIn 180ms ease-out",
        }}>{toast}</div>
      )}

      {selected && !menuPos && (
        <div style={{
          position: "absolute", bottom: 90, left: "50%", transform: "translateX(-50%)",
          display: "flex", alignItems: "center", gap: 12,
          background: "#10101a", padding: "10px 20px", borderRadius: 14,
          border: "1px solid #ffffff08",
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: selected.css,
            boxShadow: `0 0 10px ${selected.css}, 0 2px 6px #00000066, inset 0 1px 1px #ffffff18`,
          }} />
          <div>
            <div style={{ color: "#ffffffbb", fontSize: 12, fontWeight: 600 }}>
              {BASE_COLORS[selected.ci].label}
            </div>
            <div style={{ color: "#ffffff44", fontSize: 10 }}>
              明{(selected.li + 1) * 20}% / 透{selected.opacity}%
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes menuOpen {
          from { opacity: 0; transform: scale(0.6); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes pop {
          from { opacity: 0; transform: translate(-50%,-50%) scale(0.2); }
          to { opacity: 1; transform: translate(-50%,-50%) scale(1); }
        }
        @keyframes labelUp {
          from { opacity: 0; transform: translateX(-50%) translateY(3px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(6px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        input[type="range"] {
          -webkit-appearance: none;
          height: 3px;
          background: linear-gradient(to right, #ffffff08, #ffffff33);
          border-radius: 2px; outline: none;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px; height: 12px; border-radius: 50%;
          background: #ffffffcc; border: none; cursor: pointer;
          box-shadow: 0 0 6px #ffffff18, 0 1px 3px #00000055;
        }
      `}</style>
    </div>
  );
}
