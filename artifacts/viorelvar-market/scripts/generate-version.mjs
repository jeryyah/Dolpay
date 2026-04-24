import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, statSync, existsSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const artifactDir = resolve(__dirname, "..");
const workspaceRoot = resolve(artifactDir, "..", "..");
const publicDir = resolve(artifactDir, "public");
const bundleName = "viorelvar-project.tar.gz";
const bundlePath = resolve(publicDir, bundleName);
const versionPath = resolve(publicDir, "version.json");
const stableFolderName = "viorelvar-project";

mkdirSync(publicDir, { recursive: true });

if (existsSync(bundlePath)) {
  rmSync(bundlePath);
}

const excludes = [
  "node_modules",
  "dist",
  ".vite",
  ".turbo",
  ".cache",
  ".pnpm-store",
  ".git",
  ".next",
  "build",
  ".replit_agent",
  ".local",
  ".upm",
  ".config",
  "tmp",
  ".tmp",
  ".vercel",
  bundleName,
];

const tarArgs = [
  ...excludes.map((e) => `--exclude='${e}'`),
  `--transform='s,^\\.,${stableFolderName},'`,
  "-czf",
  `"${bundlePath}"`,
  "-C",
  `"${workspaceRoot}"`,
  ".",
].join(" ");

execSync(`tar ${tarArgs}`, { stdio: "inherit" });

const bundleSize = statSync(bundlePath).size;
const version =
  process.env.APP_VERSION ||
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
  `v-${Date.now()}`;
const builtAt = new Date().toISOString();

writeFileSync(
  versionPath,
  JSON.stringify(
    { version, builtAt, bundleName, bundleSize },
    null,
    2,
  ) + "\n",
);

const mb = (bundleSize / (1024 * 1024)).toFixed(2);
console.log(`[generate-version] ${version} · ${mb} MB · ${bundleName}`);
