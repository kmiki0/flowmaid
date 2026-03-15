export function strokeDasharray(borderStyle?: string): string | undefined {
  switch (borderStyle) {
    case "dashed":
      return "6 3";
    case "dotted":
      return "2 2";
    default:
      return undefined;
  }
}
