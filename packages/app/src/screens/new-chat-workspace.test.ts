import { describe, expect, it, vi } from "vitest";
import type { WorkspaceDescriptorPayload } from "@getpaseo/protocol/messages";
import { createChatWorkspace } from "./new-chat-workspace";

function workspace(): WorkspaceDescriptorPayload {
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

describe("createChatWorkspace", () => {
  it("creates the chat from its first message so naming runs before navigation", async () => {
    const createWorkspace = vi.fn().mockResolvedValue({
      workspace: workspace(),
      setupTerminalId: null,
      error: null,
    });
    const mergeWorkspaces = vi.fn();

    const created = await createChatWorkspace({
      client: { createWorkspace },
      serverId: "server-1",
      prompt: "  Investigate the flaky build  ",
      attachments: [],
      mergeWorkspaces,
      createFailedMessage: "Could not start a chat.",
    });

    expect(createWorkspace).toHaveBeenCalledWith({
      source: { kind: "chat" },
      firstAgentContext: {
        prompt: "Investigate the flaky build",
        attachments: [],
      },
    });
    expect(created.id).toBe("chat-1");
    expect(mergeWorkspaces).toHaveBeenCalledWith("server-1", [
      expect.objectContaining({ id: "chat-1", status: "running" }),
    ]);
  });

  it("reports a daemon creation error", async () => {
    const createWorkspace = vi.fn().mockResolvedValue({
      workspace: null,
      setupTerminalId: null,
      error: "chat storage is unavailable",
    });

    await expect(
      createChatWorkspace({
        client: { createWorkspace },
        serverId: "server-1",
        prompt: "Hello",
        attachments: [],
        mergeWorkspaces: vi.fn(),
        createFailedMessage: "Could not start a chat.",
      }),
    ).rejects.toThrow("chat storage is unavailable");
  });
});
