import type { AgentAttachment } from "@getpaseo/protocol/messages";

/**
 * The daemon uses `firstAgentContext` to name the workspace (and, for a worktree, its branch)
 * before the initial agent turn has produced anything else to name it from. `undefined` when
 * there is nothing to name from, so callers can omit the field entirely rather than send an
 * empty one.
 */
export function buildFirstAgentContext(input: {
  prompt: string;
  attachments: AgentAttachment[];
}): { prompt?: string; attachments?: AgentAttachment[] } | undefined {
  const trimmedPrompt = input.prompt.trim();
  if (!trimmedPrompt && input.attachments.length === 0) {
    return undefined;
  }

  return {
    ...(trimmedPrompt ? { prompt: trimmedPrompt } : {}),
    attachments: input.attachments,
  };
}
