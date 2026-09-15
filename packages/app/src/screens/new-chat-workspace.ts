import type {
  CreateWorkspaceRequestOptions,
  DaemonClient,
} from "@getpaseo/client/internal/daemon-client";
import type { AgentAttachment, CreationSnapshot } from "@getpaseo/protocol/messages";
import { normalizeWorkspaceDescriptor } from "@/stores/session-store";
import type { WorkspaceCreationResult } from "./new-workspace/creation-result";
import { buildFirstAgentContext } from "./new-workspace/first-agent-context";

/**
 * A chat has no directory of its own, so the daemon assigns the initial agent's `cwd` to the
 * scratch directory it provisions during creation — the client cannot predict that path in
 * advance. This placeholder only needs to satisfy the client's non-empty `cwd` requirement; the
 * server overrides it for a `source: { kind: "chat" }` workspace regardless of its value.
 */
export const CHAT_SOURCE_AGENT_CWD_PLACEHOLDER = ".";

/**
 * Creates the scratch-directory workspace behind a blank chat draft, deferred until the first
 * prompt is submitted. Mirrors `createMultiplicityWorkspace`'s directory/worktree creation shape
 * so `runCreateChatAgent` in `new-workspace-screen.tsx` can call either one through the same
 * `ensureWorkspace` seam.
 */
export async function createChatSourceWorkspace(input: {
  idempotencyKey: string;
  client: Pick<DaemonClient, "createWorkspace">;
  withInitialAgent: boolean;
  agent?: CreateWorkspaceRequestOptions["agent"];
  onEvent?: (snapshot: CreationSnapshot) => void;
  prompt: string;
  attachments: AgentAttachment[];
  mergeWorkspaces: (
    serverId: string,
    workspaces: ReturnType<typeof normalizeWorkspaceDescriptor>[],
  ) => void;
  serverId: string;
  createFailedMessage: string;
}): Promise<WorkspaceCreationResult> {
  const firstAgentContext = buildFirstAgentContext({
    prompt: input.prompt,
    attachments: input.attachments,
  });
  const payload = await input.client.createWorkspace({
    idempotencyKey: input.idempotencyKey,
    agent: input.agent,
    onEvent: input.onEvent,
    source: { kind: "chat" },
    ...(firstAgentContext ? { firstAgentContext } : {}),
  });
  if (payload.error || !payload.workspace) {
    throw new Error(payload.error ?? input.createFailedMessage);
  }
  const normalizedWorkspace = normalizeWorkspaceDescriptor(payload.workspace);
  const workspaceForInitialMerge = input.withInitialAgent
    ? { ...normalizedWorkspace, status: "running" as const, statusEnteredAt: new Date() }
    : normalizedWorkspace;
  input.mergeWorkspaces(input.serverId, [workspaceForInitialMerge]);
  return { workspace: normalizedWorkspace, agent: payload.agent };
}
