import { describe, expect, it } from "vitest";
import { rewriteAssistantAnnotations } from "./rewrite";

describe("rewriteAssistantAnnotations", () => {
  it("returns plain text unchanged", () => {
    expect(rewriteAssistantAnnotations("Output ready: nothing to see here.")).toBe(
      "Output ready: nothing to see here.",
    );
  });

  it("renders a codex-file-citation as a markdown file link", () => {
    expect(
      rewriteAssistantAnnotations(
        'Output ready: :codex-file-citation{path="/tmp/example-output.txt" purpose="output"}',
      ),
    ).toBe("Output ready: [/tmp/example-output.txt](/tmp/example-output.txt)");
  });

  it("renders a codex-file-citation with a line range", () => {
    expect(
      rewriteAssistantAnnotations(
        ':codex-file-citation{path="/repo/src/app.ts" line="12" end_line="20"}',
      ),
    ).toBe("[/repo/src/app.ts:12-20](/repo/src/app.ts:12-20)");
  });

  it("renders codex-inline-vis using its title", () => {
    expect(
      rewriteAssistantAnnotations(':codex-inline-vis{title="Latency by endpoint" kind="chart"}'),
    ).toBe("Latency by endpoint");
  });

  it("renders codex-inline-vis using its fallback when no title is present", () => {
    expect(rewriteAssistantAnnotations(':codex-inline-vis{fallback="chart unavailable"}')).toBe(
      "chart unavailable",
    );
  });

  it("renders git-commit as a readable phrase", () => {
    expect(
      rewriteAssistantAnnotations(':git-commit{sha="abc1234" message="fix: handle edge case"}'),
    ).toBe("Committed abc1234: fix: handle edge case");
  });

  it("renders git-create-branch as a readable phrase", () => {
    expect(rewriteAssistantAnnotations(':git-create-branch{name="feature/annotations"}')).toBe(
      "Created branch feature/annotations",
    );
  });

  it("renders git-create-pr as a markdown link when a URL is present", () => {
    expect(
      rewriteAssistantAnnotations(
        ':git-create-pr{url="https://github.com/getpaseo/paseo/pull/123" number="123"}',
      ),
    ).toBe("[Opened PR #123](https://github.com/getpaseo/paseo/pull/123)");
  });

  it("renders git-create-pr as plain text when no URL is present", () => {
    expect(rewriteAssistantAnnotations(':git-create-pr{number="123"}')).toBe("Opened PR #123");
  });

  it("renders git-push as a readable phrase", () => {
    expect(rewriteAssistantAnnotations(':git-push{remote="origin" branch="main"}')).toBe(
      "Pushed to origin/main",
    );
  });

  it("renders git-stage with singular/plural file counts", () => {
    expect(rewriteAssistantAnnotations(':git-stage{count="1"}')).toBe("Staged 1 file");
    expect(rewriteAssistantAnnotations(':git-stage{count="3"}')).toBe("Staged 3 files");
  });

  it("degrades an unknown token to readable text without exposing control syntax", () => {
    const result = rewriteAssistantAnnotations(':git-squash{branch="main" count="3"}');
    expect(result).toBe("Git Squash (branch: main, count: 3)");
    expect(result).not.toContain(":git-squash{");
  });

  it("leaves an unterminated token as-is", () => {
    const text = 'Working on it: :codex-file-citation{path="/tmp/output.txt"';
    expect(rewriteAssistantAnnotations(text)).toBe(text);
  });

  it("leaves a bare colon-word that never opens a brace untouched", () => {
    expect(rewriteAssistantAnnotations("Note: nothing to format here")).toBe(
      "Note: nothing to format here",
    );
  });

  it("resolves a token split across two streamed chunks once it completes", () => {
    const chunkOne = 'Output ready: :codex-file-citation{path="/tmp/example-output.txt"';
    const chunkTwo = ' purpose="output"}';

    // Mid-stream: the token has not closed yet, so it is left as raw text.
    expect(rewriteAssistantAnnotations(chunkOne)).toBe(chunkOne);

    // Once the closing chunk arrives, the accumulated text resolves cleanly.
    expect(rewriteAssistantAnnotations(chunkOne + chunkTwo)).toBe(
      "Output ready: [/tmp/example-output.txt](/tmp/example-output.txt)",
    );
  });

  it("handles escaped quotes inside attribute values", () => {
    expect(
      rewriteAssistantAnnotations(':git-commit{sha="abc1234" message="say \\"hi\\" to it"}'),
    ).toBe('Committed abc1234: say "hi" to it');
  });

  it("handles multiple tokens in the same message", () => {
    const text =
      ':git-stage{count="2"}. Then :git-commit{sha="def5678" message="wip"}. Then :git-push{remote="origin" branch="main"}.';
    expect(rewriteAssistantAnnotations(text)).toBe(
      "Staged 2 files. Then Committed def5678: wip. Then Pushed to origin/main.",
    );
  });
});
