import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const DEBOUNCE_MS = Number(process.env.AUTO_PUSH_DEBOUNCE_MS || 30_000);

const IGNORE = [
  /(^|\/)\.git(\/|$)/,
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)dist(\/|$)/,
  /(^|\/)\.cache(\/|$)/,
  /(^|\/)\.local(\/|$)/,
  /(^|\/)\.agents(\/|$)/,
  /(^|\/)\.replit-artifact(\/|$)/,
  /(^|\/)attached_assets(\/|$)/,
  /(^|\/)artifacts\/api-server\/\.data(\/|$)/,
  /\.tsbuildinfo$/,
  /\.log$/,
  /(^|\/)tmp(\/|$)/,
  /(^|\/)\.DS_Store$/,
];

function shouldIgnore(rel) {
  if (!rel) return true;
  return IGNORE.some((re) => re.test(rel));
}

function ts() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

let pushing = false;
let pendingAfterPush = false;
let timer = null;

function runPush() {
  if (pushing) {
    pendingAfterPush = true;
    return;
  }
  pushing = true;
  console.log(`[${ts()}] >>> Auto-push triggered`);
  const child = spawn("bash", ["scripts/push-to-github.sh"], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code) => {
    pushing = false;
    console.log(`[${ts()}] <<< Auto-push finished (exit ${code})\n`);
    if (pendingAfterPush) {
      pendingAfterPush = false;
      schedulePush();
    }
  });
}

function schedulePush() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    runPush();
  }, DEBOUNCE_MS);
}

if (!process.env.GITHUB_TOKEN) {
  console.error(
    "GITHUB_TOKEN belum diset di Replit Secrets. Watcher tidak bisa push.",
  );
  process.exit(1);
}

console.log(
  `[${ts()}] Watching ${ROOT}\n  debounce: ${DEBOUNCE_MS / 1000}s of inactivity before pushing.\n  Press the workflow stop button to disable.`,
);

try {
  fs.watch(
    ROOT,
    { recursive: true, persistent: true },
    (eventType, filename) => {
      if (!filename) return;
      const rel = filename.replaceAll("\\", "/");
      if (shouldIgnore(rel)) return;
      console.log(`[${ts()}] change: ${rel}`);
      schedulePush();
    },
  );
} catch (err) {
  console.error("fs.watch failed:", err);
  process.exit(1);
}

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));

// Keep alive
setInterval(() => {}, 1 << 30);
