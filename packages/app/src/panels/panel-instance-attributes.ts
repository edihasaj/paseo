import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { usePaneContext } from "@/panels/pane-context";

export interface PanelInstanceIdentity {
  serverId: string;
  workspaceId: string;
  tabId: string;
}

export interface PanelInstanceAttributes {
  modified: boolean;
  suspendPendingSave?: () => () => void;
  /**
   * Keeps this tab mounted past the workspace pane's normal tab LRU cap. Distinct from
   * `modified`: it does not show the unsaved-changes dot, it only protects panel state
   * that lives in the DOM/component tree and would otherwise be lost to a remount, such
   * as a chat transcript's scroll position while the reader has scrolled away from the
   * live tail (see `onFollowingLatestChange` on `AgentStreamView`).
   */
  retainMount?: boolean;
}

const DEFAULT_ATTRIBUTES: PanelInstanceAttributes = { modified: false };
const attributesByPanel = new Map<string, PanelInstanceAttributes>();
const listenersByPanel = new Map<string, Set<() => void>>();
const allListeners = new Set<() => void>();
let attributesRevision = 0;

export function buildPanelInstanceKey(identity: PanelInstanceIdentity): string {
  return `${identity.serverId}:${identity.workspaceId}:${identity.tabId}`;
}

export function getPanelInstanceAttributes(
  identity: PanelInstanceIdentity,
): PanelInstanceAttributes {
  return attributesByPanel.get(buildPanelInstanceKey(identity)) ?? DEFAULT_ATTRIBUTES;
}

export function setPanelInstanceAttributes(
  identity: PanelInstanceIdentity,
  attributes: PanelInstanceAttributes,
): void {
  const key = buildPanelInstanceKey(identity);
  const previous = attributesByPanel.get(key) ?? DEFAULT_ATTRIBUTES;
  if (
    previous.modified === attributes.modified &&
    previous.suspendPendingSave === attributes.suspendPendingSave &&
    previous.retainMount === attributes.retainMount
  ) {
    return;
  }
  if (attributes.modified || attributes.retainMount) attributesByPanel.set(key, attributes);
  else attributesByPanel.delete(key);
  attributesRevision += 1;
  for (const listener of listenersByPanel.get(key) ?? []) listener();
  for (const listener of allListeners) listener();
}

/**
 * Tab ids that should stay mounted past the workspace pane's tab LRU cap: tabs with
 * unsaved edits (`modified`, shows the dirty dot) and tabs that separately asked to be
 * retained (`retainMount`, no dot) because unmounting would lose panel-local state such
 * as chat scroll position.
 */
export function useRetainedPanelTabIds(input: {
  serverId: string;
  workspaceId: string;
  tabIds: string[];
}): Set<string> {
  const revision = useSyncExternalStore(
    useCallback((listener: () => void) => {
      allListeners.add(listener);
      return () => allListeners.delete(listener);
    }, []),
    () => attributesRevision,
    () => attributesRevision,
  );
  return useMemo(() => {
    void revision;
    return new Set(
      input.tabIds.filter((tabId) => {
        const attributes = getPanelInstanceAttributes({
          serverId: input.serverId,
          workspaceId: input.workspaceId,
          tabId,
        });
        return attributes.modified || attributes.retainMount === true;
      }),
    );
  }, [input.serverId, input.tabIds, input.workspaceId, revision]);
}

export function subscribePanelInstanceAttributes(
  identity: PanelInstanceIdentity,
  listener: () => void,
): () => void {
  const key = buildPanelInstanceKey(identity);
  const listeners = listenersByPanel.get(key) ?? new Set<() => void>();
  listeners.add(listener);
  listenersByPanel.set(key, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) listenersByPanel.delete(key);
  };
}

export function usePanelInstanceAttributes({
  serverId,
  workspaceId,
  tabId,
}: PanelInstanceIdentity): PanelInstanceAttributes {
  const subscribe = useCallback(
    (listener: () => void) =>
      subscribePanelInstanceAttributes({ serverId, workspaceId, tabId }, listener),
    [serverId, tabId, workspaceId],
  );
  const getSnapshot = useCallback(
    () => getPanelInstanceAttributes({ serverId, workspaceId, tabId }),
    [serverId, tabId, workspaceId],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function usePublishPanelInstanceAttributes(attributes: PanelInstanceAttributes): void {
  const { serverId, workspaceId, tabId } = usePaneContext();
  const modified = attributes.modified;
  const suspendPendingSave = attributes.suspendPendingSave;
  const retainMount = attributes.retainMount;
  useEffect(() => {
    const identity = { serverId, workspaceId, tabId };
    setPanelInstanceAttributes(identity, { modified, suspendPendingSave, retainMount });
    return () => setPanelInstanceAttributes(identity, DEFAULT_ATTRIBUTES);
  }, [modified, retainMount, serverId, suspendPendingSave, tabId, workspaceId]);
}
