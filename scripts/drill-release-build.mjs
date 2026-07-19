import { execFileSync, spawnSync } from "node:child_process";
import { cp, lstat, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { assertSnapshotSourceEntry, computeBuildDigest, computeWorktreeEvidenceDigest } from "./lib/final-submission.mjs";

const root = process.cwd();
const before = await computeWorktreeEvidenceDigest({ cwd: root });
const drillRoot = await mkdtemp(join(tmpdir(), "corner-release-drill-"));

function git(args, options = {}) {
  return execFileSync("git", args, { cwd: drillRoot, encoding: "utf8", ...options }).trim();
}

async function copyEvidencePath(path) {
  const source = join(root, path);
  const target = join(drillRoot, path);
  await mkdir(dirname(target), { recursive: true });
  const info = await lstat(source);
  assertSnapshotSourceEntry(path, info);
  await cp(source, target, { preserveTimestamps: true });
}

let drillSummary;
try {
  const paths = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], {
    cwd: root, encoding: "buffer",
  }).toString("utf8").split("\0").filter(Boolean).sort();
  for (const path of paths) await copyEvidencePath(path);

  git(["init", "-q"]);
  git(["config", "user.name", "Corner Release Drill"]);
  git(["config", "user.email", "release-drill@invalid.local"]);
  git(["config", "commit.gpgsign", "false"]);
  git(["add", "-A"]);
  git(["commit", "-q", "-m", "Synthetic local release drill"]);
  const releaseCommit = git(["rev-parse", "HEAD"]);

  if (!process.env.npm_execpath) throw new Error("release drill must be launched through pnpm");
  const install = spawnSync(process.execPath, [process.env.npm_execpath, "install", "--frozen-lockfile", "--ignore-scripts"], {
    cwd: drillRoot, encoding: "utf8",
  });
  if (install.status !== 0) {
    throw new Error(`fresh frozen-lock dependency install failed in isolated clean snapshot:\n${install.stdout}${install.stderr}`);
  }
  const result = spawnSync(process.execPath, ["scripts/build-release.mjs", "--release-commit", releaseCommit], {
    cwd: drillRoot, encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`release builder failed in isolated clean snapshot:\n${result.stdout}${result.stderr}`);
  }

  const [marker, build] = await Promise.all([
    readFile(join(drillRoot, "dist/submission-build.json"), "utf8").then(JSON.parse),
    computeBuildDigest(join(drillRoot, "dist")),
  ]);
  const sourceTree = git(["rev-parse", `${releaseCommit}^{tree}`]);
  const errors = [];
  if (marker.releaseCommit !== releaseCommit) errors.push("marker release commit drifted");
  if (marker.sourceTree !== sourceTree) errors.push("marker source tree drifted");
  if (marker.buildSha256 !== build.buildSha256) errors.push("marker build digest drifted");
  if (marker.fileCount !== build.fileCount || JSON.stringify(marker.files) !== JSON.stringify(build.files)) {
    errors.push("marker file manifest drifted");
  }
  if (git(["status", "--porcelain"]).split("\n").filter((line) => line && !line.includes(" dist/")).length) {
    errors.push("isolated source tree changed during release build");
  }
  if (errors.length) throw new Error(errors.join("; "));
  drillSummary = `${paths.length} source/evidence file(s), fresh frozen-lock install PASS, release-builder raw-free pnpm verify PASS, ${build.fileCount} release file(s), build=${build.buildSha256}`;
} finally {
  await rm(drillRoot, { recursive: true, force: true });
  const after = await computeWorktreeEvidenceDigest({ cwd: root });
  if (after.sha256 !== before.sha256 || after.fileCount !== before.fileCount || JSON.stringify(after.paths) !== JSON.stringify(before.paths)) {
    throw new Error("release drill mutated the real tracked/nonignored worktree");
  }
}

console.log(`[PASS] isolated clean-clone release drill: ${drillSummary}`);
console.log("[BOUNDARY] the synthetic commit, fresh dependencies, and dist were deleted; this is not a public release, BG-12, or submission receipt");
