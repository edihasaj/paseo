// Marker for prose / content surfaces (assistant Markdown, user chat text,
// list/blockquote/table text). On web, the app-wide interface-font rule (see
// `@/appearance/apply-root-font.web.ts`) forces `theme.fontFamily.ui` onto every
// element inside the app and overlay roots; tagging a prose container with this
// dataSet routes it to `theme.fontFamily.content` instead. A nested `data-pmono`
// surface (inline code, etc.) still wins within a tagged subtree. On native it
// renders nothing and is harmless. Use a shared stable reference so it doesn't trip
// the react-perf "new object as prop" rule.
export const CONTENT_SURFACE_DATASET = { pcontent: "" } as const;
