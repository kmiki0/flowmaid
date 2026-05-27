import { useState, useRef, useEffect, useCallback } from "react";

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
const MENU_SIZE = 360;
const C = MENU_SIZE / 2;
const SWATCH_R = 16;
const SHADE_R = 13;
const BASE_RING_R = 76;
const DEADZONE = 20;
const PETAL_DIST = 58;    // distance from base swatch to petal center
const PETAL_ARC = 130;    // total arc span of petals (degrees)

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
function hslC(h, s, l, a = 1) { return `hsla(${h.toFixed(1)},${s.toFixed(1)}%,${l.toFixed(1)}%,${a})`; }
function varCSS(hex, step, a = 1) {
  const [h, s] = hexToHSL(hex);
  const t = step / (LS - 1);
  const l = 25 + t * 65;
  const sA = s * (1 - Math.abs(t - 0.5) * 0.3);
  return hslC(h, sA, l, a);
}
function dst(ax, ay, bx, by) { return Math.sqrt((ax-bx)**2 + (ay-by)**2); }
function basePos(ci) {
  const a = (ci * SLICE * Math.PI) / 180;
  return { x: C + Math.cos(a) * BASE_RING_R, y: C + Math.sin(a) * BASE_RING_R };
}

/* Petal positions: fan around base swatch, facing outward from center */
function petalPos(ci, li) {
  const bp = basePos(ci);
  const baseAngle = ci * SLICE; // degrees, outward direction
  // Fan from -PETAL_ARC/2 to +PETAL_ARC/2 around the outward direction
  const startA = baseAngle - PETAL_ARC / 2;
  const step = PETAL_ARC / (LS - 1);
  const angle = (startA + li * step) * Math.PI / 180;
  return {
    x: bp.x + Math.cos(angle) * PETAL_DIST,
    y: bp.y + Math.sin(angle) * PETAL_DIST,
  };
}

