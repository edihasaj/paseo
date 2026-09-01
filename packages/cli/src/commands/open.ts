import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { spawnProcess } from "@getpaseo/server";
import { buildAgentDeepLink, type AgentDeepLinkTarget } from "@getpaseo/protocol/agent-deep-link";

interface DesktopAppCandidateInput {
  platform: NodeJS.Platform;
  homeDirectory: string;
  localAppData?: string;
}

export function desktopAppCandidates(input: DesktopAppCandidateInput): string[] {
  if (input.platform === "darwin") {
    return [
      "/Applications/Stroll.app",
      path.posix.join(input.homeDirectory, "Applications", "Stroll.app"),
    ];
  }

  if (input.platform === "linux") {
    return [
      "/usr/bin/Stroll",
      "/opt/Stroll/Stroll",
      path.posix.join(input.homeDirectory, "Applications", "Stroll.AppImage"),
    ];
  }

  if (input.platform === "win32" && input.localAppData) {
    return [path.win32.join(input.localAppData, "Programs", "Stroll", "Stroll.exe")];
  }

  return [];
}

function findDesktopApp(): string | null {
  const candidates = desktopAppCandidates({
    platform: process.platform,
    homeDirectory: homedir(),
    ...(process.env.LOCALAPPDATA ? { localAppData: process.env.LOCALAPPDATA } : {}),
  });

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function cleanEnvForDesktopLaunch(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  // The CLI runs via ELECTRON_RUN_AS_NODE=1. On Linux/Windows the spawned
  // desktop process inherits the env directly, so we must strip it or the
  // desktop app would start as a bare Node process instead of Electron.
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_NO_ATTACH_CONSOLE;
  delete env.PASEO_NODE_ENV;
  return env;
}

function spawnDetached(command: string, args: string[]): void {
  spawnProcess(command, args, {
    detached: true,
    stdio: "ignore",
    env: cleanEnvForDesktopLaunch(),
  }).unref();
}

function launchDesktop(args: string[]): void {
  if (process.env.PASEO_DESKTOP_CLI === "1") {
    throw new Error("Cannot open Stroll while running in desktop CLI passthrough mode.");
  }

  const desktopApp = findDesktopApp();
  if (!desktopApp) {
    throw new Error(
      "Stroll desktop app not found. Install it from https://github.com/edihasaj/paseo/releases",
    );
  }

  if (process.platform === "darwin") {
    // -n forces a new instance even if the app is already running. The new
    // instance relays its argv to the existing one through Electron's
    // single-instance lock. -g keeps the terminal in the foreground.
    spawnDetached("open", ["-n", "-g", "-a", desktopApp, "--args", ...args]);
    return;
  }

  spawnDetached(desktopApp, args);
}

export async function openDesktopWithProject(projectPath: string): Promise<void> {
  try {
    launchDesktop([projectPath]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

export async function openDesktopWithAgent(target: AgentDeepLinkTarget): Promise<void> {
  launchDesktop([buildAgentDeepLink(target)]);
}
