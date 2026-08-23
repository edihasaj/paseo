# Dev-server discovery and browser annotations

## Goal

Make the frontend loop dependable: discover or start the workspace service, open the correct URL,
select a rendered element, attach precise visual/source context, and verify the change without
leaving Paseo.

Paseo already has supervised service scripts, proxy URLs, a real Electron browser, automation,
console/network logs, and element attachments. This plan joins and hardens those paths.

## User contract

### Service discovery

The workspace exposes one **Services** inventory, ranked by authority:

1. configured `paseo.json` service scripts;
2. verified URLs announced by a workspace terminal;
3. package scripts offered as explicit start suggestions.

Each row has an honest lifecycle: `available`, `starting`, `healthy`, `unhealthy`, `stopped`, or
`exited`. Rows show script/terminal ownership, port, URL, health, and Open/Start/Stop/Logs actions.

- Never run an inferred package script without a user action.
- A configured service may opt into `autoStart` and `openWhenHealthy` in `paseo.json`.
- The browser launcher shows healthy services first. One click opens the primary reachable URL in
  a Paseo browser tab.
- When a service is remote, URL resolution goes through the SSH forwarding plan rather than
  returning an unreachable remote localhost URL.

### Annotation

The existing **Annotate element** and **Screenshot element** actions remain in the browser toolbar.

- Hover displays tag/component and dimensions.
- Selection captures URL, selector, DOM neighborhood, computed styles, bounding rect, source hint,
  and a clipped screenshot.
- The attachment enters the current workspace composer and can be opened/removed before send.
- Navigation, reload, webview reparenting, iframe focus, or tab close cancels or safely rebinds the
  selector. No 30-second silent polling state.
- Failure is rendered in the browser toolbar with Retry; loading is a distinct disabled state.

## Service discovery model

Add a daemon-owned, workspace-scoped `WorkspaceServiceInventory`:

```ts
interface WorkspaceService {
  id: string;
  workspaceId: string;
  source: "configured" | "terminal" | "package";
  label: string;
  lifecycle: "available" | "starting" | "healthy" | "unhealthy" | "stopped" | "exited";
  terminalId: string | null;
  port: number | null;
  localUrl: string | null;
  publicUrl: string | null;
  observedAt: string;
}
```

Configured scripts remain projections of `WorkspaceScriptRuntimeStore`; do not duplicate their
lifecycle. Supplementary candidates have their own bounded store and expire when their terminal
exits or stops announcing a live endpoint.

### Terminal URL detection

- Scan ANSI-stripped output from Paseo-owned terminals with a bounded rolling buffer.
- Accept only loopback HTTP(S) URLs with valid TCP ports.
- Attribute the candidate to that terminal and workspace.
- Probe the endpoint with a bounded HTTP request before marking healthy.
- Deduplicate proxy/direct variants by service identity and port.
- Never scan arbitrary machine processes in the first implementation.

### Package suggestions

Read the workspace package manifest using the existing daemon file boundary. Recognize conventional
script names (`dev`, `start`, `serve`, `preview`) and the repository's package manager. Return
suggestions; launching still uses the supervised workspace-script/terminal path and shows the exact
command before confirmation.

### Configuration

Extend script entries additively:

```json
{
  "scripts": {
    "dev": {
      "type": "service",
      "command": "npm run dev",
      "autoStart": true,
      "openWhenHealthy": false
    }
  }
}
```

`autoStart` runs only after the workspace setup phase succeeds. `openWhenHealthy` is client-local
presentation intent and requires a connected browser host; failure never blocks the service.

## Annotation architecture

Replace selector-result polling with a guest-preload/host IPC contract:

1. Renderer asks desktop main to begin a selector session for `(browserId, mode, token)`.
2. Main validates browser ownership and the current guest `WebContents`.
3. Guest preload installs selection listeners in every frame and emits one structured result.
4. Main captures a clipped screenshot through the same serialized capture queue used by browser
   screenshots.
5. Renderer creates the existing `BrowserElementAttachment`.

Keep source hints best-effort. React `_debugSource` is not authoritative and often disappears in
production builds; emit `null`, never a guessed path. A later CDP/source-map adapter may add a
verified source location without changing the attachment shape.

One state machine owns selector lifecycle:

```text
idle -> installing -> selecting -> capturing -> attached
                    \-> canceled
                    \-> failed(retryable reason)
```

Webview detach, guest replacement, navigation, and timeout all terminate the current token. Late
results for old tokens are ignored.

## Protocol and placement

- Add workspace service list/update RPCs and a `workspaceServiceInventory` capability.
- Keep browser selector IPC inside the desktop bridge; element details do not pass through the
  daemon until the user sends them as a normal attachment.
- Register Services in the workspace launcher, Side panel, and Command Center. Do not add a new
  permanent rail.

## Likely files

- `packages/protocol/src/paseo-config-schema.ts`
- `packages/protocol/src/messages.ts`
- `packages/server/src/server/session/workspace-scripts/`
- `packages/server/src/server/workspace-script-runtime-store.ts`
- new `packages/server/src/server/workspace-services/`
- `packages/app/src/utils/workspace-script-links.ts`
- `packages/app/src/screens/workspace/workspace-scripts-button.tsx`
- `packages/app/src/desktop/browser/pane/`
- `packages/desktop/src/features/browser-webviews/`
- `packages/desktop/src/features/browser-automation/`
- `docs/browser-capture-harness.md`, public browser/config docs

## Vertical implementation slices

1. Pure URL candidate parser plus terminal-owned inventory and health probe.
2. Service inventory protocol and UI using current configured scripts.
3. Package-script suggestions and explicit supervised launch.
4. `autoStart`/`openWhenHealthy` configuration.
5. Selector preload IPC replacing renderer polling.
6. Screenshot/source-context attachment and reconnect/reparent hardening.
7. Command Center contribution and SSH-forwarded URL integration point.

## Tests and evidence

- Parser tests: ANSI, wrapped URLs, malformed/unsafe schemes, duplicates, terminal exit.
- Real daemon test: terminal announces URL, health transitions, process exits, inventory clears.
- Playwright: configured service start/open/failure/retry and package suggestion confirmation.
- Existing desktop browser E2E extended across LRU reparent/navigation for annotate and screenshot.
- Capture harness screenshots for idle, selecting, comment, attached, and failure states.
- Manual Vite/Next/SvelteKit services on macOS; Windows/Linux recorded as tested or untested.

## Non-goals

- No arbitrary machine-wide process scanner in the first PR.
- No automatic execution of inferred commands.
- No mobile-owned browser; mobile browser streaming remains discussion #3293.
- No Chrome-profile import; that is discussion #3569.
- No visual redesign of the browser beyond reliable states and existing Paseo primitives.
