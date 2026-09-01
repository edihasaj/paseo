import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const WINDOWS_RENAME_RETRY_DELAYS_MS = [10, 25, 50, 100, 200] as const;

export interface AtomicFileRuntime {
  platform: NodeJS.Platform;
  rename: typeof fs.rename;
  sleep(delayMs: number): Promise<void>;
}

const defaultRuntime: AtomicFileRuntime = {
  platform: process.platform,
  rename: fs.rename,
  sleep: (delayMs) => new Promise<void>((resolve) => setTimeout(resolve, delayMs)),
};

function isTransientWindowsRenameError(error: unknown, platform: NodeJS.Platform): boolean {
  if (platform !== "win32") return false;
  const code = (error as NodeJS.ErrnoException).code;
  return code === "EPERM" || code === "EBUSY";
}

async function renameAtomicFile(
  tempPath: string,
  filePath: string,
  runtime: AtomicFileRuntime,
): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await runtime.rename(tempPath, filePath);
      return;
    } catch (error) {
      const delay = WINDOWS_RENAME_RETRY_DELAYS_MS[attempt];
      if (delay === undefined || !isTransientWindowsRenameError(error, runtime.platform)) {
        throw error;
      }
      await runtime.sleep(delay);
    }
  }
}

export async function writeFileAtomic(
  filePath: string,
  data: string | NodeJS.ArrayBufferView,
  runtime: AtomicFileRuntime = defaultRuntime,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`,
  );
  try {
    await fs.writeFile(tempPath, data, "utf8");
    await renameAtomicFile(tempPath, filePath, runtime);
  } catch (error) {
    await fs.rm(tempPath, { force: true });
    throw error;
  }
}

export async function writeJsonFileAtomic(filePath: string, value: unknown): Promise<void> {
  await writeFileAtomic(filePath, JSON.stringify(value, null, 2));
}
