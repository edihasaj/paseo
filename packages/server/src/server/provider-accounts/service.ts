import type {
  ProviderAccountIdentity,
  ProviderAccountProfile,
  ProviderAccountProvider,
} from "@getpaseo/protocol/provider-accounts";
import type { ProcessEnvRecord } from "../paseo-env.js";
import { getProviderAccountAdapter } from "./adapters.js";
import type { ProviderAccountRecord, ProviderAccountStore } from "./store.js";

export class ProviderAccountProviderMismatchError extends Error {
  readonly code = "provider_account_provider_mismatch";

  constructor(accountId: string, expected: string, actual: string) {
    super(`Provider account ${accountId} belongs to ${actual}, not ${expected}`);
    this.name = "ProviderAccountProviderMismatchError";
  }
}

export class ProviderAccountInUseError extends Error {
  readonly code = "provider_account_in_use";

  constructor(readonly agentIds: string[]) {
    super(`Provider account is used by active agents: ${agentIds.join(", ")}`);
    this.name = "ProviderAccountInUseError";
  }
}

export interface ProviderAccountListResult {
  accounts: ProviderAccountProfile[];
  defaults: Partial<Record<ProviderAccountProvider, string | null>>;
}

export interface ResolvedProviderAccountLaunch {
  account: ProviderAccountProfile | null;
  envOverlay: ProcessEnvRecord;
}

interface ProviderAccountServiceOptions {
  listActiveAgentIds?: (accountProfileId: string) => Promise<string[]>;
}

export class ProviderAccountService {
  constructor(
    private readonly store: ProviderAccountStore,
    private readonly options: ProviderAccountServiceOptions = {},
  ) {}

  list(): ProviderAccountListResult {
    const snapshot = this.store.list();
    return {
      accounts: snapshot.accounts.map(this.toPublicProfile),
      defaults: { ...snapshot.defaults },
    };
  }

  create(input: {
    provider: ProviderAccountProvider;
    name: string;
  }): Promise<ProviderAccountProfile> {
    return this.store.create(input).then(this.toPublicProfile);
  }

  rename(accountId: string, name: string): Promise<ProviderAccountProfile> {
    return this.store.rename(accountId, name).then(this.toPublicProfile);
  }

  updateIdentity(
    accountId: string,
    identity: ProviderAccountIdentity,
  ): Promise<ProviderAccountProfile> {
    return this.store.updateIdentity(accountId, identity).then(this.toPublicProfile);
  }

  async selectDefault(
    provider: ProviderAccountProvider,
    accountId: string | null,
  ): Promise<ProviderAccountListResult> {
    await this.store.selectDefault(provider, accountId);
    return this.list();
  }

  async remove(accountId: string): Promise<void> {
    const agentIds = await this.options.listActiveAgentIds?.(accountId);
    if (agentIds?.length) throw new ProviderAccountInUseError(agentIds);
    await this.store.remove(accountId);
  }

  resolveLaunch(input: {
    provider: string;
    accountProfileId: string | null | undefined;
  }): ResolvedProviderAccountLaunch {
    if (!input.accountProfileId) {
      return { account: null, envOverlay: {} };
    }
    const account = this.requireAccount(input.accountProfileId);
    if (account.provider !== input.provider) {
      throw new ProviderAccountProviderMismatchError(account.id, input.provider, account.provider);
    }
    const adapter = getProviderAccountAdapter(account.provider);
    return {
      account: this.toPublicProfile(account),
      envOverlay: adapter.launchSpec(account).envOverlay,
    };
  }

  resolveDefaultAccountId(provider: string): string | null {
    if (provider !== "codex" && provider !== "claude") return null;
    return this.store.list().defaults[provider] ?? null;
  }

  private requireAccount(accountId: string): ProviderAccountRecord {
    const account = this.store.get(accountId);
    if (!account) throw new Error(`Provider account not found: ${accountId}`);
    return account;
  }

  private toPublicProfile(account: ProviderAccountRecord): ProviderAccountProfile {
    const { runtimeHome: _runtimeHome, ...profile } = account;
    return profile;
  }
}
