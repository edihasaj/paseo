# Provider account profiles

## Goal

Use several legitimate accounts for one provider without repeated logout/login, show every
account's usage windows, and make the active account obvious wherever an agent starts.

This resolves the workflow behind issue #2780 and discussions #3463/#2475 without treating custom
provider aliases as accounts.

## User contract

### Settings

Add **Provider accounts** under the selected host's Agents settings.

- The implicit **System account** represents the provider's normal home and remains the default.
- **Add account** asks for provider and display name, creates an isolated provider-owned runtime
  home, then launches the provider's login flow.
- Rows show provider, name, resolved identity when available, authentication state, plan, tightest
  usage window, and reset time.
- Row actions: Rename, Reauthenticate, Make default, Remove.
- Removing an account is blocked while an unarchived agent is pinned to it. The failure names those
  agents and links to them.

### Launching

- Account selection sits with provider/model selection, after provider and before model.
- Hide it when the provider has only the System account.
- Remember the default per provider on that daemon.
- Agent profiles may optionally pin `accountProfileId`; otherwise they use the current default.
- The created agent persists its resolved account profile. History and resume always use that
  account, even after the host default changes.

### Switching and provider handoff

- Choosing another default is immediate and affects future launches.
- A running agent displays **Using Work** and does not change underneath the process.
- **Continue with provider/account…** opens one grouped picker containing every available provider
  and its accounts. It creates a sibling agent in the same workspace, so Claude → Codex and Codex
  Work → Codex Personal use one interaction.
- The continuation copies a bounded,
  provider-neutral continuation capsule: objective/goal, user and assistant text, unresolved
  permissions, active files, branch, and current diff summary. Tool logs are summarized or linked,
  not copied blindly.
- The source agent stays open. The destination links back to it. No UI claims that the native
  provider thread migrated.

## Data model

Add a host-owned store under `$PASEO_HOME/provider-accounts/`:

```text
provider-accounts/
├── accounts.json
└── <provider>/<account-id>/
```

`ProviderAccountProfileSchema`:

```ts
{
  id: string;                 // pac_<opaque>
  provider: string;           // built-in provider id
  name: string;
  runtimeHome: string;        // daemon-owned absolute path; never accepted from a client
  identity?: { email?: string; organization?: string; plan?: string };
  createdAt: string;
  updatedAt: string;
  lastAuthenticatedAt?: string;
}
```

`null` account id means System account. Add `accountProfileId?: string | null` to agent create,
stored config/runtime info, snapshots, persistence metadata, Agent profiles, and schedule launch
config. Preserve omission for old clients and records.

`accounts.json` stores metadata only. Credential files live in provider-owned runtime homes or the
OS credential store with private permissions.

## Provider adapter

Introduce a real two-adapter seam, `provider-accounts/<provider>/adapter.ts`:

```ts
interface ProviderAccountAdapter {
  createHome(accountId: string): Promise<string>;
  login(account: ProviderAccountProfile): Promise<ProviderAccountIdentity>;
  reauthenticate(account: ProviderAccountProfile): Promise<ProviderAccountIdentity>;
  launchEnv(account: ProviderAccountProfile | null): Record<string, string>;
  fetchUsage(account: ProviderAccountProfile | null): Promise<ProviderUsage>;
  remove(account: ProviderAccountProfile): Promise<void>;
}
```

Initial adapters:

- **Codex:** one `CODEX_HOME` per account. Start `codex app-server` inside that home. Use official
  app-server `account/read`, `account/rateLimits/read`, and `account/usage/read` where supported.
  Fall back to the existing read-only quota fetcher only for older Codex builds.
- **Claude:** one `CLAUDE_CONFIG_DIR` per account. Linux/Windows credentials stay in that home.
  macOS uses Claude's config-dir-scoped Keychain service; capture and restore through a small
  keychain port while leaving Claude responsible for credential format and refresh.

Both adapters strip inherited auth environment variables before applying a managed account. An
exported `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or OAuth token must not silently override the
selected subscription account. Show the conflict before launch.

## Server flow

1. `AgentManager` resolves `accountProfileId` before `buildLaunchContext`.
2. Validate provider match and daemon ownership of the runtime home.
3. Merge adapter environment into `AgentLaunchContext.env` before Paseo agent identity variables.
4. Persist the resolved account id before provider session creation.
5. Resume uses the persisted account id, never the current default.
6. Catalog discovery and usage fetches accept account scope so model/auth answers match launch.

Serialize account mutations. A double Add, concurrent rename/remove, or overlapping login cannot
lose store updates.

## Usage protocol and UI

Extend generic usage identity:

```ts
{
  providerId: string;
  accountProfileId: string | null;
  accountName: string;
  ...existing ProviderUsage
}
```

Key React Query caches by `(serverId, providerId, accountProfileId)`. Fetch active accounts first;
stagger inactive Codex/Claude probes and retain the current five-minute cache. Failed rows keep
their last non-expired reading with a stale badge instead of blanking the roster.

Show the tightest window in the composer/account picker. The host Usage screen retains detailed
generic bars for all windows. No provider-specific usage component.

## Likely files

- `packages/protocol/src/messages.ts`
- `packages/server/src/server/agent/agent-sdk-types.ts`
- `packages/server/src/server/agent/agent-manager.ts`
- `packages/server/src/server/agent/providers/codex-app-server-agent.ts`
- `packages/server/src/server/agent/providers/claude/`
- `packages/server/src/services/quota-fetcher/`
- new `packages/server/src/server/provider-accounts/`
- `packages/app/src/agent-profiles/`
- `packages/app/src/provider-usage/`
- selected-host Agents settings and composer provider/model controls

Keep provider-specific account logic out of the large Codex/Claude session files; those receive a
resolved launch environment only.

## Vertical implementation slices

1. Schema/store plus Codex account-home adapter; no UI beyond tests.
2. Codex add/login/list/default UI and launch pinning.
3. Per-account Codex usage and reset meters.
4. Claude adapter, including macOS scoped-Keychain behavior.
5. Agent-profile account field and composer picker.
6. Continue-with-provider/account capsule and source/destination links.
7. CLI/MCP read/list/select surfaces without secret output.

## Tests and evidence

- Store atomicity, ownership/path traversal, duplicate identity, and remove-in-use tests.
- Launch-context tests proving distinct `CODEX_HOME`/`CLAUDE_CONFIG_DIR` values and stripped auth
  overrides.
- Real Codex app-server test: two homes, two accounts, correct `account/read` and rate limits.
- Real Claude tests on macOS and Linux/Windows runner; verify Keychain/config-dir isolation.
- Playwright: add, failed login, retry, select default, launch, restart, resume pinned account,
  stale usage, and old-daemon capability fallback.
- Video: add Work and Personal, launch both, switch default, continue one agent under the other.

## Rollout and non-goals

- Gate with `providerAccountProfiles` capability.
- Do not migrate existing custom provider aliases automatically.
- Do not copy provider tokens into `config.json`, agent records, logs, diagnostics, or WebSocket
  payloads.
- Do not mutate credentials under a running provider process.
- Do not promise byte-identical native history across accounts; the explicit continuation is the
  safe, provider-neutral contract.
