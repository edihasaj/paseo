import { describe, expect, it } from "vitest";
import { parseAnnotationTokenAt } from "./parse";

describe("parseAnnotationTokenAt", () => {
  it("parses a token with quoted attributes", () => {
    const text = ':git-commit{sha="abc1234" message="fix: bug"}';
    expect(parseAnnotationTokenAt(text, 0)).toEqual({
      status: "complete",
      token: {
        name: "git-commit",
        attributes: { sha: "abc1234", message: "fix: bug" },
        start: 0,
        end: text.length,
      },
    });
  });

  it("parses a token with a bare (unquoted) attribute value", () => {
    const text = ":git-stage{count=3}";
    expect(parseAnnotationTokenAt(text, 0)).toEqual({
      status: "complete",
      token: { name: "git-stage", attributes: { count: "3" }, start: 0, end: text.length },
    });
  });

  it("parses a token with no attributes", () => {
    const text = ":git-push{}";
    expect(parseAnnotationTokenAt(text, 0)).toEqual({
      status: "complete",
      token: { name: "git-push", attributes: {}, start: 0, end: text.length },
    });
  });

  it("reports incomplete when the closing brace never arrives", () => {
    expect(parseAnnotationTokenAt(':git-commit{sha="abc1234"', 0)).toEqual({
      status: "incomplete",
    });
  });

  it("reports incomplete when a quoted value never closes", () => {
    expect(parseAnnotationTokenAt(':git-commit{sha="abc1234', 0)).toEqual({
      status: "incomplete",
    });
  });

  it("reports invalid when the character after the identifier is not a brace", () => {
    expect(parseAnnotationTokenAt("Note: nothing to see here", 4)).toEqual({ status: "invalid" });
  });

  it("reports invalid when an attribute is missing its value", () => {
    expect(parseAnnotationTokenAt(":git-commit{sha}", 0)).toEqual({ status: "invalid" });
  });

  it("unescapes backslash-escaped quotes inside a quoted value", () => {
    const text = ':git-commit{message="say \\"hi\\""}';
    const result = parseAnnotationTokenAt(text, 0);
    expect(result).toEqual({
      status: "complete",
      token: {
        name: "git-commit",
        attributes: { message: 'say "hi"' },
        start: 0,
        end: text.length,
      },
    });
  });
});
