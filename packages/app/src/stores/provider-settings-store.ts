import { create } from "zustand";
import type { RefObject } from "react";

interface ProviderSettingsTarget {
  serverId: string;
  provider: string;
  overlayParentLayer?: number;
  restoreFocusRef?: RefObject<unknown>;
}

interface ProviderSettingsStoreState {
  serverId: string | null;
  provider: string | null;
  overlayParentLayer: number;
  restoreFocusRef: RefObject<unknown> | undefined;
  visible: boolean;
  open: (target: ProviderSettingsTarget) => void;
  close: () => void;
}

export const useProviderSettingsStore = create<ProviderSettingsStoreState>()((set) => ({
  serverId: null,
  provider: null,
  overlayParentLayer: 0,
  restoreFocusRef: undefined,
  visible: false,
  open: ({ serverId, provider, overlayParentLayer = 0, restoreFocusRef }) => {
    set({ serverId, provider, overlayParentLayer, restoreFocusRef, visible: true });
  },
  close: () => {
    set({ visible: false });
  },
}));
