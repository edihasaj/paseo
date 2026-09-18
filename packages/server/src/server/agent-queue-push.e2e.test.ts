import { afterEach, expect, test } from "vitest";
import { MockLoadTestAgentClient } from "./agent/providers/mock-load-test-agent.js";
import { DaemonClient } from "./test-utils/daemon-client.js";
import { createTestPaseoDaemon, type TestPaseoDaemon } from "./test-utils/paseo-daemon.js";

// Regression test for the demand-driven subscription merge (upstream #4470)
// landing on top of the daemon-owned agent queue (c3dc4b741, a7db050b1,
// cea693e14, f98f067f5). `createAgentQueuePrompt` succeeds and persists, but
// the `agent.queue.update` push must also reach a client that subscribes the
// way `packages/app/src/contexts/session-context.tsx` does.

let daemon: TestPaseoDaemon;

afterEach(async () => {
  await daemon?.close();
});

test("agent.queue.update push reaches a client after createAgentQueuePrompt", async () => {
  daemon = await createTestPaseoDaemon({
    isDev: true,
    agentClients: { mock: new MockLoadTestAgentClient() },
  });

  const client = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    appVersion: "0.8.0",
  });
  await client.connect();
  await client.fetchAgents({ subscribe: {} });

  // Mirror session-context.tsx: subscribe to the explicit event categories
  // the app cares about, including "agent.queue.update".
  client.observeEvents([
    "agent_attention_required",
    "terminal_attention_required",
    "agent_permission_request",
    "agent_permission_resolved",
    "agent.provider_subagents.update",
    "agent.queue.update",
    "checkout_status_update",
    "workspace_setup_progress",
    "status.server_info",
  ]);

  const agent = await client.createAgent({
    provider: "mock",
    cwd: "/tmp",
    title: "Queue push repro",
    model: "ten-second-stream",
  });
  await client.sendMessage(agent.id, "Start a long turn");
  await client.waitForAgentUpsert(agent.id, (a) => a.status === "running", 15_000);

  const pushReceived = new Promise<{ agentId: string; prompts: unknown[] }>((resolve) => {
    client.on("agent.queue.update", (message) => {
      resolve(message.payload);
    });
  });

  const created = await client.createAgentQueuePrompt({
    agentId: agent.id,
    text: "Queued while running",
  });

  const push = await Promise.race([
    pushReceived,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timed out waiting for agent.queue.update push")), 5_000),
    ),
  ]);

  expect(push.agentId).toBe(agent.id);
  expect(push.prompts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: created.prompt?.id, text: "Queued while running" }),
    ]),
  );

  await client.close();
});

test("an unavailable steer never interrupts the turn and is delivered once it ends", async () => {
  daemon = await createTestPaseoDaemon({
    isDev: true,
    agentClients: { mock: new MockLoadTestAgentClient() },
  });

  const client = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    appVersion: "0.8.0",
  });
  await client.connect();
  await client.fetchAgents({ subscribe: {} });

  const agent = await client.createAgent({
    provider: "mock",
    cwd: "/tmp",
    title: "Steer queue fallback repro",
    model: "e2e-fast-stream",
    featureValues: { mockSteerUnavailableCount: 1 },
  });
  await client.sendMessage(agent.id, "Start a turn that cannot be steered.");
  await client.waitForAgentUpsert(agent.id, (a) => a.status === "running", 15_000);

  const result = await client.sendAgentMessage(agent.id, "steer me", {
    activeTurnBehavior: "steer",
  });
  expect(result.dispatch).toBe("queued_fallback");

  // The original turn is still the one running — an unavailable steer must never
  // interrupt it. If it had been interrupted, the agent would already be back to
  // "running" on a brand new turn well before the original 2s stream finishes.
  const stillRunning = await client.fetchAgent({ agentId: agent.id });
  expect(stillRunning.agent.status).toBe("running");

  const queue = await client.listAgentQueue(agent.id);
  expect(queue.prompts).toEqual(
    expect.arrayContaining([expect.objectContaining({ text: "steer me" })]),
  );

  await client.waitForFinish(agent.id, 15_000);

  // The queue drains on the idle transition, which starts a second turn with the
  // queued text — proof of delivery, not just retention.
  await client.waitForAgentUpsert(agent.id, (a) => a.status === "running", 15_000);
  const drainedQueue = await client.listAgentQueue(agent.id);
  expect(drainedQueue.prompts).toEqual([]);

  await client.close();
});
