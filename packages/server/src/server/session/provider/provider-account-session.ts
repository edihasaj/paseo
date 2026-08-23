import type { SessionInboundMessage, SessionOutboundMessage } from "../../messages.js";
import type { ProviderAccountService } from "../../provider-accounts/service.js";

interface ProviderAccountSessionHost {
  emit(message: SessionOutboundMessage): void;
}

interface ProviderAccountSessionOptions {
  host: ProviderAccountSessionHost;
  providerAccounts?: ProviderAccountService;
}

type ProviderAccountResponseType =
  | "provider.account.list.response"
  | "provider.account.create.response"
  | "provider.account.rename.response"
  | "provider.account.default.set.response"
  | "provider.account.remove.response";

export class ProviderAccountSession {
  private readonly host: ProviderAccountSessionHost;
  private readonly providerAccounts: ProviderAccountService | null;

  constructor(options: ProviderAccountSessionOptions) {
    this.host = options.host;
    this.providerAccounts = options.providerAccounts ?? null;
  }

  async handleList(
    request: Extract<SessionInboundMessage, { type: "provider.account.list.request" }>,
  ): Promise<void> {
    await this.run(request, "provider.account.list.response");
  }

  async handleCreate(
    request: Extract<SessionInboundMessage, { type: "provider.account.create.request" }>,
  ): Promise<void> {
    await this.run(request, "provider.account.create.response", () =>
      this.requireService().create({ provider: request.provider, name: request.name }),
    );
  }

  async handleRename(
    request: Extract<SessionInboundMessage, { type: "provider.account.rename.request" }>,
  ): Promise<void> {
    await this.run(request, "provider.account.rename.response", () =>
      this.requireService().rename(request.accountProfileId, request.name),
    );
  }

  async handleDefaultSet(
    request: Extract<SessionInboundMessage, { type: "provider.account.default.set.request" }>,
  ): Promise<void> {
    await this.run(request, "provider.account.default.set.response", () =>
      this.requireService().selectDefault(request.provider, request.accountProfileId),
    );
  }

  async handleRemove(
    request: Extract<SessionInboundMessage, { type: "provider.account.remove.request" }>,
  ): Promise<void> {
    await this.run(request, "provider.account.remove.response", () =>
      this.requireService().remove(request.accountProfileId),
    );
  }

  private async run(
    request: { requestId: string; type: string },
    responseType: ProviderAccountResponseType,
    mutation?: () => Promise<unknown>,
  ): Promise<void> {
    try {
      await mutation?.();
      this.emitState(responseType, request.requestId);
    } catch (error) {
      this.emitError(request, error);
    }
  }

  private requireService(): ProviderAccountService {
    if (this.providerAccounts) return this.providerAccounts;
    throw Object.assign(new Error("Provider account profiles unavailable"), {
      code: "provider_account_profiles_unavailable",
    });
  }

  private emitState(type: ProviderAccountResponseType, requestId: string): void {
    this.host.emit({
      type,
      payload: { requestId, ...this.requireService().list() },
    });
  }

  private emitError(request: { requestId: string; type: string }, error: unknown): void {
    const code =
      error && typeof error === "object" && "code" in error && typeof error.code === "string"
        ? error.code
        : "provider_account_operation_failed";
    this.host.emit({
      type: "rpc_error",
      payload: {
        requestId: request.requestId,
        requestType: request.type,
        code,
        error: error instanceof Error ? error.message : "Provider account operation failed",
      },
    });
  }
}
