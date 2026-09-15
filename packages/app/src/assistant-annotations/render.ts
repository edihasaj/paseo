import type { ParsedAnnotationToken } from "./parse";

type AttributeRenderer = (attributes: Record<string, string>) => string;

function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}

function escapeMarkdownLinkLabel(label: string): string {
  return label.replace(/\]/g, "\\]");
}

function markdownLink(label: string, href: string): string {
  return `[${escapeMarkdownLinkLabel(label)}](${href})`;
}

function humanizeTokenName(name: string): string {
  return name
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatAttributesSummary(attributes: Record<string, string>): string {
  const entries = Object.entries(attributes);
  if (entries.length === 0) return "";
  return ` (${entries.map(([key, value]) => `${key}: ${value}`).join(", ")})`;
}

function renderUnknownToken(name: string, attributes: Record<string, string>): string {
  return `${humanizeTokenName(name)}${formatAttributesSummary(attributes)}`;
}

function formatLineFragment(lineStart: string | undefined, lineEnd: string | undefined): string {
  if (!lineStart) return "";
  const hasRange = lineEnd && lineEnd !== lineStart;
  return hasRange ? `:${lineStart}-${lineEnd}` : `:${lineStart}`;
}

function renderFileCitation(attributes: Record<string, string>): string {
  const path = attributes.path;
  if (!path) return renderUnknownToken("codex-file-citation", attributes);

  const fragment = formatLineFragment(
    attributes.line ?? attributes.start_line,
    attributes.end_line,
  );
  const target = `${path}${fragment}`;
  return markdownLink(target, target);
}

function renderInlineVis(attributes: Record<string, string>): string {
  return attributes.title ?? attributes.fallback ?? "Visualization";
}

function renderGitCommit(attributes: Record<string, string>): string {
  const sha = attributes.sha ?? attributes.hash;
  if (!sha) return renderUnknownToken("git-commit", attributes);
  return attributes.message ? `Committed ${sha}: ${attributes.message}` : `Committed ${sha}`;
}

function renderGitCreateBranch(attributes: Record<string, string>): string {
  const name = attributes.name ?? attributes.branch;
  if (!name) return renderUnknownToken("git-create-branch", attributes);
  return `Created branch ${name}`;
}

function renderGitCreatePr(attributes: Record<string, string>): string {
  const url = attributes.url;
  const number = attributes.number;
  const label = number ? `Opened PR #${number}` : "Opened pull request";
  return url ? markdownLink(label, url) : label;
}

function renderGitPush(attributes: Record<string, string>): string {
  const remote = attributes.remote ?? "origin";
  const branch = attributes.branch;
  return branch ? `Pushed to ${remote}/${branch}` : `Pushed to ${remote}`;
}

function renderGitStage(attributes: Record<string, string>): string {
  const count = Number.parseInt(attributes.count ?? "", 10);
  if (!Number.isFinite(count)) return renderUnknownToken("git-stage", attributes);
  return `Staged ${count} ${pluralize("file", count)}`;
}

const TOKEN_RENDERERS: Record<string, AttributeRenderer> = {
  "codex-file-citation": renderFileCitation,
  "codex-inline-vis": renderInlineVis,
  "git-commit": renderGitCommit,
  "git-create-branch": renderGitCreateBranch,
  "git-create-pr": renderGitCreatePr,
  "git-push": renderGitPush,
  "git-stage": renderGitStage,
};

export function renderAnnotationToken(token: ParsedAnnotationToken): string {
  const renderer = TOKEN_RENDERERS[token.name];
  return renderer ? renderer(token.attributes) : renderUnknownToken(token.name, token.attributes);
}
