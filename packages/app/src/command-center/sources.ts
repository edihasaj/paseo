import type { MatchRange } from "@getpaseo/protocol/search/text-match";
import type { CommandCenterIcon } from "./contributions";
import type { ParsedCommandCenterQuery } from "./query";

export type CommandCenterResultKind =
  | "action"
  | "workspace"
  | "agent"
  | "subagent"
  | "file"
  | "service"
  | "browser"
  | "setting"
  | "history"
  | "account"
  | "ssh";

export interface CommandCenterCanonicalResult {
  id: string;
  sourceId: string;
  kind: CommandCenterResultKind;
  title: string;
  subtitle: string;
  matches: MatchRange[];
  icon?: CommandCenterIcon;
  status?: "attention" | "error" | "running" | "offline";
  run(): void | Promise<void>;
}

export type CommandCenterSourceCoverage =
  | { kind: "complete" }
  | { kind: "scoped"; label: string }
  | { kind: "unavailable"; reason: string };

export interface CommandCenterSourceResult {
  results: readonly CommandCenterCanonicalResult[];
  coverage: CommandCenterSourceCoverage;
}

export interface CommandCenterSourceContext {
  serverId?: string;
  workspaceId?: string;
}

export interface CommandCenterSource {
  id: string;
  rank: number;
  scopes: readonly (ParsedCommandCenterQuery["scope"] | "all")[];
  search(input: {
    query: ParsedCommandCenterQuery;
    context: CommandCenterSourceContext;
    signal: AbortSignal;
  }): Promise<CommandCenterSourceResult> | CommandCenterSourceResult;
}

export interface CommandCenterSourceSnapshot {
  source: CommandCenterSource;
  result: CommandCenterSourceResult | null;
  loading: boolean;
  error: string | null;
}

export async function searchCommandCenterSources(input: {
  sources: readonly CommandCenterSource[];
  query: ParsedCommandCenterQuery;
  context: CommandCenterSourceContext;
  signal: AbortSignal;
  onUpdate(snapshot: CommandCenterSourceSnapshot): void;
}): Promise<void> {
  const eligible = input.sources
    .filter((source) => source.scopes.includes("all") || source.scopes.includes(input.query.scope))
    .sort((left, right) => left.rank - right.rank || left.id.localeCompare(right.id));
  await Promise.all(
    eligible.map(async (source) => {
      input.onUpdate({ source, result: null, loading: true, error: null });
      try {
        const result = await source.search({
          query: input.query,
          context: input.context,
          signal: input.signal,
        });
        if (!input.signal.aborted) input.onUpdate({ source, result, loading: false, error: null });
      } catch (error) {
        if (!input.signal.aborted) {
          input.onUpdate({
            source,
            result: null,
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }),
  );
}
