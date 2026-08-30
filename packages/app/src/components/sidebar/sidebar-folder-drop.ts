import { workspaceLabelKey } from "@getpaseo/protocol/workspace-labels";
import { SIDEBAR_CHATS_GROUP_KEY } from "./sidebar-labels";

/** One `workspace.label.assignment.set` call: which label, and whether it ends up carried. */
export interface SidebarLabelMutation {
  label: string;
  assigned: boolean;
}

/**
 * Works out the label changes that file a workspace into a folder, or back into Chats.
 *
 * Filing has to remove the label the row was showing under as well as add the new one, or the
 * row would sit in two folders at once and the group it was dragged out of would still list it.
 * Only the owning label is dropped: any other label the workspace carries is someone else's
 * classification and is none of this gesture's business.
 */
export function planFolderDrop(input: {
  workspaceLabels: readonly string[];
  /** The group the row is currently rendered under; `null` when dragged from Chats. */
  sourceGroupKey: string | null;
  /** The group being dropped on — `SIDEBAR_CHATS_GROUP_KEY` unfiles the row. */
  targetGroupKey: string;
  /** Display order of folders, used to resolve the label a target group key stands for. */
  labelOrder: readonly string[];
}): SidebarLabelMutation[] {
  const { workspaceLabels, sourceGroupKey, targetGroupKey, labelOrder } = input;
  if (sourceGroupKey === targetGroupKey) return [];

  const targetLabel =
    targetGroupKey === SIDEBAR_CHATS_GROUP_KEY
      ? null
      : (labelOrder.find((name) => workspaceLabelKey(name) === targetGroupKey) ?? null);
  // A folder key with no label behind it means the catalog moved under the drag; doing nothing
  // is better than stripping the row's current label on the way to a folder that is not there.
  if (targetGroupKey !== SIDEBAR_CHATS_GROUP_KEY && !targetLabel) return [];

  const mutations: SidebarLabelMutation[] = [];
  const owning = workspaceLabels.find(
    (label) => sourceGroupKey !== null && workspaceLabelKey(label) === sourceGroupKey,
  );
  if (owning) {
    mutations.push({ label: owning, assigned: false });
  }
  if (
    targetLabel &&
    !workspaceLabels.some((label) => workspaceLabelKey(label) === targetGroupKey)
  ) {
    mutations.push({ label: targetLabel, assigned: true });
  }
  return mutations;
}
