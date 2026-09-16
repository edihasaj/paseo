#!/usr/bin/env node
// Rebuild the workspace packages that other workspaces typecheck against, but
// only when their sources actually changed.
//
// `npm run typecheck` resolves @getpaseo/protocol, @getpaseo/client and friends
// through their built `dist/*.d.ts`, not their source. After a merge or a branch
// switch that dist can describe an older protocol than the source does, and the
// consuming packages then report errors that do not exist in the code — the
// classic one being a new session event or client method reported as missing.
// Rebuilding by hand fixes it, which makes the failure look flaky rather than
// stale.
//
// The builds are not incremental (~14s even when nothing changed), so this
// guard hashes the inputs and skips the rebuild when they match the last one.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheFile = path.join(root, "node_modules", ".cache", "workspace-deps-build.json");

// Everything `npm run build:server-deps` produces, in the order it builds them.
const GUARDED = ["protocol", "client", "highlight", "plugin", "relay"];

// Hashed because they change what the build emits. `dist` is the output and
// `node_modules` is noise.
const SOURCE_DIRS = ["src", "codegen"];
const SOURCE_FILES = ["package.json", "tsconfig.json", "tsdown.config.ts"];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

// Content, not mtime: the protocol package regenerates a validator file into
// `src/` on every typecheck, so its mtime always looks new while its bytes stay
// the same.
function hashPackage(pkgDir) {
  const files = [
    ...SOURCE_DIRS.flatMap((d) => walk(path.join(pkgDir, d))),
    ...SOURCE_FILES.map((f) => path.join(pkgDir, f)).filter((f) => existsSync(f)),
  ].sort();

  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(path.relative(pkgDir, file));
    hash.update(readFileSync(file));
  }
  return hash.digest("hex");
}

function hasBuildOutput(pkgDir) {
  const dist = path.join(pkgDir, "dist");
  if (!existsSync(dist)) return false;
  try {
    return statSync(dist).isDirectory() && readdirSync(dist).length > 0;
  } catch {
    return false;
  }
}

function readCache() {
  try {
    return JSON.parse(readFileSync(cacheFile, "utf8"));
  } catch {
    return {};
  }
}

function writeCache(next) {
  mkdirSync(path.dirname(cacheFile), { recursive: true });
  writeFileSync(cacheFile, `${JSON.stringify(next, null, 2)}\n`);
}

const checkOnly = process.argv.includes("--check");

const cache = readCache();
const current = {};
const stale = [];

for (const name of GUARDED) {
  const pkgDir = path.join(root, "packages", name);
  if (!existsSync(pkgDir)) continue;
  const hash = hashPackage(pkgDir);
  current[name] = hash;
  if (!hasBuildOutput(pkgDir)) stale.push(`${name} (never built)`);
  else if (cache[name] !== hash) stale.push(name);
}

if (stale.length === 0) {
  process.exit(0);
}

if (checkOnly) {
  console.error(`Workspace deps are stale: ${stale.join(", ")}`);
  console.error("Run `npm run build:server-deps` before typechecking.");
  process.exit(1);
}

console.log(`Rebuilding workspace deps (stale: ${stale.join(", ")})...`);
const result = spawnSync("npm", ["run", "build:server-deps"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

// Recorded only after a successful build, so a failed build stays stale.
writeCache({ ...cache, ...current });
