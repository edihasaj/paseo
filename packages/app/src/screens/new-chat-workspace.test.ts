import { describe, expect, it, vi } from "vitest";
import type { AgentSnapshotPayload, WorkspaceDescriptorPayload } from "@getpaseo/protocol/messages";
import { CHAT_SOURCE_AGENT_CWD_PLACEHOLDER, createChatSourceWorkspace } from "./new-chat-workspace";

function chatWorkspacePayload(): WorkspaceDescriptorPayload {
  return {
    id: "chat-1",
    projectId: "chat-project",
    projectDisplayName: "Chats",
    projectRootPath: "/daemon/chats",
    workspaceDirectory: "/daemon/chats/chat-1",
    projectKind: "directory",
    workspaceKind: "local_checkout",
    name: "chat-1",
    status: "done",
    statusEnteredAt: null,
    activityAt: null,
    archivingAt: null,
    diffStat: null,
    scripts: [],
  };
}

function chatAgentSnapshot(): AgentSnapshotPayload {
  return {
    id: "agent-1",
    provider: "codex",
    cwd: "/daemon/chats/chat-1",
    model: null,
    createdAt: "2026-09-15T00:00:00.000Z",
    updatedAt: "2026-09-15T00:00:00.000Z",
    lastUserMessageAt: null,
    status: "running",
    capabilities: {
      supportsStreaming: true,
      supportsSessionPersistence: true,
      supportsDynamicModes: false,
      supportsMcpServers: false,
      supportsReasoningStream: false,
      supportsToolInvocations: false,
    },
    currentModeId: null,
    availableModes: [],
    pendingPermissions: [],
    persistence: null,
    title: null,
    labels: {},
  };
}

describe("createChatSourceWorkspace", () => {
  it("creates the chat from its first message, carrying the initial agent and its naming context", async () => {
    const createWorkspace = vi.fn().mockResolvedValue({
      workspace: chatWorkspacePayload(),
      agent: chatAgentSnapshot(),
      setupTerminalId: null,
      error: null,
    });
    const mergeWorkspaces = vi.fn();

    const result = await createChatSourceWorkspace({
      idempotencyKey: "draft-1",
      client: { createWorkspace },
      withInitialAgent: true,
      agent: {
        config: { provider: "codex", cwd: CHAT_SOURCE_AGENT_CWD_PLACEHOLDER },
        initialPrompt: "Investigate the flaky build",
        clientMessageId: "draft-1:initial-message",
      },
      prompt: "  Investigate the flaky build  ",
      attachments: [],
      mergeWorkspaces,
      serverId: "server-1",
      createFailedMessage: "Could not start a chat.",
    });

    expect(createWorkspace).toHaveBeenCalledWith({
      idempotencyKey: "draft-1",
      agent: {
        config: { provider: "codex", cwd: CHAT_SOURCE_AGENT_CWD_PLACEHOLDER },
        initialPrompt: "Investigate the flaky build",
        clientMessageId: "draft-1:initial-message",
      },
      onEvent: undefined,
      source: { kind: "chat" },
      firstAgentContext: {
        prompt: "Investigate the flaky build",
        attachments: [],
      },
    });
    expect(result.workspace.id).toBe("chat-1");
    expect(result.agent?.id).toBe("agent-1");
    expect(mergeWorkspaces).toHaveBeenCalledWith("server-1", [
      expect.objectContaining({ id: "chat-1", status: "running" }),
    ]);
  });

  it("omits firstAgentContext when there is no prompt or attachment to name from", async () => {
    const createWorkspace = vi.fn().mockResolvedValue({
      workspace: chatWorkspacePayload(),
      agent: chatAgentSnapshot(),
      setupTerminalId: null,
      error: null,
    });

    await createChatSourceWorkspace({
      idempotencyKey: "draft-1",
      client: { createWorkspace },
      withInitialAgent: true,
      prompt: "   ",
      attachments: [],
      mergeWorkspaces: vi.fn(),
      serverId: "server-1",
      createFailedMessage: "Could not start a chat.",
    });

    expect(createWorkspace).toHaveBeenCalledWith(
      expect.not.objectContaining({ firstAgentContext: expect.anything() }),
    );
  });

  it("reports a daemon creation error and does not merge a workspace", async () => {
    const createWorkspace = vi.fn().mockResolvedValue({
      workspace: null,
      setupTerminalId: null,
      error: "chat storage is unavailable",
    });
    const mergeWorkspaces = vi.fn();

    await expect(
      createChatSourceWorkspace({
        idempotencyKey: "draft-1",
        client: { createWorkspace },
        withInitialAgent: true,
        prompt: "Hello",
        attachments: [],
        mergeWorkspaces,
        serverId: "server-1",
        createFailedMessage: "Could not start a chat.",
      }),
    ).rejects.toThrow("chat storage is unavailable");
    expect(mergeWorkspaces).not.toHaveBeenCalled();
  });
});
