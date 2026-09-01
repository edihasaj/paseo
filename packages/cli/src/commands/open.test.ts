import { describe, expect, it } from "vitest";
import { desktopAppCandidates } from "./open.js";

describe("desktop app discovery", () => {
  it("finds the published macOS application bundle", () => {
    expect(
      desktopAppCandidates({
        platform: "darwin",
        homeDirectory: "/Users/tester",
      }),
    ).toEqual(["/Applications/Stroll.app", "/Users/tester/Applications/Stroll.app"]);
  });

  it("finds published Linux installations", () => {
    expect(
      desktopAppCandidates({
        platform: "linux",
        homeDirectory: "/home/tester",
      }),
    ).toEqual([
      "/usr/bin/Stroll",
      "/opt/Stroll/Stroll",
      "/home/tester/Applications/Stroll.AppImage",
    ]);
  });

  it("finds the per-user Windows installation", () => {
    expect(
      desktopAppCandidates({
        platform: "win32",
        homeDirectory: "C:\\Users\\tester",
        localAppData: "C:\\Users\\tester\\AppData\\Local",
      }),
    ).toEqual(["C:\\Users\\tester\\AppData\\Local\\Programs\\Stroll\\Stroll.exe"]);
  });
});
