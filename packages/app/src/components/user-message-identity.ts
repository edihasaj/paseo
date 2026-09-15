import type { HostBadgeModel } from "@/hosts/appearance";
import { deriveIdentityColorName, type IdentityColorName } from "@/styles/identity-colors";

/**
 * Avatar fill for a user message's sender identity row. Falls back to a
 * hash-derived color when the host has not picked one.
 */
export function resolveUserMessageAvatarColorName(
  hostBadge: HostBadgeModel | null,
): IdentityColorName | null {
  if (!hostBadge) {
    return null;
  }
  if (hostBadge.color === "none") {
    return deriveIdentityColorName(hostBadge.serverId);
  }
  return hostBadge.color;
}
