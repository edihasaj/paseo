import { expect, test, vi } from "vitest";
import { parseCommandCenterQuery } from "./query";
import { searchCommandCenterSources, type CommandCenterSource } from "./sources";

test("keeps source updates isolated and suppresses late aborted results", async () => {
  let resolveSlow!: () => void;
  const source: CommandCenterSource = {
    id: "slow",
    rank: 1,
    scopes: ["all"],
    search: () =>
      new Promise(
        (resolve) => (resolveSlow = () => resolve({ results: [], coverage: { kind: "complete" } })),
      ),
  };
  const updates = vi.fn();
  const controller = new AbortController();
  const search = searchCommandCenterSources({
    sources: [source],
    query: parseCommandCenterQuery("agent"),
    context: {},
    signal: controller.signal,
    onUpdate: updates,
  });
  controller.abort();
  resolveSlow();
  await search;
  expect(updates).toHaveBeenCalledTimes(1);
  expect(updates).toHaveBeenCalledWith(expect.objectContaining({ loading: true }));
});
