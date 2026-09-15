import { describe, expect, it } from "vitest";

import {
  QUEUE_ACTION_BUTTON_SIZE,
  QUEUE_VISIBLE_ITEMS,
  queueTrackMaxHeight,
} from "./queue-track-metrics.js";

describe("queueTrackMaxHeight", () => {
  it("fits exactly the visible rows and the dividers between them", () => {
    // 5 rows of 32 (queueItem has no vertical padding) plus 4 one-pixel dividers.
    expect(queueTrackMaxHeight({ borderWidth: 1 })).toBe(164);
  });

  it("counts one fewer divider than rows", () => {
    const single = queueTrackMaxHeight({ borderWidth: 1, visibleItems: 1 });
    const double = queueTrackMaxHeight({ borderWidth: 1, visibleItems: 2 });
    expect(single).toBe(QUEUE_ACTION_BUTTON_SIZE);
    expect(double).toBe(QUEUE_ACTION_BUTTON_SIZE * 2 + 1);
  });

  it("tracks the row box so the visible count cannot drift", () => {
    const base = queueTrackMaxHeight({ borderWidth: 1 });
    expect(queueTrackMaxHeight({ borderWidth: 2 })).toBeGreaterThan(base);
  });

  it("caps a queue longer than the visible count", () => {
    const cap = queueTrackMaxHeight({ borderWidth: 1 });
    const twentyRows = queueTrackMaxHeight({ borderWidth: 1, visibleItems: 20 });
    expect(cap).toBeLessThan(twentyRows);
    expect(QUEUE_VISIBLE_ITEMS).toBeLessThan(20);
  });

  it("collapses rather than returning a negative height", () => {
    expect(queueTrackMaxHeight({ borderWidth: 1, visibleItems: 0 })).toBe(0);
  });
});