export default function PetalPicker() {
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
    const fn = e => { mousePosRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener("mousemove", fn);
    return () => window.removeEventListener("mousemove", fn);
  }, []);
  useEffect(() => {
    const fn = e => {
      if (e.repeat || e.target.tagName === "INPUT") return;
      if (e.key === "r" || e.key === "R") {
        setMenuPos(prev => {
          if (prev) return null;
          setExpanded(-1); setHoverBase(-1); setHoverShade(-1); setPhase("base");
          return mousePosRef.current;
        });
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);
  useEffect(() => {
    const fn = e => { if (menuPos) { e.preventDefault(); setMenuPos(null); } };
    window.addEventListener("contextmenu", fn);
    return () => window.removeEventListener("contextmenu", fn);
  }, [menuPos]);

  const showToast = msg => {
    setToast(msg); clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  const toLocal = useCallback(e => ({
    x: e.clientX - (menuPos?.x ?? 0) + C,
    y: e.clientY - (menuPos?.y ?? 0) + C,
  }), [menuPos]);

  const handleMouseMove = useCallback(e => {
    if (!menuPos) return;
    const { x: mx, y: my } = toLocal(e);

    // Base swatches
    let fb = -1;
    for (let ci = 0; ci < NC; ci++) {
      const p = basePos(ci);
      if (dst(mx, my, p.x, p.y) < SWATCH_R + 6) { fb = ci; break; }
    }
    setHoverBase(fb);

    // Shade petals
    if (phase === "shade" && expanded >= 0) {
      let fs = -1;
      for (let li = 0; li < LS; li++) {
        const p = petalPos(expanded, li);
        if (dst(mx, my, p.x, p.y) < SHADE_R + 5) { fs = li; break; }
      }
      setHoverShade(fs);
    } else {
      setHoverShade(-1);
    }
  }, [menuPos, phase, expanded, toLocal]);

  const handleClick = useCallback(e => {
    if (!menuPos) return;
    const { x: mx, y: my } = toLocal(e);
    const dc = dst(mx, my, C, C);

    // Shade petals
    if (phase === "shade" && expanded >= 0) {
      for (let li = 0; li < LS; li++) {
        const p = petalPos(expanded, li);
        if (dst(mx, my, p.x, p.y) < SHADE_R + 5) {
          const css = varCSS(BASE_COLORS[expanded].hex, li, opacity / 100);
          setSelected({ ci: expanded, li, css, opacity });
          showToast(`${BASE_COLORS[expanded].label} 明${(li+1)*20}% 透${opacity}%`);
          setMenuPos(null); return;
        }
      }
    }

    // Base swatches
    for (let ci = 0; ci < NC; ci++) {
      const p = basePos(ci);
      if (dst(mx, my, p.x, p.y) < SWATCH_R + 6) {
        if (phase === "shade" && ci === expanded) {
          setExpanded(-1); setPhase("base");
        } else {
          setExpanded(ci); setPhase("shade");
        }
        return;
      }
    }

    if (dc < DEADZONE + 5 && phase === "shade") { setExpanded(-1); setPhase("base"); return; }
    if (dc > BASE_RING_R + 80) setMenuPos(null);
  }, [menuPos, phase, expanded, opacity, toLocal]);

  const handleWheel = useCallback(e => {
    if (!menuPos) return;
    e.preventDefault();
    setOpacity(prev => Math.max(10, Math.min(100, prev + (e.deltaY < 0 ? 10 : -10))));
  }, [menuPos]);

  const isShade = phase === "shade" && expanded >= 0;
  let preview = null;
  if (isShade && hoverShade >= 0) preview = varCSS(BASE_COLORS[expanded].hex, hoverShade, opacity/100);
  else if (hoverBase >= 0) preview = BASE_COLORS[hoverBase].hex;

  return (
    <div onMouseMove={handleMouseMove} onClick={handleClick} onWheel={handleWheel}
      style={{ position: "fixed", inset: 0, background: "#08080f", cursor: menuPos ? "crosshair" : "default",
        fontFamily: "'Inter',system-ui,sans-serif", userSelect: "none" }}>
      <div style={{ position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)",
        color: "#ffffff1e", fontSize: 11 }}>R — メニュー ┃ ホイール — 透明度 ┃ 右クリック — 閉じる</div>

      {menuPos && (
        <div style={{ position: "fixed", left: menuPos.x - C, top: menuPos.y - C,
          width: MENU_SIZE, height: MENU_SIZE, overflow: "visible",
          animation: "menuOpen 200ms cubic-bezier(0.34,1.56,0.64,1)" }}>

          {/* Center disc */}
          <div style={{
            position: "absolute", left: C - DEADZONE, top: C - DEADZONE,
            width: DEADZONE * 2, height: DEADZONE * 2, borderRadius: "50%",
            background: preview || "#ffffff06",
            border: "1.5px solid #ffffff11", transition: "all 150ms", zIndex: 10,
            boxShadow: preview ? `0 0 20px ${preview}33` : "none",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {isShade && <span style={{ color: "#ffffff33", fontSize: 11 }}>‹</span>}
          </div>

          {/* Connector lines from base to petals */}
          {isShade && (
            <svg style={{ position: "absolute", left: 0, top: 0, width: MENU_SIZE, height: MENU_SIZE,
              overflow: "visible", pointerEvents: "none" }}>
              {Array.from({ length: LS }).map((_, li) => {
                const bp = basePos(expanded);
                const pp = petalPos(expanded, li);
                return (
                  <line key={li} x1={bp.x} y1={bp.y} x2={pp.x} y2={pp.y}
                    stroke={BASE_COLORS[expanded].hex + "22"} strokeWidth={1} />
                );
              })}
            </svg>
          )}

          {/* Base swatches */}
          {BASE_COLORS.map((c, ci) => {
            const p = basePos(ci);
            const dimmed = isShade && ci !== expanded;
            const isActive = isShade && ci === expanded;
            return (
              <div key={ci} style={{
                position: "absolute", left: p.x, top: p.y,
                transform: `translate(-50%,-50%) ${hoverBase === ci ? "scale(1.22)" : "scale(1)"}`,
                transition: "all 100ms cubic-bezier(0.34,1.56,0.64,1)",
                zIndex: isActive ? 15 : hoverBase === ci ? 20 : 5, cursor: "pointer",
                animation: `pop 180ms cubic-bezier(0.34,1.56,0.64,1) ${ci*22}ms both`,
              }}>
                <div style={{
                  position: "absolute", inset: -5, borderRadius: "50%",
                  border: `2px solid ${(hoverBase === ci || isActive) ? c.hex + "77" : "transparent"}`,
                }} />
                <div style={{
                  width: (dimmed ? 6 : SWATCH_R) * 2, height: (dimmed ? 6 : SWATCH_R) * 2,
                  borderRadius: "50%", background: dimmed ? c.hex + "44" : c.hex,
                  boxShadow: (hoverBase === ci || isActive)
                    ? `0 0 16px ${c.hex}55, 0 4px 12px #000000aa` : `0 2px 8px #00000088`,
                  transition: "all 100ms",
                }} />
              </div>
            );
          })}

          {/* Base labels */}
          {!isShade && BASE_COLORS.map((c, ci) => {
            const a = (ci * SLICE * Math.PI) / 180;
            return (
              <div key={`l-${ci}`} style={{
                position: "absolute",
                left: C + Math.cos(a) * (BASE_RING_R + 34),
                top: C + Math.sin(a) * (BASE_RING_R + 34),
                transform: "translate(-50%,-50%)",
                color: hoverBase === ci ? "#ffffffaa" : "#ffffff20",
                fontSize: 10, fontWeight: hoverBase === ci ? 600 : 400,
                pointerEvents: "none", transition: "all 120ms",
              }}>{c.label}</div>
            );
          })}

          {/* Petal shades */}
          {isShade && Array.from({ length: LS }).map((_, li) => {
            const p = petalPos(expanded, li);
            const col = varCSS(BASE_COLORS[expanded].hex, li, opacity / 100);
            const colFull = varCSS(BASE_COLORS[expanded].hex, li);
            const isH = hoverShade === li;
            return (
              <div key={`p-${li}`} style={{
                position: "absolute", left: p.x, top: p.y,
                transform: `translate(-50%,-50%) ${isH ? "scale(1.3)" : "scale(1)"}`,
                transition: "transform 100ms cubic-bezier(0.34,1.56,0.64,1)",
                zIndex: isH ? 25 : 12, cursor: "pointer",
                animation: `pop 160ms cubic-bezier(0.34,1.56,0.64,1) ${li * 35}ms both`,
              }}>
                <div style={{
                  position: "absolute", inset: -4, borderRadius: "50%",
                  border: isH ? `2px solid ${colFull}` : "2px solid transparent",
                  transition: "border-color 80ms",
                }} />
                <div style={{
                  width: SHADE_R * 2, height: SHADE_R * 2, borderRadius: "50%",
                  background: col,
                  boxShadow: isH
                    ? `0 0 14px ${colFull}, 0 4px 10px #000000aa`
                    : `0 2px 6px #00000088`,
                  transition: "box-shadow 80ms",
                }} />
                {isH && (
                  <div style={{
                    position: "absolute", left: "50%", bottom: -(SHADE_R + 12),
                    transform: "translateX(-50%)",
                    color: "#ffffff66", fontSize: 8, fontWeight: 500,
                    whiteSpace: "nowrap", pointerEvents: "none",
                  }}>明{(li+1)*20}%</div>
                )}
              </div>
            );
          })}

          <div style={{ position: "absolute", bottom: -44, left: "50%", transform: "translateX(-50%)",
            display: "flex", alignItems: "center", gap: 10, background: "#10101a",
            padding: "5px 14px", borderRadius: 20, border: "1px solid #ffffff08" }}>
            <span style={{ color: "#ffffff22", fontSize: 10 }}>透明度</span>
            <input type="range" min={10} max={100} step={10} value={opacity}
              onChange={e => { e.stopPropagation(); setOpacity(Number(e.target.value)); }}
              onClick={e => e.stopPropagation()} style={{ width: 90, cursor: "pointer" }} />
            <span style={{ color: "#ffffff66", fontSize: 10, fontWeight: 600, minWidth: 30, textAlign: "right" }}>{opacity}%</span>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 36, left: "50%", transform: "translateX(-50%)",
          padding: "8px 22px", borderRadius: 20, background: "#10101a", border: "1px solid #ffffff08",
          color: "#ffffffbb", fontSize: 12, fontWeight: 500, animation: "toastIn 180ms ease-out" }}>{toast}</div>
      )}
      {selected && !menuPos && (
        <div style={{ position: "absolute", bottom: 90, left: "50%", transform: "translateX(-50%)",
          display: "flex", alignItems: "center", gap: 12, background: "#10101a",
          padding: "10px 20px", borderRadius: 14, border: "1px solid #ffffff08" }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: selected.css,
            boxShadow: `0 0 10px ${selected.css}` }} />
          <div>
            <div style={{ color: "#ffffffbb", fontSize: 12, fontWeight: 600 }}>{BASE_COLORS[selected.ci].label}</div>
            <div style={{ color: "#ffffff44", fontSize: 10 }}>明{(selected.li+1)*20}% / 透{selected.opacity}%</div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes menuOpen { from { opacity:0; transform:scale(0.6) } to { opacity:1; transform:scale(1) } }
        @keyframes pop { from { opacity:0; transform:translate(-50%,-50%) scale(0.2) } to { opacity:1; transform:translate(-50%,-50%) scale(1) } }
        @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(6px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }
        input[type="range"] { -webkit-appearance:none; height:3px; background:linear-gradient(to right,#ffffff08,#ffffff33); border-radius:2px; outline:none }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance:none; width:12px; height:12px; border-radius:50%; background:#ffffffcc; border:none; cursor:pointer }
      `}</style>
    </div>
  );
}
