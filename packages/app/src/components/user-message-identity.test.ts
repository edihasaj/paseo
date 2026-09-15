import { describe, expect, it } from "vitest";
import { resolveUserMessageAvatarColorName } from "./user-message-identity";

describe("resolveUserMessageAvatarColorName", () => {
  it("returns null when there is no host badge", () => {
    expect(resolveUserMessageAvatarColorName(null)).toBeNull();
  });

  it("uses the host's chosen color", () => {
    expect(
      resolveUserMessageAvatarColorName({
        serverId: "host-1",
        label: "Laptop",
        color: "sky",
        showLabel: true,
      }),
    ).toBe("sky");
  });

  it("derives a stable color from the server id when the host has not picked one", () => {
    const badge = { serverId: "host-1", label: "Laptop", color: "none" as const, showLabel: true };

    const first = resolveUserMessageAvatarColorName(badge);
    const second = resolveUserMessageAvatarColorName(badge);

    expect(first).not.toBeNull();
    expect(first).toBe(second);
  });
});
