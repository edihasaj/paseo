import { ANNOTATION_TOKEN_START_PATTERN, parseAnnotationTokenAt } from "./parse";
import { renderAnnotationToken } from "./render";

/**
 * Rewrites provider annotation tokens (`:name{key="value"}`) into readable
 * text before Markdown rendering. Pure and idempotent, so it is safe to call
 * on the same growing string on every streamed update: an incomplete token
 * at the tail is left raw and re-parsed once more text arrives.
 */
export function rewriteAssistantAnnotations(text: string): string {
  if (!text.includes("{")) return text;

  let result = "";
  let cursor = 0;
  while (cursor < text.length) {
    ANNOTATION_TOKEN_START_PATTERN.lastIndex = cursor;
    const match = ANNOTATION_TOKEN_START_PATTERN.exec(text);
    if (!match) {
      result += text.slice(cursor);
      break;
    }

    result += text.slice(cursor, match.index);
    const attempt = parseAnnotationTokenAt(text, match.index);
    if (attempt.status === "complete") {
      result += renderAnnotationToken(attempt.token);
      cursor = attempt.token.end;
      continue;
    }
    if (attempt.status === "incomplete") {
      result += text.slice(match.index);
      break;
    }
    // Invalid: not a real token. Keep the literal ":" and resume right after it.
    result += text[match.index];
    cursor = match.index + 1;
  }
  return result;
}
