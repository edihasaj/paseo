import type { AgentSnapshotPayload } from "@getpaseo/protocol/messages";
import type { normalizeWorkspaceDescriptor } from "@/stores/session-store";

/**
 * Shared by every "New workspace" creation path (directory, worktree, and the directory-less
 * chat source) so `new-workspace-screen.tsx` and `new-chat-workspace.ts` describe the same shape
 * without importing from one another.
 */
export interface WorkspaceCreationResult {
  workspace: ReturnType<typeof normalizeWorkspaceDescriptor>;
  agent?: AgentSnapshotPayload;
}
