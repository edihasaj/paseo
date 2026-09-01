import type { Page } from "@playwright/test";

/** Waits for the real host connection and its server-info handshake. */
export async function waitForHostSessionReady(page: Page, serverId: string): Promise<void> {
  await page.waitForFunction(
    (expectedServerId) => {
      const runtime = Reflect.get(globalThis, "__paseoHostRuntimeStore") as
        | {
            getSnapshot?: (id: string) => {
              connectionStatus?: string;
              client?: {
                getLastServerInfoMessage?: () => { serverId?: string } | null;
              } | null;
            } | null;
          }
        | undefined;
      const snapshot = runtime?.getSnapshot?.(expectedServerId);
      const serverInfo = snapshot?.client?.getLastServerInfoMessage?.();
      return snapshot?.connectionStatus === "online" && serverInfo?.serverId === expectedServerId;
    },
    serverId,
    { timeout: 30_000 },
  );
}
