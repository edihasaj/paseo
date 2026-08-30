import { useCallback, useEffect, useMemo, useRef } from "react";
import type { PointerEvent as RNPointerEvent } from "react-native";
import { create } from "zustand";
import { isWeb } from "@/constants/platform";

/** How far the pointer must travel before a press on a row becomes a drag rather than a tap. */
const DRAG_THRESHOLD_PX = 4;

interface FolderDragState {
  /** Set once the pointer has moved past the threshold; a pressed-but-still row is not a drag. */
  dragging: { workspaceKey: string; sourceGroupKey: string } | null;
  hoverGroupKey: string | null;
  begin: (drag: { workspaceKey: string; sourceGroupKey: string }) => void;
  hover: (groupKey: string | null) => void;
  clear: () => void;
}

export const useFolderDragStore = create<FolderDragState>()((set) => ({
  dragging: null,
  hoverGroupKey: null,
  begin: (dragging) => set({ dragging }),
  hover: (hoverGroupKey) => set({ hoverGroupKey }),
  clear: () => set({ dragging: null, hoverGroupKey: null }),
}));

/**
 * Turns a press on a sidebar row into a folder drag.
 *
 * The move and release listeners live on the window rather than the row, and the pointer is
 * deliberately never captured: capture would send every later pointer event to the row and stop
 * `onPointerEnter` firing on the headers, which is the only thing telling us what is under the
 * cursor. Web only — pointer events do not fire on native, where the row menu files a chat.
 */
export function useFolderDragSource(input: { workspaceKey: string; groupKey: string }) {
  const { workspaceKey, groupKey } = input;
  const begin = useFolderDragStore((state) => state.begin);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const armedRef = useRef(false);

  const onPointerDown = useCallback((event: RNPointerEvent) => {
    if (!isWeb || event.nativeEvent.button !== 0) return;
    originRef.current = { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY };
    armedRef.current = true;
  }, []);

  useEffect(() => {
    if (!isWeb) return;
    const handleMove = (event: PointerEvent) => {
      const origin = originRef.current;
      if (!armedRef.current || !origin) return;
      const travelled = Math.hypot(event.clientX - origin.x, event.clientY - origin.y);
      if (travelled < DRAG_THRESHOLD_PX) return;
      armedRef.current = false;
      begin({ workspaceKey, sourceGroupKey: groupKey });
    };
    const handleUp = () => {
      armedRef.current = false;
      originRef.current = null;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [begin, groupKey, workspaceKey]);

  return useMemo(() => ({ onPointerDown }), [onPointerDown]);
}

/**
 * Marks a group header as somewhere a dragged row can be dropped.
 *
 * The drop is committed on the window's pointerup rather than the header's, so releasing a
 * hair outside the header still lands on the group the cursor last entered instead of silently
 * doing nothing.
 */
export function useFolderDropTarget(input: {
  groupKey: string;
  onDrop: (drag: { workspaceKey: string; sourceGroupKey: string }, targetGroupKey: string) => void;
}) {
  const { groupKey, onDrop } = input;
  const dragging = useFolderDragStore((state) => state.dragging);
  const isActive = useFolderDragStore((state) => state.hoverGroupKey === groupKey);
  const hover = useFolderDragStore((state) => state.hover);
  const clear = useFolderDragStore((state) => state.clear);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const onPointerEnter = useCallback(() => {
    if (!dragging) return;
    hover(groupKey);
  }, [dragging, groupKey, hover]);

  const onPointerLeave = useCallback(() => {
    if (!dragging) return;
    hover(null);
  }, [dragging, hover]);

  useEffect(() => {
    if (!isWeb || !dragging || !isActive) return;
    const handleUp = () => {
      onDropRef.current(dragging, groupKey);
      clear();
    };
    window.addEventListener("pointerup", handleUp);
    return () => window.removeEventListener("pointerup", handleUp);
  }, [clear, dragging, groupKey, isActive]);

  // A drag that ends anywhere else must not leave the store armed for the next press.
  useEffect(() => {
    if (!isWeb || !dragging) return;
    const handleUp = () => clear();
    window.addEventListener("pointerup", handleUp);
    return () => window.removeEventListener("pointerup", handleUp);
  }, [clear, dragging]);

  return { isActive: isActive && Boolean(dragging), onPointerEnter, onPointerLeave };
}
