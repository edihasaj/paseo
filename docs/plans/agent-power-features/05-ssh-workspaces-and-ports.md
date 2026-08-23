# SSH hosts and automatic port forwarding

## Goal

Connect to a Paseo daemon reachable only through SSH, keep the tunnel healthy, open remote
workspaces in local editors, and expose remote dev services through stable local forwarded ports.

The Paseo-shaped implementation is an SSH **host connection**. Workspaces remain daemon-owned
records. This avoids a second remote filesystem, terminal, Git, and agent stack beside the daemon.

This covers discussions #2812 and #3344 and reuses service discovery from the browser plan.

## User contract

### Add host

Add **SSH** beside Direct connection and Pairing link on desktop.

- Pick an alias from effective `~/.ssh/config` or enter destination, user, port, and optional
  identity file.
- Configure the remote Paseo endpoint, default `127.0.0.1:6767`.
- Test shows Resolving, Verifying host, Authenticating, Opening tunnel, and Verifying Paseo.
- System OpenSSH owns config includes, ProxyJump, agent, FIDO/security keys, Kerberos, and
  `known_hosts`. Paseo never stores private keys.
- Unknown/changed host keys fail closed with fingerprint/recovery UI.
- Passphrase prompts use a desktop askpass bridge and remain memory-only.

### Runtime

- SSH appears as another connection on the same host profile.
- Status: Connecting, Online, Reconnecting, Needs authentication, Host key changed, Offline.
- Exponential reconnect preserves the logical connection and local daemon port.
- Closing the app stops its tunnel processes; the remote daemon and agents continue.
- Mobile/web clients do not attempt desktop SSH. They use another direct/relay connection stored on
  that host or show "Available from desktop."

### Services and ports

- Healthy remote workspace services show **Forward and open**.
- Configured service ports may auto-forward when `autoForward: true`.
- The Ports Side panel lists remote port, local port, owner, status, URL, and Stop/Retry.
- Local ports persist as desired values; if occupied after restart, Paseo selects another port and
  shows the remap.
- Forwarded URLs become the primary browser target for an SSH connection.
- Manual forwards are allowed only for valid TCP ports and are scoped to the SSH host.

### Editor handoff

The existing Open menu offers only installed editors with verified remote URI support. Build URIs
from the configured SSH alias and daemon-supplied absolute workspace path. Paseo never guesses an
SSH destination from the daemon TCP endpoint.

## Connection model

Extend the client-owned host connection union:

```ts
interface SshTunnelHostConnection {
  id: string;
  type: "sshTunnel";
  sshAlias: string;
  remoteDaemonEndpoint: string;
  preferredLocalPort: number | null;
}
```

Do not persist passwords, passphrases, resolved private-key contents, control-socket paths, or local
ephemeral process ids.

`ActiveConnection` reports the logical SSH connection plus its current local WebSocket endpoint and
forward registry. The existing `DaemonClient` still connects through the normal direct TCP
transport to that local endpoint; host runtime selection, latency probes, replica cache, and
directory sync stay unchanged.

## Desktop tunnel service

Add one main-process `SshTunnelService` behind a typed preload API.

Responsibilities:

- resolve/test system `ssh` and effective config;
- allocate and reserve a loopback port;
- spawn `ssh -N -L <local>:<remote-host>:<remote-port>` without a shell;
- parse known host/auth/forward errors into typed outcomes;
- bridge askpass prompts;
- monitor exit and reconnect with bounded backoff;
- own extra service-forward child processes;
- terminate only processes it owns.

Use explicit argv. Never build a shell command. Keep `StrictHostKeyChecking` from effective SSH
config; never force `no`. Set `ExitOnForwardFailure=yes` and conservative keepalives.

POSIX connection multiplexing is an optimization after correctness. Windows may use one OpenSSH
process per forward. The product contract is stable regardless of process topology.

## Port-forward registry

Client-local desired forwards:

```ts
interface SshPortForward {
  id: string;
  connectionId: string;
  workspaceId: string | null;
  serviceId: string | null;
  remotePort: number;
  preferredLocalPort: number | null;
  autoForward: boolean;
}
```

Runtime state is a discriminated union: stopped, starting, forwarded, reconnecting, or failed with a
typed reason. Service inventory updates reconcile desired automatic forwards; they do not remove
manual forwards.

Never scan every remote machine port in the first implementation. Forward configured and
workspace-attributed discovered services only. A later explicit **Detect ports** action can add an
OS-specific scanner with clear scope.

## Link resolution

Extend `resolveWorkspaceScriptLink` with a connection-supplied forwarded target. Precedence:

1. public URL;
2. active SSH forwarded URL;
3. Paseo localhost proxy reachable through the active connection;
4. direct host URL.

The resolver remains pure. Tunnel allocation and lifecycle stay in the desktop service/store.

## Protocol and compatibility

No daemon protocol is required for the base tunnel: it transports the existing protocol.

The browser/service plan's inventory supplies workspace-attributed remote ports. Add client
capabilities only for optional editor metadata or future port scanning. Older daemons still work
with configured `paseo.json` service ports.

## Likely files

- `packages/app/src/types/host-connection.ts`
- `packages/app/src/runtime/host-runtime.ts`
- add-host and selected-host settings UI
- new `packages/app/src/ssh/` state/policy
- new `packages/desktop/src/features/ssh-tunnels/`
- desktop preload API/types
- `packages/app/src/utils/workspace-script-links.ts`
- Side panel/launcher/Command Center registrations
- editor-open bridge and host settings
- connectivity, security, and workspaces public docs

## Vertical implementation slices

1. Pure schema, validation, effective-config parsing, and typed error mapping.
2. Desktop daemon tunnel with fixed local port, test UI, reconnect, and cleanup.
3. Host-runtime connection integration and old-client filtering.
4. Manual service forwards and pure URL resolution.
5. Automatic forwards from workspace service inventory.
6. Ports Side panel plus Command Center actions.
7. Remote editor handoff using the explicit SSH alias.
8. Askpass, host-key, FIDO/Kerberos, and Windows/Linux evidence hardening.

## Tests and evidence

- Unit tests for argv construction, validation, error mapping, backoff, local-port conflicts, and
  forward reconciliation.
- Real local OpenSSH fixture in CI: daemon tunnel, disconnect/reconnect, wrong host key, auth
  failure, occupied port, multiple forwards, and cleanup.
- Playwright/Electron tests for add/test/failure/retry, connection selection, Ports panel, and
  forwarded browser link.
- Manual remote Linux host: app close while agent runs, reconnect, service hot reload, VS Code/Zed
  open, security-key or agent auth where available.
- Explicit macOS/Windows/Linux and mobile/web availability table.
- Video from Add SSH host through opening a forwarded dev server.

## Non-goals

- No embedded SSH server or private-key vault.
- No bypass of host-key checking.
- No mobile SSH client in this PR.
- No duplicate remote agent/filesystem runtime without a Paseo daemon.
- No machine-wide remote port scan by default.
- No inference that a direct TCP hostname is also the SSH destination.
