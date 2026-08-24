import { ipcRenderer } from "electron";
import {
  BROWSER_ELEMENT_GUEST_BEGIN_CHANNEL,
  BROWSER_ELEMENT_GUEST_CANCEL_CHANNEL,
  BROWSER_ELEMENT_GUEST_READY_CHANNEL,
  BROWSER_ELEMENT_GUEST_RESULT_CHANNEL,
  type BrowserElementBeginInput,
} from "./channels.js";

interface SelectorSession {
  token: string;
  destroy(): void;
}

let current: SelectorSession | null = null;

function buildSelector(element: Element): string {
  if (element.id) return `#${CSS.escape(element.id)}`;
  const path: string[] = [];
  let cursor: Element | null = element;
  while (cursor) {
    let segment = cursor.tagName.toLowerCase();
    const siblings = cursor.parentElement
      ? Array.from(cursor.parentElement.children).filter(
          (candidate) => candidate.tagName === cursor?.tagName,
        )
      : [];
    if (siblings.length > 1) segment += `:nth-of-type(${siblings.indexOf(cursor) + 1})`;
    path.unshift(segment);
    cursor = cursor.parentElement;
  }
  return path.join(" > ");
}

function describeElement(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : "";
  const classes = Array.from(element.classList)
    .filter((name) => !name.startsWith("__paseo"))
    .slice(0, 2)
    .map((name) => `.${name}`)
    .join("");
  const rect = element.getBoundingClientRect();
  return `${tag}${id}${classes}  ${Math.round(rect.width)}×${Math.round(rect.height)}`;
}

function getReactComponentName(element: Element): string | null {
  const record = element as Element & Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!key.startsWith("__reactFiber$") && !key.startsWith("__reactInternalInstance$")) continue;
    let fiber = record[key] as Record<string, unknown> | null;
    while (fiber) {
      const type = fiber.type;
      if (typeof type === "function") {
        return (type as Function & { displayName?: string }).displayName ?? type.name ?? null;
      }
      fiber = (fiber._debugOwner ?? fiber.return ?? null) as Record<string, unknown> | null;
    }
  }
  return null;
}

function relevantStyles(element: Element): Record<string, string> {
  const computed = getComputedStyle(element);
  const names = [
    "display",
    "position",
    "width",
    "height",
    "color",
    "background-color",
    "font-size",
    "font-family",
    "padding",
    "margin",
    "border",
    "flex",
    "grid-template-columns",
    "gap",
    "overflow",
    "opacity",
    "z-index",
  ];
  return Object.fromEntries(
    names.flatMap((name) => {
      const value = computed.getPropertyValue(name);
      return value && !["none", "normal", "auto", "0px", "rgba(0, 0, 0, 0)"].includes(value)
        ? [[name, value]]
        : [];
    }),
  );
}

function parentChain(element: Element): string[] {
  const result: string[] = [];
  let cursor = element.parentElement;
  while (cursor && result.length < 5) {
    result.push(describeElement(cursor).split("  ")[0] ?? cursor.tagName.toLowerCase());
    cursor = cursor.parentElement;
  }
  return result;
}

function childSummary(element: Element): string[] {
  const children = Array.from(element.children)
    .slice(0, 8)
    .map((child) => describeElement(child).split("  ")[0] ?? child.tagName.toLowerCase());
  if (element.children.length > 8) children.push(`...(${element.children.length} total)`);
  return children;
}

function selectionFor(element: HTMLElement): Record<string, unknown> {
  const rect = element.getBoundingClientRect();
  const componentName = getReactComponentName(element);
  return {
    tag: element.tagName.toLowerCase(),
    text: (element.innerText || "").slice(0, 500),
    selector: buildSelector(element),
    attributes: Object.fromEntries(
      Array.from(element.attributes, ({ name, value }) => [name, value]),
    ),
    url: location.href,
    outerHTML: element.outerHTML.slice(0, 2_000),
    computedStyles: relevantStyles(element),
    boundingRect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    reactSource: componentName
      ? { fileName: null, lineNumber: null, columnNumber: null, componentName }
      : null,
    parentChain: parentChain(element),
    children: childSummary(element),
  };
}

