/**
 * Lightweight syntax highlighter for .flowmaid output
 * (mermaid section + layout YAML section).
 * Pure functions — returns token arrays for rendering.
 */

export type HighlightTokenType = "plain" | "keyword" | "string" | "dim";

export interface HighlightToken {
  text: string;
  type: HighlightTokenType;
}

export interface HighlightLine {
  tokens: HighlightToken[];
}

const SECTION_MARKER = /^---\s.*\s---$/;
/** Line-leading keywords: `graph TD|LR`, `subgraph`, bare `end` */
const MERMAID_LEADING_KW = /^(\s*)(graph\s+(?:TD|LR)\b|subgraph\b|end\s*$)/;
const MERMAID_STRING_PATTERN =
  /("[^"]*")|(\|[^|]*\|)|(\[+[^\]]*\]+|\{+[^}]*\}+|\(+[^)]*\)+)/g;
const YAML_KEY = /^(\s*(?:-\s+)?)([\w-]+)(:)(.*)$/;
const YAML_STRING = /"[^"]*"/g;

function tokenizeMermaidLine(line: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let rest = line;

  // Keywords only at line start (avoids matching "end"/"TD" inside labels)
  const kwMatch = line.match(MERMAID_LEADING_KW);
  if (kwMatch) {
    const [, indent, kw] = kwMatch;
    if (indent) tokens.push({ text: indent, type: "plain" });
    tokens.push({ text: kw, type: "keyword" });
    rest = line.slice(indent.length + kw.length);
  }

  let last = 0;
  for (const m of rest.matchAll(MERMAID_STRING_PATTERN)) {
    const idx = m.index ?? 0;
    if (idx > last) tokens.push({ text: rest.slice(last, idx), type: "plain" });
    tokens.push({ text: m[0], type: "string" });
    last = idx + m[0].length;
  }
  if (last < rest.length) tokens.push({ text: rest.slice(last), type: "plain" });
  return tokens;
}

function tokenizeYamlLine(line: string): HighlightToken[] {
  const keyMatch = line.match(YAML_KEY);
  if (!keyMatch) {
    return tokenizeYamlValue(line);
  }
  const [, indent, key, colon, rest] = keyMatch;
  return [
    ...(indent ? [{ text: indent, type: "plain" as const }] : []),
    { text: key, type: "keyword" },
    { text: colon, type: "dim" },
    ...tokenizeYamlValue(rest),
  ];
}

function tokenizeYamlValue(text: string): HighlightToken[] {
  if (!text) return [];
  const tokens: HighlightToken[] = [];
  let last = 0;
  for (const m of text.matchAll(YAML_STRING)) {
    const idx = m.index ?? 0;
    if (idx > last) tokens.push({ text: text.slice(last, idx), type: "plain" });
    tokens.push({ text: m[0], type: "string" });
    last = idx + m[0].length;
  }
  if (last < text.length) tokens.push({ text: text.slice(last), type: "plain" });
  return tokens;
}

/** Tokenize a full .flowmaid (or mermaid-only) text into per-line tokens */
export function highlightFlowmaid(text: string): HighlightLine[] {
  let section: "mermaid" | "layout" = "mermaid";
  return text.split("\n").map((line) => {
    if (SECTION_MARKER.test(line.trim())) {
      if (line.includes("layout")) section = "layout";
      else if (line.includes("mermaid")) section = "mermaid";
      return { tokens: [{ text: line, type: "dim" as const }] };
    }
    return {
      tokens: section === "mermaid" ? tokenizeMermaidLine(line) : tokenizeYamlLine(line),
    };
  });
}
