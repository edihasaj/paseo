import { describe, expect, it } from "vitest";
import {
  AgentListItemPayloadSchema,
  AgentSnapshotPayloadSchema,
  CreateAgentRequestMessageSchema,
} from "./messages.js";

const capabilities = {
  supportsStreaming: true,
  supportsSessionPersistence: true,
  supportsDynamicModes: true,
  supportsMcpServers: true,
  supportsReasoningStream: true,
  supportsToolInvocations: true,
};

describe("provider account message fields", () => {
  it("accepts explicit managed and system account choices on agent creation", () => {
    const base = {
      type: "create_agent_request" as const,
      workspaceId: "ws-1",
      attachments: [],
      labels: {},
      requestId: "req-1",
    };

    expect(
      CreateAgentRequestMessageSchema.parse({
        ...base,
        config: {
          provider: "codex",
          cwd: "/repo",
          accountProfileId: "pac_0123456789abcdef",
        },
      }).config.accountProfileId,
    ).toBe("pac_0123456789abcdef");
    expect(
      CreateAgentRequestMessageSchema.parse({
        ...base,
        config: { provider: "codex", cwd: "/repo", accountProfileId: null },
      }).config.accountProfileId,
    ).toBeNull();
  });

  it("projects the pinned account on snapshot and list rows", () => {
    const snapshot = AgentSnapshotPayloadSchema.parse({
      id: "agent-1",
      provider: "codex",
      accountProfileId: "pac_0123456789abcdef",
      cwd: "/repo",
      model: null,
      createdAt: "2026-08-23T00:00:00.000Z",
      updatedAt: "2026-08-23T00:00:00.000Z",
      lastUserMessageAt: null,
      status: "idle",
      capabilities,
      currentModeId: null,
      availableModes: [],
      pendingPermissions: [],
      persistence: null,
      title: null,
      labels: {},
    });
    const listItem = AgentListItemPayloadSchema.parse({
      id: snapshot.id,
      shortId: "agent-1",
      title: null,
      provider: snapshot.provider,
      accountProfileId: snapshot.accountProfileId,
      model: null,
      status: "idle",
      cwd: snapshot.cwd,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
      lastUserMessageAt: null,
      labels: {},
    });

    expect(snapshot.accountProfileId).toBe("pac_0123456789abcdef");
    expect(listItem.accountProfileId).toBe(snapshot.accountProfileId);
  });
});
