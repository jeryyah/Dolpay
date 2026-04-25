import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

const POLL_MS = Number(process.env.AUTO_PUSH_POLL_MS || 15_000);
const STABLE_CYCLES = Number(process.env.AUTO_PUSH_STABLE_CYCLES || 2);

if (!process.env.GITHUB_TOKEN) {
  console.error(
    "GITHUB_TOKEN belum diset di Replit Secrets. Watcher tidak bisa push.",
  );
  process.exit(1);
}

function ts() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function gitStatusFingerprint() {
  const res = spawnSync(
    "git",
    ["-c", "safe.directory=*", "status", "--porcelain", "-uall"],
    { cwd: ROOT, encoding: "utf8" },
  );
  if (res.status !== 0) {
    console.error(`[${ts()}] git status failed:`, res.stderr || res.stdout);
    return null;
  }
  const lines = res.stdout
    .split("\n")
    .filter((l) => {
      if (!l.trim()) return false;
      const filePath = l.slice(3);
      if (filePath.startsWith("artifacts/api-server/.data/")) return false;
      if (filePath.startsWith("attached_assets/")) return false;
      if (filePath.endsWith(".tsbuildinfo")) return false;
      if (filePath.includes("/.cache/")) return false;
      if (filePath.includes("/dist/")) return false;
      if (filePath.endsWith(".log")) return false;
      return true;
    })
    .sort();
  return lines.join("\n");
}

let pushing = false;
let lastFp = "";
let stableCount = 0;
let pendingAfterPush = false;

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
    lastFp = "";
    stableCount = 0;
    console.log(`[${ts()}] <<< Auto-push finished (exit ${code})\n`);
    if (pendingAfterPush) {
      pendingAfterPush = false;
    }
  });
}

function tick() {
  if (pushing) return;
  const fp = gitStatusFingerprint();
  if (fp === null) return;
  if (fp === "") {
    // Tidak ada perubahan
    if (lastFp !== "") {
      console.log(`[${ts()}] working tree clean`);
    }
    lastFp = "";
    stableCount = 0;
    return;
  }
  if (fp === lastFp) {
    stableCount += 1;
    if (stableCount >= STABLE_CYCLES) {
      runPush();
    }
  } else {
    const changes = fp.split("\n").length;
    console.log(
      `[${ts()}] ${changes} file change(s) detected — waiting for stability`,
    );
    lastFp = fp;
    stableCount = 1;
  }
}

console.log(
  `[${ts()}] Auto-push watcher started.\n  Polling every ${POLL_MS / 1000}s; pushes after ${STABLE_CYCLES} stable cycles (~${(POLL_MS * STABLE_CYCLES) / 1000}s of inactivity).`,
);

setInterval(tick, POLL_MS);
tick();

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
