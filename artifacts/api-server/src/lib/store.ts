// File-based JSON KV store for Railway deployment.
// Replaces Netlify Blobs / Cloudflare KV.
//
// Data dir defaults to /data (mount a Railway Volume there for persistence).
// In dev (or when /data is not writable) falls back to ./.data inside the
// project so things still work without a volume.

import {
  promises as fs,
  existsSync,
  mkdirSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";

const PRIMARY_DIR = process.env["DATA_DIR"] || "/data";
const FALLBACK_DIR = path.resolve(process.cwd(), ".data");

let resolvedDir: string | null = null;

function resolveDir(): string {
  if (resolvedDir) return resolvedDir;
  // Try primary
  try {
    if (!existsSync(PRIMARY_DIR)) {
      mkdirSync(PRIMARY_DIR, { recursive: true });
    }
    // Test writable
    const probe = path.join(PRIMARY_DIR, ".probe");
    writeFileSync(probe, "ok");
    unlinkSync(probe);
    resolvedDir = PRIMARY_DIR;
    return resolvedDir;
  } catch {
    // Fallback (ephemeral if Railway didn't attach a volume)
    if (!existsSync(FALLBACK_DIR)) {
      mkdirSync(FALLBACK_DIR, { recursive: true });
    }
    resolvedDir = FALLBACK_DIR;
    return resolvedDir;
  }
}

// In-memory locks so concurrent writes to the same file serialize.
const locks = new Map<string, Promise<unknown>>();

async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) || Promise.resolve();
  let release: () => void = () => {};
  const next = new Promise<void>((res) => (release = res));
  locks.set(key, prev.then(() => next));
  try {
    await prev;
    return await fn();
  } finally {
    release();
    if (locks.get(key) === prev.then(() => next)) {
      locks.delete(key);
    }
  }
}

function filePath(key: string): string {
  // Sanitize: only allow [a-z0-9_-] to avoid traversal
  const safe = key.replace(/[^a-zA-Z0-9_\-]/g, "_");
  return path.join(resolveDir(), `${safe}.json`);
}

export async function getJSON<T>(key: string): Promise<T | null> {
  const fp = filePath(key);
  try {
    const buf = await fs.readFile(fp, "utf8");
    return JSON.parse(buf) as T;
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function setJSON<T>(key: string, value: T): Promise<void> {
  const fp = filePath(key);
  const tmp = `${fp}.tmp-${process.pid}-${Date.now()}`;
  await withLock(key, async () => {
    await fs.writeFile(tmp, JSON.stringify(value), "utf8");
    await fs.rename(tmp, fp);
  });
}

export async function updateJSON<T>(
  key: string,
  fn: (current: T | null) => T,
): Promise<T> {
  return withLock(key, async () => {
    const current = await getJSON<T>(key);
    const next = fn(current);
    const fp = filePath(key);
    const tmp = `${fp}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tmp, JSON.stringify(next), "utf8");
    await fs.rename(tmp, fp);
    return next;
  });
}

export function dataDir(): string {
  return resolveDir();
}
