import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createElementSelectorController,
  type BrowserElementSelection,
  type ElementSelectorController,
  type ElementSelectorOutcome,
} from "./element-selector.electron";

const { getDesktopHost } = vi.hoisted(() => ({ getDesktopHost: vi.fn() }));

vi.mock("@/desktop/host", () => ({ getDesktopHost }));

type Webview = Parameters<ElementSelectorController["start"]>[0]["webview"];

// The suite runs in the node environment, so the pane is stubbed rather than
// mounted: the controller only reads `isConnected` and `isLoading`.
function webview(options: { connected?: boolean; loading?: boolean } = {}): Webview {
  return {
    isConnected: options.connected !== false,
    isLoading: () => options.loading === true,
  } as unknown as Webview;
}

const selection: BrowserElementSelection = {
  url: "https://example.test/",
  selector: "main > button",
  tag: "button",
  text: "Save",
  outerHTML: "<button>Save</button>",
  computedStyles: { display: "block" },
  boundingRect: { x: 1, y: 2, width: 3, height: 4 },
  parentChain: ["main"],
  children: [],
} as unknown as BrowserElementSelection;

describe("createElementSelectorController", () => {
  beforeEach(() => {
    getDesktopHost.mockReset();
  });

  it("reports loading before the page settles instead of starting a session", () => {
    const begin = vi.fn();
    getDesktopHost.mockReturnValue({ browser: { beginElementSelection: begin } });
    const controller = createElementSelectorController();

    const result = controller.start({
      browserId: "browser-1",
      webview: webview({ loading: true }),
      mode: "annotate",
      onFinish: () => undefined,
    });

    expect(result).toBe("loading");
    expect(begin).not.toHaveBeenCalled();
  });

  it("reports unavailable when the desktop bridge is missing", () => {
    getDesktopHost.mockReturnValue({ browser: {} });
    const controller = createElementSelectorController();

    expect(
      controller.start({
        browserId: "browser-1",
        webview: webview(),
        mode: "annotate",
        onFinish: () => undefined,
      }),
    ).toBe("unavailable");
  });

  it("finishes with the selection the bridge resolves", async () => {
    let resolveSelection: (value: unknown) => void = () => undefined;
    getDesktopHost.mockReturnValue({
      browser: {
        beginElementSelection: vi.fn(
          () =>
            new Promise((resolve) => {
              resolveSelection = resolve;
            }),
        ),
      },
    });
    const controller = createElementSelectorController();
    const outcomes: ElementSelectorOutcome[] = [];

    expect(
      controller.start({
        browserId: "browser-1",
        webview: webview(),
        mode: "screenshot",
        onFinish: (outcome) => outcomes.push(outcome),
      }),
    ).toBe("started");

    resolveSelection({
      status: "selected",
      mode: "screenshot",
      selection,
      screenshotDataUrl: "data:image/png;base64,AAA",
    });
    await vi.waitFor(() => expect(outcomes).toHaveLength(1));

    expect(outcomes[0]).toEqual({
      type: "selected",
      mode: "screenshot",
      selection,
      screenshotDataUrl: "data:image/png;base64,AAA",
    });
  });

  it("cancels the in-flight bridge session when the webview goes away", () => {
    const cancelElementSelection = vi.fn(() => Promise.resolve());
    getDesktopHost.mockReturnValue({
      browser: {
        beginElementSelection: vi.fn(() => new Promise(() => undefined)),
        cancelElementSelection,
      },
    });
    const controller = createElementSelectorController();
    const pane = webview();
    const outcomes: ElementSelectorOutcome[] = [];

    controller.start({
      browserId: "browser-1",
      webview: pane,
      mode: "annotate",
      onFinish: (outcome) => outcomes.push(outcome),
    });
    controller.stopForWebview(pane);

    expect(cancelElementSelection).toHaveBeenCalledWith({
      browserId: "browser-1",
      token: expect.any(String),
      mode: "annotate",
    });
    expect(outcomes).toEqual([{ type: "cancelled" }]);
  });
});
