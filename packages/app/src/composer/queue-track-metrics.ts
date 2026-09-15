/**
 * Height metrics for the queued-message list.
 *
 * The queue used to grow without bound, so a long queue pushed the composer off
 * screen. It is capped instead, and the cap is derived from the row box here
 * rather than written as a pixel literal in the stylesheet: changing the action
 * button size then keeps showing the same number of items instead of silently
 * showing a fraction more or fewer.
 *
 * `queueItem` has no vertical padding — only `minHeight: QUEUE_ACTION_BUTTON_SIZE` —
 * and `QueuedMessageRow` keeps its actions laid out at full size even when hidden
 * (opacity, not `display: none`), so the button size is the row's exact height.
 * The only other contributor is `queueItemDivider`'s bottom border, which sits
 * between rows (one fewer than the row count).
 */

/** Queued rows visible before the list scrolls. */
export const QUEUE_VISIBLE_ITEMS = 5;

/** Square edit/send buttons, which set the row's exact content height. */
export const QUEUE_ACTION_BUTTON_SIZE = 32;

export interface QueueTrackMetrics {
  /** Divider border width between rows. */
  borderWidth: number;
  /** Defaults to QUEUE_VISIBLE_ITEMS. */
  visibleItems?: number;
}

export function queueTrackMaxHeight({
  borderWidth,
  visibleItems = QUEUE_VISIBLE_ITEMS,
}: QueueTrackMetrics): number {
  if (visibleItems <= 0) return 0;
  return QUEUE_ACTION_BUTTON_SIZE * visibleItems + borderWidth * (visibleItems - 1);
}
