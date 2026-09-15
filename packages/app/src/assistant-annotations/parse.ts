/**
 * Parser for the provider annotation grammar some agent providers (Codex's
 * app-server today) emit inline in assistant text: `:name{key="value" ...}`.
 *
 * Values may be quoted (spaces and escaped quotes allowed) or bare. A token
 * that never finds its closing `}` before the text ends is "incomplete" —
 * streamed deltas can split a token across chunks, and the caller re-parses
 * the growing text on every update, so an incomplete token here simply gets
 * tried again once more text has arrived.
 */
export interface ParsedAnnotationToken {
  name: string;
  attributes: Record<string, string>;
  start: number;
  end: number;
}

export type AnnotationParseResult =
  | { status: "complete"; token: ParsedAnnotationToken }
  | { status: "incomplete" }
  | { status: "invalid" };

export const ANNOTATION_TOKEN_START_PATTERN = /:[A-Za-z][A-Za-z0-9_-]*\{/g;

const KEY_PATTERN = /[A-Za-z_][A-Za-z0-9_-]*/y;

function isWhitespace(char: string): boolean {
  return char === " " || char === "\t" || char === "\n" || char === "\r";
}

function skipWhitespace(text: string, index: number): number {
  let cursor = index;
  while (cursor < text.length && isWhitespace(text[cursor]!)) cursor++;
  return cursor;
}

function parseQuotedValue(
  text: string,
  index: number,
): { value: string; end: number } | { incomplete: true } {
  let cursor = index + 1;
  let value = "";
  while (cursor < text.length) {
    const char = text[cursor];
    if (char === "\\" && cursor + 1 < text.length) {
      value += text[cursor + 1];
      cursor += 2;
      continue;
    }
    if (char === '"') {
      return { value, end: cursor + 1 };
    }
    value += char;
    cursor++;
  }
  return { incomplete: true };
}

function parseBareValue(text: string, index: number): { value: string; end: number } | null {
  let cursor = index;
  while (cursor < text.length && text[cursor] !== "}" && !isWhitespace(text[cursor]!)) {
    cursor++;
  }
  if (cursor >= text.length) return null;
  return { value: text.slice(index, cursor), end: cursor };
}

/**
 * Attempts to parse a `:name{...}` token starting exactly at `start`.
 * `start` must point at the leading `:`.
 */
export function parseAnnotationTokenAt(text: string, start: number): AnnotationParseResult {
  ANNOTATION_TOKEN_START_PATTERN.lastIndex = start;
  const match = ANNOTATION_TOKEN_START_PATTERN.exec(text);
  if (!match || match.index !== start) {
    return { status: "invalid" };
  }

  const name = match[0].slice(1, -1);
  const attributes: Record<string, string> = {};
  let cursor = start + match[0].length;

  while (true) {
    cursor = skipWhitespace(text, cursor);
    if (cursor >= text.length) return { status: "incomplete" };
    if (text[cursor] === "}") {
      return { status: "complete", token: { name, attributes, start, end: cursor + 1 } };
    }

    KEY_PATTERN.lastIndex = cursor;
    const keyMatch = KEY_PATTERN.exec(text);
    if (!keyMatch) return { status: "invalid" };
    const key = keyMatch[0];
    cursor += key.length;

    cursor = skipWhitespace(text, cursor);
    if (cursor >= text.length) return { status: "incomplete" };
    if (text[cursor] !== "=") return { status: "invalid" };
    cursor++;
    cursor = skipWhitespace(text, cursor);
    if (cursor >= text.length) return { status: "incomplete" };

    if (text[cursor] === '"') {
      const quoted = parseQuotedValue(text, cursor);
      if ("incomplete" in quoted) return { status: "incomplete" };
      attributes[key] = quoted.value;
      cursor = quoted.end;
      continue;
    }

    const bare = parseBareValue(text, cursor);
    if (!bare) return { status: "incomplete" };
    attributes[key] = bare.value;
    cursor = bare.end;
  }
}
