import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = new URL("../", import.meta.url);
function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "paseo-update-nix-test-"));
  const scripts = join(root, "scripts");
  const nixDirectory = join(root, "nix");
  mkdirSync(scripts);
  mkdirSync(nixDirectory);

  for (const relativePath of [
    "package-lock.json",
    "scripts/fix-lockfile.mjs",
    "scripts/update-nix.sh",
  ]) {
    copyFileSync(new URL(relativePath, repoRoot), join(root, relativePath));
  }
  const lockfile = join(root, "package-lock.json");
  const expectedHash = createHash("sha256").update(readFileSync(lockfile)).digest("hex");
  writeFileSync(join(nixDirectory, "npm-deps.hash"), `${expectedHash}\n`);

  return {
    root,
    lockfile,
    hashFile: join(nixDirectory, "npm-deps.hash"),
  };
}

function runCheck(fixture, ...args) {
  return spawnSync("bash", ["scripts/update-nix.sh", ...args], {
    cwd: fixture.root,
    env: process.env,
    encoding: "utf8",
  });
}

test("update-nix --check validates without mutating repository inputs", (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const originalLockfile = readFileSync(fixture.lockfile, "utf8");
  const originalHash = readFileSync(fixture.hashFile, "utf8");
  const result = runCheck(fixture, "--check");

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Checking lockfile/);
  assert.match(result.stdout, /Hash is already up to date/);
  assert.equal(readFileSync(fixture.lockfile, "utf8"), originalLockfile);
  assert.equal(readFileSync(fixture.hashFile, "utf8"), originalHash);
});

test("update-nix --check rejects stale inputs without rewriting them", async (t) => {
  await t.test("lockfile", () => {
    const fixture = createFixture();
    t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
    const staleLockfile = `${readFileSync(fixture.lockfile, "utf8")}\n`;
    writeFileSync(fixture.lockfile, staleLockfile);

    const result = runCheck(fixture, "--check");

    assert.equal(result.status, 1);
    assert.match(result.stderr, /ERROR: package-lock\.json is stale/);
    assert.equal(readFileSync(fixture.lockfile, "utf8"), staleLockfile);
  });

  await t.test("dependency hash", () => {
    const fixture = createFixture();
    t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
    writeFileSync(fixture.hashFile, "sha256-stale\n");

    const result = runCheck(fixture, "--check");

    assert.equal(result.status, 1);
    assert.match(result.stdout, /ERROR: Nix lockfile hash is stale/);
    assert.equal(readFileSync(fixture.hashFile, "utf8"), "sha256-stale\n");
  });
});

test("update-nix rejects unsupported modes before touching inputs", (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  const originalLockfile = readFileSync(fixture.lockfile, "utf8");

  const result = runCheck(fixture, "--write-check");

  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/);
  assert.equal(readFileSync(fixture.lockfile, "utf8"), originalLockfile);
});
