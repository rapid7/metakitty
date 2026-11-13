import { mkdirSync, rmSync, statSync } from "node:fs";
import { dirname } from "node:path";

const POLL_INTERVAL_MS = 500;
const STALE_LOCK_MS = 10 * 60_000;
const MAX_WAIT_MS = 15 * 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Cross-process mutual exclusion via an atomically-created lock directory (`mkdirSync` throws
 * EEXIST if it's already there). Next's static export compiles each page/route server entry into
 * its own bundle, so the in-memory inFlight-promise singletons in dataset.ts/contributors-dataset.ts
 * only dedupe calls within one bundle — every other page importing the same loader during the same
 * `next build` still kicks off its own full live fetch, multiplying API load against the same rate
 * limit until one of them exhausts its retry budget. This makes everyone serialize on the same
 * cache directory instead: the first caller fetches and writes, everyone else waits then reads the
 * now-fresh cache.
 */
export async function withFileLock<T>(lockDir: string, fn: () => Promise<T>): Promise<T> {
  mkdirSync(dirname(lockDir), { recursive: true });
  const deadline = Date.now() + MAX_WAIT_MS;
  while (true) {
    try {
      mkdirSync(lockDir);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        if (Date.now() - statSync(lockDir).mtimeMs > STALE_LOCK_MS) {
          rmSync(lockDir, { recursive: true, force: true });
          continue;
        }
      } catch {
        continue;
      }
      if (Date.now() > deadline) throw new Error(`Timed out waiting for lock at ${lockDir}`);
      await sleep(POLL_INTERVAL_MS);
    }
  }
  try {
    return await fn();
  } finally {
    rmSync(lockDir, { recursive: true, force: true });
  }
}
