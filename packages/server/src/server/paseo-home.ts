import os from "node:os";
import path from "node:path";
import { ensurePrivateDirectory } from "./private-files.js";

function expandHomeDir(input: string): string {
  if (input.startsWith("~/")) {
    return path.join(os.homedir(), input.slice(2));
  }
  if (input === "~") {
    return os.homedir();
  }
  return input;
}

export function resolvePaseoHome(env: NodeJS.ProcessEnv = process.env): string {
  // Stroll keeps its own home so it can run beside an upstream Paseo install.
  // PASEO_HOME stays honoured as a fallback for migrating an existing config.
  const raw = env.STROLL_HOME ?? env.PASEO_HOME ?? "~/.stroll";
  const resolved = path.resolve(expandHomeDir(raw));
  ensurePrivateDirectory(resolved);
  return resolved;
}