function install(input: BrowserElementBeginInput): void {
  current?.destroy();
  if (document.readyState === "loading" || !document.documentElement) {
    ipcRenderer.send(BROWSER_ELEMENT_GUEST_RESULT_CHANNEL, {
      token: input.token,
      status: "failed",
      reason: "loading",
    });
    return;
  }

  const style = document.createElement("style");
  style.textContent = `
    .__paseo-select-hover { outline: 2px solid #3b82f6 !important; outline-offset: 2px !important; }
    .__paseo-select-label { position: fixed; z-index: 2147483647; pointer-events: none; padding: 5px 8px; border-radius: 6px; background: rgba(24,24,27,.96); color: #fff; font: 500 11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; box-shadow: 0 3px 12px rgba(0,0,0,.35); }
    .__paseo-selecting, .__paseo-selecting * { cursor: crosshair !important; user-select: none !important; }
  `;
  document.head.appendChild(style);
  document.documentElement.classList.add("__paseo-selecting");
  const label = document.createElement("div");
  label.className = "__paseo-select-label";
  label.hidden = true;
  document.documentElement.appendChild(label);
  let hovered: HTMLElement | null = null;

  const destroy = () => {
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKey, true);
    for (const eventName of ["mousedown", "mouseup", "pointerdown", "pointerup", "touchstart"])
      document.removeEventListener(eventName, block, true);
    document.documentElement.classList.remove("__paseo-selecting");
    hovered?.classList.remove("__paseo-select-hover");
    label.remove();
    style.remove();
    if (current?.token === input.token) current = null;
  };
  const finish = (payload: Record<string, unknown>) => {
    destroy();
    ipcRenderer.send(BROWSER_ELEMENT_GUEST_RESULT_CHANNEL, { token: input.token, ...payload });
  };
  function block(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }
  function onMove(event: MouseEvent) {
    block(event);
    hovered?.classList.remove("__paseo-select-hover");
    hovered = event.target instanceof HTMLElement ? event.target : null;
    if (!hovered || hovered === label) return;
    hovered.classList.add("__paseo-select-hover");
    const component = getReactComponentName(hovered);
    label.textContent = `${describeElement(hovered)}${component ? `  <${component}>` : ""}`;
    label.hidden = false;
    const rect = hovered.getBoundingClientRect();
    label.style.left = `${Math.max(4, Math.min(rect.left, innerWidth - label.offsetWidth - 4))}px`;
    label.style.top = `${Math.max(4, rect.top - label.offsetHeight - 6)}px`;
  }
  function onClick(event: MouseEvent) {
    block(event);
    const element = event.target instanceof HTMLElement ? event.target : null;
    if (element && element !== label)
      finish({ status: "selected", selection: selectionFor(element) });
  }
  function onKey(event: KeyboardEvent) {
    if (event.key === "Escape") finish({ status: "cancelled" });
  }

  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKey, true);
  for (const eventName of ["mousedown", "mouseup", "pointerdown", "pointerup", "touchstart"])
    document.addEventListener(eventName, block, true);
  current = { token: input.token, destroy };
}

export function installBrowserElementSelectorGuest(): void {
  ipcRenderer.on(BROWSER_ELEMENT_GUEST_BEGIN_CHANNEL, (_event, input: BrowserElementBeginInput) => {
    if (input && typeof input.token === "string") install(input);
  });
  ipcRenderer.on(BROWSER_ELEMENT_GUEST_CANCEL_CHANNEL, (_event, token: unknown) => {
    if (typeof token === "string" && current?.token === token) current.destroy();
  });
  ipcRenderer.send(BROWSER_ELEMENT_GUEST_READY_CHANNEL);
}
