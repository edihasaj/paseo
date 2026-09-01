import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, test } from "vitest";
import { type AtomicFileRuntime, writeFileAtomic } from "./atomic-file.js";

const directories: string[] = [];

async function createTarget(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(tmpdir(), "paseo-atomic-file-"));
  directories.push(directory);
  return path.join(directory, "state.json");
}

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) =>
        fs.rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 25 }),
      ),
  );
});

test("retries bounded transient Windows rename failures before publishing atomically", async () => {
  const target = await createTarget();
  const delays: number[] = [];
  let attempts = 0;
  const runtime: AtomicFileRuntime = {
    platform: "win32",
    rename: async (from, to) => {
      attempts += 1;
      if (attempts < 3) {
        throw Object.assign(new Error("file is temporarily busy"), { code: "EPERM" });
      }
      await fs.rename(from, to);
    },
    sleep: async (delayMs) => {
      delays.push(delayMs);
    },
  };

  await writeFileAtomic(target, '{"ok":true}', runtime);

  expect(attempts).toBe(3);
  expect(delays).toEqual([10, 25]);
  await expect(fs.readFile(target, "utf8")).resolves.toBe('{"ok":true}');
  expect(await fs.readdir(path.dirname(target))).toEqual(["state.json"]);
});

test("surfaces permanent rename failures without retrying and cleans the temporary file", async () => {
  const target = await createTarget();
  let attempts = 0;
  const runtime: AtomicFileRuntime = {
    platform: "win32",
    rename: async () => {
      attempts += 1;
      throw Object.assign(new Error("access denied"), { code: "EACCES" });
    },
    sleep: async () => {
      throw new Error("permanent failures must not sleep");
    },
  };

  await expect(writeFileAtomic(target, "never published", runtime)).rejects.toMatchObject({
    code: "EACCES",
  });
  expect(attempts).toBe(1);
  expect(await fs.readdir(path.dirname(target))).toEqual([]);
});
