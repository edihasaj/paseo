import { describe, expect, test } from "vitest";
import type { SidebarWorkspaceEntry } from "@/hooks/use-sidebar-workspaces-list";
import { SIDEBAR_UNLABELLED_LABEL_KEY } from "@/stores/sidebar-view-store";
import {
  filterWorkspacesByLabels,
  labelWorkspaceGroups,
  SIDEBAR_CHATS_GROUP_KEY,
} from "./sidebar-labels";

function workspace(
  workspaceId: string,
  labels: string[],
  pinnedAt: string | null = null,
): SidebarWorkspaceEntry {
  return {
    workspaceKey: `host:${workspaceId}`,
    serverId: "host",
    workspaceId,
    projectViewKey: "project",
    projectName: "Project",
    projectRootPath: "/repo",
    workspaceDirectory: `/repo/${workspaceId}`,
    workspaceDirectoryLabel: workspaceId,
    projectKind: "git",
    workspaceKind: "worktree",
    name: workspaceId,
    title: null,
    pinnedAt,
    labels,
    currentBranch: "main",
    statusBucket: "done",
    statusEnteredAt: null,
    archivingAt: null,
    diffStat: null,
    prHint: null,
    archiveHasUncommittedChanges: null,
    archiveUnpushedCommitCount: null,
    scripts: [],
    hasRunningScripts: false,
  };
}

describe("sidebar label filtering", () => {
  const workspaces = [
    workspace("one", ["Backend", "Urgent"], "2026-01-01"),
    workspace("two", ["Backend"]),
    workspace("three", []),
  ];

  function filtered(labels: string[]) {
    return filterWorkspacesByLabels({ workspaces, labels }).map((entry) => entry.workspaceId);
  }

  test("includes a workspace carrying any selected label", () => {
    expect(filtered([])).toEqual(["one", "two", "three"]);
    expect(filtered(["backend"])).toEqual(["one", "two"]);
    expect(filtered(["backend", "urgent"])).toEqual(["one", "two"]);
  });

  test("models Unlabelled as a row in the same list", () => {
    expect(filtered([SIDEBAR_UNLABELLED_LABEL_KEY])).toEqual(["three"]);
    expect(filtered(["backend", SIDEBAR_UNLABELLED_LABEL_KEY])).toEqual(["one", "two", "three"]);
  });

  test("reads whitespace-only label names as no label rather than as the Unlabelled key", () => {
    expect(
      filterWorkspacesByLabels({
        workspaces: [workspace("blank", ["   "])],
        labels: [SIDEBAR_UNLABELLED_LABEL_KEY],
      }).map((entry) => entry.workspaceId),
    ).toEqual(["blank"]);
  });
});

describe("labelWorkspaceGroups", () => {
  const chatsLabel = "Chats";

  test("puts unlabelled workspaces in the trailing Chats group", () => {
    const groups = labelWorkspaceGroups({
      workspaces: [workspace("one", ["Urgent"]), workspace("loose", [])],
      labelOrder: ["Urgent"],
      chatsLabel,
    });

    expect(groups.map((group) => group.key)).toEqual(["urgent", SIDEBAR_CHATS_GROUP_KEY]);
    expect(groups[0].rows.map((row) => row.workspaceId)).toEqual(["one"]);
    expect(groups[1].rows.map((row) => row.workspaceId)).toEqual(["loose"]);
    expect(groups[1].leading).toEqual({ kind: "chats" });
  });

  // Counts in a header have to match the rows under it, so a workspace carrying several labels
  // lands in exactly one group rather than being repeated under each.
  test("files a multi-labelled workspace under its first label in order", () => {
    const groups = labelWorkspaceGroups({
      workspaces: [workspace("both", ["Backend", "Urgent"])],
      labelOrder: ["Urgent", "Backend"],
      chatsLabel,
    });

    expect(groups[0].rows.map((row) => row.workspaceId)).toEqual(["both"]);
    expect(groups[1].rows).toEqual([]);
    expect(groups.flatMap((group) => group.rows)).toHaveLength(1);
  });

  // The empty label is the drop target that files a chat, and the Chats group is the one that
  // takes it back out; neither may disappear just because it currently holds nothing.
  test("keeps empty label groups and the Chats group rendered", () => {
    const groups = labelWorkspaceGroups({
      workspaces: [],
      labelOrder: ["Urgent"],
      chatsLabel,
    });

    expect(groups.map((group) => group.key)).toEqual(["urgent", SIDEBAR_CHATS_GROUP_KEY]);
    expect(groups.every((group) => group.rows.length === 0)).toBe(true);
  });

  test("matches labels case-insensitively through the label key", () => {
    const groups = labelWorkspaceGroups({
      workspaces: [workspace("shouty", ["URGENT"])],
      labelOrder: ["Urgent"],
      chatsLabel,
    });

    expect(groups[0].rows.map((row) => row.workspaceId)).toEqual(["shouty"]);
  });
});
