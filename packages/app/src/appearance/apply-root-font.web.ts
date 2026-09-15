// Apply the interface (UI) and content (prose) fonts app-wide on web.
//
// react-native-web stamps a hardcoded default font onto every text element, so a
// plain `body { font-family }` never cascades in — the element already has its own
// font. Instead we inject rules that point all text at CSS variables and set those
// variables live. The base rule's selector is high-specificity (1,2,0) so it
// deterministically beats both RN-web's base font and Unistyles' generated classes
// (0,1,0) — no reliance on stylesheet order. Code/diff/terminal surfaces carry
// `data-pmono` (and have their subtree excluded via `:not([data-pmono] *)`) so they
// keep their monospace font regardless of which rule would otherwise apply.
//
// Prose surfaces (assistant Markdown, user chat text, list/blockquote/table text)
// carry `data-pcontent` (see `@/styles/content-surface`) so `theme.fontFamily.content`
// reaches them instead of the UI font. The content rule's `:is([data-pcontent],
// [data-pcontent] *)` branch gives it specificity (1,3,0), one attribute selector
// higher than the base rule, so it wins inside a tagged subtree without needing to
// exclude `data-pcontent` from the base rule's selector.
const STYLE_ID = "paseo-ui-font";
const RULE =
  ":is(#root, #overlay-root) *:not([data-pmono]):not([data-pmono] *){font-family:var(--paseo-ui-font);}" +
  ":is(#root, #overlay-root) :is([data-pcontent],[data-pcontent] *):not([data-pmono]):not([data-pmono] *){font-family:var(--paseo-content-font);}";

function sanitizeFontStack(fontStack: string): string {
  // Strip anything that could break out of the CSS value; commas/quotes/spaces in a
  // font stack are fine.
  return fontStack
    .replace(/[<>{}();]/g, "")
    .replace(/[\r\n]/g, " ")
    .trim();
}

export function applyRootUiFont(uiFontStack: string, contentFontStack: string): void {
  if (typeof document === "undefined") return;
  const uiValue = sanitizeFontStack(uiFontStack);
  const contentValue = sanitizeFontStack(contentFontStack);
  if (uiValue.length === 0 && contentValue.length === 0) return;

  if (uiValue.length > 0) {
    document.documentElement.style.setProperty("--paseo-ui-font", uiValue);
  }
  if (contentValue.length > 0) {
    document.documentElement.style.setProperty("--paseo-content-font", contentValue);
  }

  // The rules themselves are static (they reference the variables); inject once.
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = RULE;
    document.head.appendChild(style);
  }
}
