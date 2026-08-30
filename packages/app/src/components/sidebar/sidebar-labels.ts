import { workspaceLabelKey } from "@getpaseo/protocol/workspace-labels";
import type { SidebarWorkspaceEntry } from "@/hooks/use-sidebar-workspaces-list";
import { SIDEBAR_UNLABELLED_LABEL_KEY, type SidebarLabelFilter } from "@/stores/sidebar-view-store";
import type { StatusBucket, StatusGroup } from "@/hooks/sidebar-status-view-model";

export interface SidebarWorkspaceGroup {
  key: string;
  label: string;
  rows: SidebarWorkspaceEntry[];
  leading:
    | { kind: "status"; bucket: StatusBucket }
    /** A label group in label mode; `name` is the raw label a drop assigns. */
    | { kind: "label"; name: string }
    /** The trailing bucket for workspaces carrying no label. */
    | { kind: "chats" };
}

/**
 * The key of the trailing group holding every workspace with no label.
 *
 * Distinct from `SIDEBAR_UNLABELLED_LABEL_KEY` (the empty string the Labels *filter* uses):
 * a group key ends up in collapse state and drag payloads, where an empty string reads as
 * "absent" at every call site that guards on truthiness.
 */
export const SIDEBAR_CHATS_GROUP_KEY = "sidebar-chats";

export function statusWorkspaceGroups(groups: readonly StatusGroup[]): SidebarWorkspaceGroup[] {
  return groups.map((group) => ({
    key: group.bucket,
    label: group.label,
    rows: group.rows,
    leading: { kind: "status", bucket: group.bucket },
  }));
}

/**
 * Applies the Labels page's selection to the sidebar.
 *
 * `Unlabelled` is a row like any other, so it is a key in the same list rather than a boolean
 * beside it; the only thing that makes it special is what the key asks of a workspace.
 * Selecting several labels includes workspaces carrying any of them.
 */
export function filterWorkspacesByLabels(
  input: { workspaces: readonly SidebarWorkspaceEntry[] } & SidebarLabelFilter,
): SidebarWorkspaceEntry[] {
  const { workspaces, labels } = input;
  if (labels.length === 0) return [...workspaces];
  return workspaces.filter((workspace) => {
    // Whitespace-only names normalize away, so `size === 0` is exactly "carries no real label"
    // and the empty key can only ever mean Unlabelled.
    const keys = new Set((workspace.labels ?? []).map(workspaceLabelKey).filter(Boolean));
    const matches = (key: string) =>
      key === SIDEBAR_UNLABELLED_LABEL_KEY ? keys.size === 0 : keys.has(key);
    return labels.some(matches);
  });
}

/**
 * Groups workspaces by label, with everything unlabelled falling into a trailing "Chats" group.
 *
 * A workspace can carry several labels but appears exactly once, under the first label in
 * `labelOrder` that it carries. Fanning a row out across every label it holds would make the
 * counts in the headers disagree with the number of rows on screen, and would give a drag two
 * possible sources for the same workspace.
 */
export function labelWorkspaceGroups(input: {
  workspaces: readonly SidebarWorkspaceEntry[];
  labelOrder: readonly string[];
  chatsLabel: string;
}): SidebarWorkspaceGroup[] {
  const { workspaces, labelOrder, chatsLabel } = input;
  const rowsByLabelKey = new Map<string, SidebarWorkspaceEntry[]>();
  const orderedKeys = labelOrder.map((name) => workspaceLabelKey(name));
  const unlabelled: SidebarWorkspaceEntry[] = [];

  for (const workspace of workspaces) {
    const carried = new Set((workspace.labels ?? []).map((label) => workspaceLabelKey(label)));
    const owningKey = orderedKeys.find((key) => carried.has(key));
    if (!owningKey) {
      unlabelled.push(workspace);
      continue;
    }
    const existing = rowsByLabelKey.get(owningKey);
    if (existing) existing.push(workspace);
    else rowsByLabelKey.set(owningKey, [workspace]);
  }

  const groups: SidebarWorkspaceGroup[] = labelOrder.map((name, index) => ({
    key: orderedKeys[index],
    label: name,
    rows: rowsByLabelKey.get(orderedKeys[index]) ?? [],
    leading: { kind: "label", name },
  }));

  // The Chats group is always rendered, even empty: it is the drop target that takes a workspace
  // back out of a label, so it cannot vanish at the moment it is needed.
  groups.push({
    key: SIDEBAR_CHATS_GROUP_KEY,
    label: chatsLabel,
    rows: unlabelled,
    leading: { kind: "chats" },
  });
  return groups;
}
