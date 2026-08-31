import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import type { AgentAttachment } from "@getpaseo/protocol/messages";
import { normalizeWorkspaceDescriptor } from "@/stores/session-store";

type NormalizedWorkspace = ReturnType<typeof normalizeWorkspaceDescriptor>;

export async function createChatWorkspace(input: {
  client: Pick<DaemonClient, "createWorkspace">;
  serverId: string;
  prompt: string;
  attachments: AgentAttachment[];
  mergeWorkspaces: (serverId: string, workspaces: NormalizedWorkspace[]) => void;
  createFailedMessage: string;
}): Promise<NormalizedWorkspace> {
  const trimmedPrompt = input.prompt.trim();
  const payload = await input.client.createWorkspace({
    source: { kind: "chat" },
    firstAgentContext: {
      ...(trimmedPrompt ? { prompt: trimmedPrompt } : {}),
      attachments: input.attachments,
    },
  });
  if (payload.error || !payload.workspace) {
    throw new Error(payload.error ?? input.createFailedMessage);
  }

  const workspace = normalizeWorkspaceDescriptor(payload.workspace);
  input.mergeWorkspaces(input.serverId, [
    { ...workspace, status: "running", statusEnteredAt: new Date() },
  ]);
  return workspace;
}
