# Universal Command Center

## Goal

Make one `Cmd/Ctrl+K` surface the fastest path to anything Paseo can honestly enumerate: actions,
workspaces, agents, subagents, files, services, browser tabs, account profiles, settings, SSH hosts,
and complete host history metadata.

Do not create a second palette. Extend the existing contribution registry, result projection,
workspace filename search, and daemon fuzzy-search primitives.

## User contract

- Empty query shows recent destinations, needs-attention work, and a short list of common actions.
- Typing searches all enabled sources incrementally. Fast local sections render immediately; remote
  sections stream in without moving the active keyboard selection unexpectedly.
- Results are grouped by meaning, not implementation: Go to, Active work, Files, Services, Actions,
  Settings, History.
- Result subtitles show host/project/workspace/provider context only when needed to disambiguate.
- Exact/prefix matches beat fuzzy matches. Attention and recency break ties; neither can outrank a
  materially better textual match.
- Match glyphs are highlighted from daemon/client-provided ranges.
- `Esc` closes and restores prior focus. Arrow keys, Enter, and platform accessibility remain first
  class. Compact uses the current sheet presentation.

Optional query prefixes narrow; they never become required syntax:

```text
> action     @ agent/subagent     # file     : service/browser     ? history
```

Plain text still searches everything.

## Search sources

### Local synchronous

- registered core/plugin actions;
- open workspace/browser/file/terminal tabs;
- settings destinations;
- cached account profiles and SSH targets.

### Host asynchronous

- projects/workspaces and active agents;
- managed/provider subagents;
- current-workspace file names;
- workspace services/scripts;
- complete daemon-owned history metadata.

Transcript contents are excluded from the first implementation. Discussion #3085 correctly
requires completeness: a partial index must not answer "not found." Add transcript search later as
an explicit source only when a host advertises a complete index and reports its scope.

## Source contract

Keep static `CommandCenterContribution` registrations. Add a real async source seam:

```ts
interface CommandCenterSource {
  id: string;
  rank: number;
  scopes: CommandCenterScope[];
  search(input: {
    query: ParsedCommandCenterQuery;
    context: CommandCenterContext;
    signal: AbortSignal;
  }): Promise<CommandCenterSourceResult> | CommandCenterSourceResult;
}
```

`CommandCenterSourceResult` includes stable results plus `coverage`:

```ts
{
  kind: "complete";
}
{
  kind: "scoped";
  label: string;
}
{
  kind: "unavailable";
  reason: string;
}
```

The palette can therefore say "Files in checkout-ui" or "Host offline" instead of silently
merging partial data.

Each query generation owns an `AbortController`. Late results from older generations are ignored.
Per-source loading/error rows occupy stable section space and never become selectable.

## Ranking

Reuse `packages/protocol/src/search/text-match.ts` for tokenization, fuzzy policy, scoring, and match
ranges. Extract one shared result scorer rather than retaining the palette's current substring check.

Ranking tuple:

1. textual score;
2. explicit scope match;
3. needs-input / error / running priority where relevant;
4. last activity;
5. stable title/id tie break.

Apply top-K after scoring the complete source candidate set. Do not fuzzy-rank an arbitrary server
page.

## Result model

Replace the expanding result union with one canonical row plus action:

```ts
interface CommandCenterResult {
  id: string;
  sourceId: string;
  kind: CommandCenterResultKind;
  title: string;
  subtitle: string;
  matches: MatchRange[];
  icon: CommandCenterIcon;
  status?: CommandCenterStatus;
  run(): void | Promise<void>;
}
```

Keep kind-specific data inside source closures rather than making the renderer know how to navigate
every domain. One renderer handles 36pt single-line and 56pt two-line rows using existing tokens.

## Contributions from the other plans

- Account plan registers Manage accounts and account rows.
- Browser plan registers services and browser tabs.
- Subagent plan registers tree nodes and queue actions.
- SSH plan registers targets, Connect, and forwarding actions.

Each feature owns its source/registration lifecycle. Command Center does not subscribe directly to
every feature store.

## Likely files

- `packages/protocol/src/search/text-match.ts`
- `packages/protocol/src/messages.ts` for host search extensions
- `packages/server/src/server/agent-history-search.ts`
- `packages/app/src/command-center/`
- feature-specific registration files
- keyboard shortcut store and translations
- plugin Command Center context/reference docs

## Vertical implementation slices

1. Shared scorer, parsed prefixes, match ranges, and canonical result model.
2. Async source registry with cancellation and stable incremental sections.
3. Migrate existing actions/workspaces/agents/files with no behavior loss.
4. Add open tabs, subagents, services, settings, and history metadata.
5. Add account/SSH sources when their capabilities exist.
6. Recent-result persistence and empty-query ranking.
7. Plugin API compatibility projection plus public docs.

## Tests and evidence

- Pure ranking tests for exact/prefix/fuzzy, multi-token, priority, stable ties, and top-K.
- Async tests for cancellation, slow/error/offline hosts, generation changes, and active-row stability.
- Playwright desktop/compact tests for every source, keyboard-only operation, focus restore, and
  old-daemon capability drift.
- Performance evidence with thousands of files/history rows and several active hosts. Record query
  to first local result and query to settled remote results.
- Accessibility labels and screen-reader order for sections and status rows.
- Video: open account, service, nested subagent, file, setting, and remote host from one palette.

## Non-goals

- No incomplete transcript search.
- No replacement for Files, Sessions, Settings, or project screens.
- No command language users must memorize.
- No new fuzzy-search dependency unless current primitives fail measured requirements.
- No action runs merely because it is highlighted; Enter/click remains explicit.
