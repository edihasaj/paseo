# Subagent tree with queue and steer controls

## Goal

Make delegated work legible and controllable without opening every child: hierarchy, current state,
queued instructions, provider-supported steering, stopping, and results in one collapsible track.

Paseo already has managed subagents, provider-native subagent timelines, an above-composer track,
client queues, and native steering for Codex, Claude, and OpenCode. The missing pieces are hierarchy,
capability-based controls, and daemon-owned queued work.

## User contract

- The existing Subagents pill becomes **Active work** when it contains children, background tasks,
  or queued instructions. Empty means no chrome.
- Opening it shows a tree rooted at the current agent. Direct children start expanded while active;
  finished branches collapse automatically unless they need attention.
- Each row shows title, provider/model when known, status, elapsed time, workspace/branch when
  different, and queued count.
- Selecting a row opens its full session or read-only provider timeline using current tab rules.
- Managed subagents expose Send instruction, Queue next, Steer now, Stop, Detach, and Archive only
  when the lifecycle supports each action.
- Provider-native rows expose only capabilities their adapter proves. Unsupported actions are
  absent, not disabled promises.
- **Stop all active** is available at the tree root and confirms the exact affected children.

## Queue semantics

Move queued instructions from the client session store to daemon-owned agent state.

An `AgentQueuedPrompt` contains:

```ts
{
  id: string;
  agentId: string;
  text: string;
  attachments: QueuedPromptAttachment[];
  createdAt: string;
  createdByClientId: string;
}
```

- Queue means: start this as the next ordinary turn after the current foreground turn reaches an
  authoritative terminal state.
- Multiple entries are FIFO and can be reordered, edited, deleted, or sent now.
- Queue survives client disconnects, app restarts, and opening another device.
- An error or unresolved permission does not drain the next message. The row remains with Retry or
  Send now.
- Archiving an agent requires confirmation when queued work exists. Confirming deletes its queue and
  staged attachments.
- Queued attachments upload to daemon-owned private staging immediately. The queue stores stable
  uploaded ids, never client-local blob URIs. Delivery or deletion releases unreferenced staging.

One per-agent serialized owner handles queue mutations and drain. A client must not infer idle and
race another client to send.

## Steer semantics

- Steer is available only with an exact daemon-owned active turn id.
- The request carries the expected turn id; a changed turn fails visibly and leaves the draft.
- Successful steer appends input to the active turn and creates the canonical user row once.
- An ambiguous provider error never retries or interrupts automatically.
- Providers that definitively reject native steer may offer **Interrupt and send** as a separate,
  clearly named action.
- Child completion notifications continue through the same provider-native steer path and never
  synthesize a user interruption.

This matches Codex `turn/steer` rather than treating queue, steer, and replacement as names for one
operation.

## Tree projection

Create one pure client projection over two lifecycle sources:

```ts
interface SubagentTreeNode {
  key: string;
  kind: "managed" | "provider";
  parentKey: string | null;
  depth: number;
  status: "initializing" | "running" | "waiting" | "idle" | "error" | "completed" | "canceled";
  capabilities: SubagentControlCapabilities;
  children: SubagentTreeNode[];
}
```

- Managed descendants derive recursively from `paseo.parent-agent-id`.
- Extend provider descriptors with optional `parentSubagentId`, `depth`, and capability flags.
- Codex already retains nested `parentCallId` relationships while hydrating child threads; project
  those relationships instead of flattening them.
- Claude/OpenCode adapters emit only relationships they observe authoritatively. Unknown ancestry
  stays at the root; never infer it from timestamps or titles.
- Preserve provider/session ids as opaque values.

Capability flags:

```ts
{
  canOpen: boolean;
  canPrompt: boolean;
  canQueue: boolean;
  canSteer: boolean;
  canStop: boolean;
}
```

For managed agents, capabilities derive from lifecycle and daemon feature support. Provider adapters
own native capabilities. Initial native control target: Codex child threads where app-server exposes
the loaded thread and exact active turn. Claude provider children remain inspect/stop-all only until
the SDK exposes a safe child prompt contract.

## UI shape

- Reuse `ComposerTrack`, menu rows, status dots, and compact sheet/wide popover presentations.
- Tree branches use disclosure chevrons and one indentation rail per depth.
- One primary line; muted provider/workspace/elapsed metadata below.
- Hover-revealed trailing actions on wide screens; row menu/sheet on compact.
- Queued instructions render as child rows under their target agent, not a separate permanent band.
- Preserve scroll position and branch expansion while live updates arrive.
- Expansion state is client-local; queue and lifecycle state are daemon-owned.

## Protocol and storage

Add additive, capability-gated RPCs:

- `agent.queue.list/create/update/reorder/delete/send_now.*`
- `agent.provider_subagent.control.*`
- provider descriptor optional relationship/capability fields
- queue snapshot/update events

Store queues under `$PASEO_HOME/agents/queues/<agent-id>.json` through one atomic store surface.
Staged attachments use mode-0600 files below `$PASEO_HOME/agents/queued-attachments/`.

## Likely files

- `packages/protocol/src/messages.ts`
- `packages/server/src/server/agent/provider-subagents/store.ts`
- `packages/server/src/server/agent/agent-manager.ts`
- `packages/server/src/server/agent/agent-prompt.ts`
- Codex/Claude/OpenCode provider adapters
- new `packages/server/src/server/agent/queue/`
- `packages/app/src/subagents/`
- `packages/app/src/composer/actions.ts` and queue rendering
- `packages/app/src/panels/agent-tracks.tsx`
- `docs/agent-lifecycle.md`, data model and orchestration docs

## Vertical implementation slices

1. Daemon queue store/RPC and migration from no server queue.
2. Current agent queue UI moved from client state to server snapshots.
3. Managed-subagent recursive tree and capability policy.
4. Provider descriptor relationships; Codex nested tree first.
5. Row instruction sheet with Queue/Steer/Interrupt distinctions.
6. Provider-native controls where proven; Stop all root action.
7. Background-work extension point for discussion #3150 without importing shell tasks yet.

## Tests and evidence

- Queue FIFO, reorder, retry, archive, reconnect, two-client race, and attachment cleanup tests.
- Steer expected-turn mismatch, definitive unavailable fallback, and ambiguous failure tests.
- Projection tests for mixed managed/provider trees, missing ancestry, reparent/detach, and stable keys.
- Real Codex multi-agent test with nested children, steer, stop, reload, and history replay.
- Playwright wide/compact tests for expand/collapse, queued rows, row actions, failures, and old daemon.
- Video showing a parent, two children, one nested child, queued follow-up, active steer, and stop-all.

## Non-goals

- No guessed control of provider-native children.
- No new provider-independent meaning for `idle`; discussion #3010 remains separate.
- No automatic file locking or Canopy-style claims.
- No forced opening of child tabs.
- No raw tool logs in the parent transcript; summaries and links preserve context quality.
