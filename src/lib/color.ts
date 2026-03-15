/**
 * Compute a CSS color string from a base hex color with opacity and lightness adjustments.
 *
 * @param hex      Base color in "#rrggbb" format
 * @param opacity  0 (transparent) to 10 (opaque), default 10
 * @param lightness 0 (bright/white) to 10 (dark/black), default 5 = original
 * @returns CSS rgba() string, or the original value if not a valid hex
 */
export function computeColor(
  hex: string | undefined,
  opacity?: number,
  lightness?: number,
): string | undefined {
  // If opacity is explicitly 0, always transparent regardless of color
  if (opacity === 0) return "transparent";

  if (!hex || !hex.startsWith("#") || hex.length < 7) return hex;

  const op = opacity ?? 10;
  const lt = lightness ?? 5;

  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);

  // Adjust lightness: 0=white, 5=original, 10=black
  if (lt < 5) {
    const factor = lt / 5;
    r = Math.round(r * factor + 255 * (1 - factor));
    g = Math.round(g * factor + 255 * (1 - factor));
    b = Math.round(b * factor + 255 * (1 - factor));
  } else if (lt > 5) {
    const factor = (10 - lt) / 5;
    r = Math.round(r * factor);
    g = Math.round(g * factor);
    b = Math.round(b * factor);
  }

  const alpha = op / 10;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
