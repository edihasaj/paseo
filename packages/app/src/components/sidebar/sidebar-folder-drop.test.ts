import { describe, expect, test } from "vitest";
import { planFolderDrop } from "./sidebar-folder-drop";
import { SIDEBAR_CHATS_GROUP_KEY } from "./sidebar-labels";

const labelOrder = ["Urgent", "Backend"];

describe("planFolderDrop", () => {
  test("files an unlabelled chat into a folder", () => {
    expect(
      planFolderDrop({
        workspaceLabels: [],
        sourceGroupKey: SIDEBAR_CHATS_GROUP_KEY,
        targetGroupKey: "urgent",
        labelOrder,
      }),
    ).toEqual([{ label: "Urgent", assigned: true }]);
  });

  // Without the removal the row would show under both folders and the source group's count
  // would still include it.
  test("moves between folders by dropping the owning label and adding the new one", () => {
    expect(
      planFolderDrop({
        workspaceLabels: ["Urgent"],
        sourceGroupKey: "urgent",
        targetGroupKey: "backend",
        labelOrder,
      }),
    ).toEqual([
      { label: "Urgent", assigned: false },
      { label: "Backend", assigned: true },
    ]);
  });

  test("unfiles a workspace dropped on Chats", () => {
    expect(
      planFolderDrop({
        workspaceLabels: ["Urgent"],
        sourceGroupKey: "urgent",
        targetGroupKey: SIDEBAR_CHATS_GROUP_KEY,
        labelOrder,
      }),
    ).toEqual([{ label: "Urgent", assigned: false }]);
  });

  // Labels a person applied for their own reasons are not this gesture's to remove.
  test("leaves labels other than the owning one alone", () => {
    expect(
      planFolderDrop({
        workspaceLabels: ["Urgent", "Flaky"],
        sourceGroupKey: "urgent",
        targetGroupKey: "backend",
        labelOrder,
      }),
    ).toEqual([
      { label: "Urgent", assigned: false },
      { label: "Backend", assigned: true },
    ]);
  });

  test("does nothing when the row is dropped on the group it came from", () => {
    expect(
      planFolderDrop({
        workspaceLabels: ["Urgent"],
        sourceGroupKey: "urgent",
        targetGroupKey: "urgent",
        labelOrder,
      }),
    ).toEqual([]);
  });

  test("does not strip the current label when the target folder has gone away", () => {
    expect(
      planFolderDrop({
        workspaceLabels: ["Urgent"],
        sourceGroupKey: "urgent",
        targetGroupKey: "deleted-folder",
        labelOrder,
      }),
    ).toEqual([]);
  });

  test("adds nothing when the workspace already carries the target label", () => {
    expect(
      planFolderDrop({
        workspaceLabels: ["Backend"],
        sourceGroupKey: SIDEBAR_CHATS_GROUP_KEY,
        targetGroupKey: "backend",
        labelOrder,
      }),
    ).toEqual([]);
  });
});
