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

// On hosted builds (Netlify, etc.) we do NOT bundle the project tar.gz into the
// publish directory — it bloats the build, eats CDN bandwidth, and is shipped
// out-of-band as a GitHub Release asset instead. Set `VITE_DOWNLOAD_URL` to the
// release asset URL so the admin Download button points to it.
const skipBundle =
  process.env.SKIP_BUNDLE === "1" ||
  process.env.SKIP_BUNDLE === "true" ||
  process.env.NETLIFY === "true";

if (skipBundle) {
  const version =
    process.env.APP_VERSION ||
    process.env.COMMIT_REF?.slice(0, 12) ||
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
    `v-${Date.now()}`;
  writeFileSync(
    versionPath,
    JSON.stringify(
      {
        version,
        builtAt: new Date().toISOString(),
        bundleName,
        bundleSize: 0,
        bundleSource: "external",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`[generate-version] ${version} · bundle skipped (SKIP_BUNDLE / NETLIFY)`);
  process.exit(0);
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
