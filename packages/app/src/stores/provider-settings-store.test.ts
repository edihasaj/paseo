import { afterEach, describe, expect, it } from "vitest";
import { useProviderSettingsStore } from "./provider-settings-store";

describe("provider settings store", () => {
  afterEach(() => {
    useProviderSettingsStore.setState({
      serverId: null,
      provider: null,
      overlayParentLayer: 0,
      restoreFocusRef: undefined,
      visible: false,
    });
  });

  it("carries the opener layer without leaking it into later base-level opens", () => {
    useProviderSettingsStore.getState().open({
      serverId: "server-1",
      provider: "codex",
      overlayParentLayer: 30,
    });
    expect(useProviderSettingsStore.getState().overlayParentLayer).toBe(30);

    useProviderSettingsStore.getState().open({
      serverId: "server-1",
      provider: "claude",
    });
    expect(useProviderSettingsStore.getState().overlayParentLayer).toBe(0);
  });

  it("carries an explicit focus owner without leaking it into later opens", () => {
    const restoreFocusRef = { current: {} };
    useProviderSettingsStore.getState().open({
      serverId: "server-1",
      provider: "codex",
      restoreFocusRef,
    });
    expect(useProviderSettingsStore.getState().restoreFocusRef).toBe(restoreFocusRef);

    useProviderSettingsStore.getState().open({
      serverId: "server-1",
      provider: "claude",
    });
    expect(useProviderSettingsStore.getState().restoreFocusRef).toBeUndefined();
  });
});
