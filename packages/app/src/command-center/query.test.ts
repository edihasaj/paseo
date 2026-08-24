import { expect, test } from "vitest";
import {
  compareCommandCenterScores,
  parseCommandCenterQuery,
  scoreCommandCenterText,
} from "./query";

test("parses optional scope prefixes without making them mandatory", () => {
  expect(parseCommandCenterQuery("plain search")).toEqual({
    raw: "plain search",
    scope: null,
    text: "plain search",
  });
  expect(parseCommandCenterQuery("@ nested worker")).toMatchObject({
    scope: "agent",
    text: "nested worker",
  });
});

test("ranks an exact title over a fuzzy title and returns title match ranges", () => {
  const query = parseCommandCenterQuery("settings");
  const exact = scoreCommandCenterText(query, ["Settings", "Open app settings"]);
  const fuzzy = scoreCommandCenterText(query, ["Seting", "Typo candidate"]);
  expect(exact?.matches).toEqual([{ start: 0, length: 8 }]);
  expect(exact && fuzzy && compareCommandCenterScores(exact, fuzzy)).toBeLessThan(0);
});
