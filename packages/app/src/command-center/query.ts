import {
  matchRanges,
  scoreTextFields,
  type MatchRange,
  type MatchScore,
} from "@getpaseo/protocol/search/text-match";

export type CommandCenterScopePrefix = "action" | "agent" | "file" | "service" | "history";

export interface ParsedCommandCenterQuery {
  raw: string;
  text: string;
  scope: CommandCenterScopePrefix | null;
}

const PREFIXES: Record<string, CommandCenterScopePrefix> = {
  ">": "action",
  "@": "agent",
  "#": "file",
  ":": "service",
  "?": "history",
};

export function parseCommandCenterQuery(raw: string): ParsedCommandCenterQuery {
  const normalized = raw.trimStart();
  const prefix = normalized[0];
  const scope = prefix ? PREFIXES[prefix] : undefined;
  return {
    raw,
    scope: scope ?? null,
    text: scope ? normalized.slice(1).trimStart() : raw.trim(),
  };
}

export interface CommandCenterScoredText {
  score: MatchScore;
  matches: MatchRange[];
}

export function scoreCommandCenterText(
  query: ParsedCommandCenterQuery,
  fields: readonly string[],
): CommandCenterScoredText | null {
  const score = scoreTextFields(query.text, [...fields], { typoTolerant: true });
  if (!score) return null;
  const title = fields[0] ?? "";
  return { score, matches: matchRanges(query.text, title, score) };
}

export function compareCommandCenterScores(
  left: CommandCenterScoredText,
  right: CommandCenterScoredText,
): number {
  if (left.score.tier !== right.score.tier) return left.score.tier - right.score.tier;
  if (left.score.offset !== right.score.offset) return left.score.offset - right.score.offset;
  return (left.score.spread ?? 0) - (right.score.spread ?? 0);
}
