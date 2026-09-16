import type { Page, WebSocketRoute } from "@playwright/test";
import { daemonWsRoutePattern } from "./daemon-port";

type WebSocketMessage = string | Buffer;

/**
 * A regular send goes out as `send_agent_message_request`. Sending a queued
 * prompt now goes out as the daemon-owned queue's own `agent.queue.send_now.
 * request` (packages/client/src/daemon-client.ts) — a different RPC, not a
 * client-side replay of the same request. Both are the wire signal that a
 * "send it now" click actually left the client, so both are held.
 */
const HELD_REQUEST_TYPES = ["send_agent_message_request", "agent.queue.send_now.request"] as const;

interface SendAgentMessageRequest {
  type: (typeof HELD_REQUEST_TYPES)[number];
  requestId: string;
  agentId: string;
  /** Only present on send_agent_message_request; absent when the client sends into an idle agent. */
  activeTurnBehavior?: string;
}

function readSendRequest(message: WebSocketMessage): SendAgentMessageRequest | null {
  if (typeof message !== "string") return null;
  try {
    const envelope = JSON.parse(message) as {
      type?: unknown;
      message?: Record<string, unknown>;
    };
    const request = envelope.type === "session" ? envelope.message : null;
    if (
      typeof request?.type !== "string" ||
      !(HELD_REQUEST_TYPES as readonly string[]).includes(request.type) ||
      typeof request.requestId !== "string" ||
      typeof request.agentId !== "string"
    ) {
      return null;
    }
    return {
      type: request.type as (typeof HELD_REQUEST_TYPES)[number],
      requestId: request.requestId,
      agentId: request.agentId,
      activeTurnBehavior:
        typeof request.activeTurnBehavior === "string" ? request.activeTurnBehavior : undefined,
    };
  } catch {
    return null;
  }
}

export async function gateNextAgentMessage(page: Page) {
  let serverSocket: WebSocketRoute | null = null;
  let browserSocket: WebSocketRoute | null = null;
  const heldMessages: Array<WebSocketMessage | null> = [];
  const requests: SendAgentMessageRequest[] = [];
  const requestWaiters = new Set<() => void>();

  await page.routeWebSocket(daemonWsRoutePattern(), (ws) => {
    browserSocket = ws;
    const server = ws.connectToServer();
    serverSocket = server;

    ws.onMessage((message) => {
      const request = readSendRequest(message);
      if (request) {
        heldMessages.push(message);
        requests.push(request);
        for (const resolve of requestWaiters) resolve();
        requestWaiters.clear();
        return;
      }
      server.send(message);
    });

    server.onMessage((message) => ws.send(message));
  });

  const waitForRequest = async (count = 1): Promise<SendAgentMessageRequest> => {
    while (requests.length < count) {
      await new Promise<void>((resolve) => requestWaiters.add(resolve));
    }
    return requests[count - 1];
  };

  return {
    waitForRequest,
    accept(index = 0) {
      const heldMessage = heldMessages[index];
      if (!serverSocket || !heldMessage) {
        throw new Error("No held send-agent-message request to accept");
      }
      serverSocket.send(heldMessage);
      heldMessages[index] = null;
    },
    async disconnect(): Promise<void> {
      if (!browserSocket) throw new Error("No browser daemon socket to disconnect");
      await browserSocket.close({ code: 1008, reason: "Dropped by submission test." });
    },
  };
}
