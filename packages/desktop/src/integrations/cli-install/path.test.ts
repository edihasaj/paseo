import { describe, expect, it } from "vitest";
import { resolveCliInstallSourcePath } from "./path";

describe("cli-install-path", () => {
  it("uses the bundled shim for packaged macOS installs", () => {
    expect(
      resolveCliInstallSourcePath({
        platform: "darwin",
        isPackaged: true,
        executablePath: "/Applications/Stroll.app/Contents/MacOS/Stroll",
        shimPath: "/Applications/Stroll.app/Contents/Resources/bin/stroll",
      }),
    ).toBe("/Applications/Stroll.app/Contents/Resources/bin/stroll");
  });

  it("prefers the original AppImage path on linux", () => {
    expect(
      resolveCliInstallSourcePath({
        platform: "linux",
        isPackaged: true,
        executablePath: "/tmp/.mount_stroll123/Stroll",
        shimPath: "/tmp/.mount_stroll123/resources/bin/stroll",
        appImagePath: "/home/user/Applications/Stroll.AppImage",
      }),
    ).toBe("/home/user/Applications/Stroll.AppImage");
  });

  it("falls back to the shim on windows and in development", () => {
    expect(
      resolveCliInstallSourcePath({
        platform: "win32",
        isPackaged: true,
        executablePath: "C:\\Users\\user\\AppData\\Local\\Programs\\Stroll\\Stroll.exe",
        shimPath: "C:\\Users\\user\\AppData\\Local\\Programs\\Stroll\\resources\\bin\\stroll.cmd",
      }),
    ).toBe("C:\\Users\\user\\AppData\\Local\\Programs\\Stroll\\resources\\bin\\stroll.cmd");

    expect(
      resolveCliInstallSourcePath({
        platform: "linux",
        isPackaged: false,
        executablePath: "/opt/Stroll/Stroll",
        shimPath: "/opt/Stroll/resources/bin/stroll",
      }),
    ).toBe("/opt/Stroll/resources/bin/stroll");
  });
});
