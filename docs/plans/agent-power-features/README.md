# Agent power features

Research and implementation order for five focused Paseo changes:

1. Provider account profiles with usage and reset meters.
2. Reliable dev-server discovery and browser annotations.
3. A collapsible subagent tree with queue and steer controls.
4. One universal Command Center.
5. Optional SSH hosts with automatic service port forwarding.

Each change is one independently reviewable implementation and pull request. They share product
rules, but not a second framework or umbrella runtime.

## Product outcome

Keep Paseo chat-first, quiet, and cross-device. Power appears when context makes it useful:

- account identity beside provider/model selection;
- active work above the composer;
- browser and runtime tools in ordinary workspace tabs and the Side panel;
- global actions and navigation in Command Center;
- SSH as another host connection, not another workspace model.

The terminal remains available but is never required for routine account switching, previewing,
delegation, search, or remote connection recovery.

## What already exists

The plans extend current primitives instead of replacing them:

| Need                    | Existing authority                                                                |
| ----------------------- | --------------------------------------------------------------------------------- |
| Provider launch bundles | `daemon.agentProfiles`, provider overrides, `AgentLaunchContext.env`              |
| Usage meters            | `ProviderUsageService`, `provider.usage.list.*`, provider-usage React Query/UI    |
| Dev services            | `paseo.json` scripts, supervised terminals, service proxy and health state        |
| Browser automation      | workspace-scoped Electron guests, brokered `browser_*` tools, element attachments |
| Subagents               | managed-agent parent labels plus provider-subagent descriptors/timelines          |
| Queue and steer         | client queue, daemon active-turn identity, provider-native steering               |
| Search and commands     | contribution registry, fuzzy search primitives, host history search               |
| Remote hosts            | direct TCP and encrypted relay connections to a daemon                            |

## Verified reference behavior

These are reference principles, not code or external guardrails to import.

- Codex displays active subagents above the composer, lets the user expand status, stop active
  workers, and open individual threads. Its app-server requires the current turn id for
  `turn/steer`, exposes one active account per process, and provides account/rate-limit RPCs.
  Sources: [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents),
  [App Server](https://learn.chatgpt.com/docs/app-server).
- Claude documents `CLAUDE_CONFIG_DIR` as the account/config/session isolation boundary. On macOS,
  credentials use config-dir-scoped Keychain services; Linux and Windows store credentials inside
  the selected config directory. Source:
  [Claude environment variables](https://code.claude.com/docs/en/env-vars).
- Orca gives each managed account an isolated runtime home, pins resumed sessions to the home that
  owns them, and shows active and inactive account limits without moving a running session.
  Source: [Orca usage tracking](https://www.onorca.dev/docs/agents/usage-tracking).
- Orca Design Mode captures DOM, computed styles, screenshot, and source hints. Paseo already
  captures the same basic element data; the remaining work is lifecycle reliability and automatic
  discovery. Source: [Orca Design Mode](https://www.onorca.dev/docs/browser/design-mode).
- Canopy's useful interaction ideas are progressive disclosure, agent file ownership, discovered
  services, and one searchable surface. Its implementation is too new to treat as authority.
  Source: [Canopy](https://canopyide.dev/).

## Shared invariants

### One concept, one owner

- Provider account profiles own credential isolation and launch identity.
- Agent profiles remain reusable model/mode/feature bundles and may reference an account profile.
- Providers still own credentials. Paseo stores identity metadata and provider-owned credential
  homes; no OAuth token or API key enters the wire protocol or `config.json`.
- Workspace scripts remain authoritative configured services. Discovery only supplements them.
- Managed and provider-native children share one tree projection, not one lifecycle implementation.
- Command Center remains the only global palette.
- SSH transports a connection to a Paseo daemon. It does not create a second remote execution
  architecture beside the daemon.

### Safe switching

- Every agent record persists the provider account profile used at launch.
- Changing the selected account affects new agents and explicit continuations only.
- A running or resumable native session never silently changes credential homes.
- `Continue with account…` creates a new agent in the same workspace, carries a bounded continuation
  capsule, and leaves the source agent intact.

### Progressive disclosure

- With one account, no account selector chrome.
- With no subagents or queued messages, no track.
- With no discovered services, no browser suggestion.
- With no SSH hosts, local/direct/relay behavior is unchanged.
- Advanced detail belongs in popovers, sheets, Side panel tabs, or Settings—not permanent bands.

### Compatibility and security

- Every new wire shape is additive and capability-gated.
- Older daemons keep current behavior; older clients never receive unsupported enum values.
- Managed paths are daemon-generated and ownership-validated before read, write, or deletion.
- Account and SSH operations expose pending, success, and actionable failure UI.
- No host keys, private keys, provider tokens, terminal output, or browser cookies cross to clients.

## Pull-request order

1. **Provider accounts.** Establishes stable account identity used by usage rows and later search.
2. **Browser discovery and annotations.** Establishes service discovery reused by SSH forwarding.
3. **Subagent tree and controls.** Independent of accounts/browser; lands before palette entries.
4. **Universal Command Center.** Indexes the stable surfaces from the first three changes.
5. **SSH hosts and port forwarding.** Reuses service discovery and link resolution.

Keep branches stacked only during development. Before opening each PR, rebase it onto upstream
`main` and remove dependencies that did not land.

## Advanced follow-ups

These stay outside the first five PRs so the simple product remains reviewable. Reconsider them
after the core surfaces have real usage evidence:

1. **Smart dispatch suggestions.** Recommend a provider/account from capability, task shape, and
   remaining quota. Never move work or spend another account without confirmation.
2. **Complete background-work inventory.** Extend Active work with authoritative provider tasks and
   background shells from discussion #3150. Inspect-only when the provider cannot prove Stop.
3. **Goal and plan projection.** Surface persisted Codex goals, token/time budgets, and equivalent
   provider plan state through one optional agent detail—without inventing fake parity.
4. **Fan-out comparison.** Launch the same brief into isolated worktrees, compare evidence and
   diffs, then let the user choose or ask a reviewer to recommend a winner.
5. **Complete transcript search.** Add an explicit search mode only after a host can prove its index
   covers every supported provider transcript; follow discussion #3085's no-false-negative rule.
6. **Mobile browser supervision.** Stream the authoritative desktop guest with backpressure and
   explicit control ownership, following discussion #3293.
7. **Workspace hibernation and resources.** Preserve layout while releasing idle browser/editor
   renderers; expose CPU, memory, ports, and cleanup as diagnostics, not decorative dashboards.
8. **Review rounds.** Turn staged diff comments into bounded fix/review rounds with checks and
   conflicts visible between rounds.

Each follow-up needs its own workflow discussion and implementation plan before code.

## Required evidence for every implementation

- Focused unit tests for schemas, reducers, policy, and adapters.
- App Playwright tests through a real daemon for success, failure, reconnect, and version drift.
- Real-provider verification for account and steer behavior.
- Real Electron capture for browser changes.
- macOS evidence plus an explicit Windows/Linux/mobile tested/not-tested table.
- Before/after screenshots or one short interaction video for every UI change.
- Focused typecheck/lint/test commands in the PR body; full gates through CI.

## Completion boundary

Planning is complete when every feature document names its user contract, authoritative state,
protocol changes, implementation slices, affected files, failure behavior, tests, manual evidence,
rollout, and non-goals. Implementation completion is separate and requires the evidence above.
