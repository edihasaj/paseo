import type { AgentSkillSelection } from "@getpaseo/protocol/messages";

import type { DaemonConfigStore } from "../../daemon-config-store.js";

export type SkillSelection = AgentSkillSelection;

export interface SkillSelectionStore {
  get(): Promise<SkillSelection>;
  set(selection: unknown): Promise<SkillSelection>;
  isSet(): Promise<boolean>;
}

/**
 * Stroll installs no bundled skills unless asked.
 *
 * Skill install targets resolve from `os.homedir()`, not STROLL_HOME, so `~/.claude/skills`,
 * `~/.codex/skills` and `~/.agents/skills` are shared with any other install on the machine —
 * upstream Paseo among them. Defaulting to "all" makes whichever daemon notices drift first
 * rewrite directories the other one owns. Opting in is a choice; clobbering is not.
 */
const DEFAULT_SKILL_SELECTION: SkillSelection = { mode: "custom", skills: [] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function coerceSkillNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const names = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return [...new Set(names)].sort();
}

export function coerceSkillSelection(value: unknown): SkillSelection {
  if (!isRecord(value)) return DEFAULT_SKILL_SELECTION;
  if (value.mode === "all") return { mode: "all" };
  if (value.mode === "custom") {
    return { mode: "custom", skills: coerceSkillNames(value.skills) };
  }
  return DEFAULT_SKILL_SELECTION;
}

export function createSkillSelectionStore(
  configStore: Pick<DaemonConfigStore, "get" | "setAgentSkillSelection">,
): SkillSelectionStore {
  return {
    async get() {
      return coerceSkillSelection(configStore.get().skills?.selection);
    },
    async set(selection) {
      const parsed = coerceSkillSelection(selection);
      configStore.setAgentSkillSelection(parsed);
      return parsed;
    },
    async isSet() {
      return configStore.get().skills?.selection !== undefined;
    },
  };
}
