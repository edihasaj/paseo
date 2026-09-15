// Native (and default) no-op: React Native has no global font cascade, so the
// interface and content fonts apply only where components read
// theme.fontFamily.ui/content. The web build (apply-root-font.web.ts) overrides
// this to apply them app-wide.
export function applyRootUiFont(_uiFontStack: string, _contentFontStack: string): void {}
