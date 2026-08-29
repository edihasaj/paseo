import { homedir } from "node:os";
import path from "node:path";

/**
 * Resolves the daemon home directory the CLI shares with the server.
 *
 * Must stay in step with `resolvePaseoHome` in @getpaseo/server: Stroll keeps its
 * own home so it can run beside an upstream Paseo install, and PASEO_HOME stays
 * honoured as a fallback for migrating an existing config.
 */
export function resolveStrollHome(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const configured = env.STROLL_HOME ?? env.PASEO_HOME ?? "~/.stroll";
  const expanded = configured === "~" ? homedir() : configured.replace(/^~\//u, `${homedir()}/`);
  return path.resolve(expanded);
}
