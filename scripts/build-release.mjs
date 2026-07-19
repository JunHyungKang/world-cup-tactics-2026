import { createHash } from "node:crypto";
import { spawnSync, execFileSync } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { computeBuildDigest, FINAL_DEADLINE, runReleaseVerification } from "./lib/final-submission.mjs";

const flagIndex = process.argv.indexOf("--release-commit");
const releaseCommit = flagIndex >= 0 ? process.argv[flagIndex + 1] : undefined;
if (!/^[0-9a-f]{40}$/u.test(releaseCommit ?? "")) throw new Error("pass --release-commit with the full release HEAD SHA");

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 12)) throw new Error("release build requires Node 22.12+; use the bundled Node 24 runtime");
const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (head !== releaseCommit) throw new Error("release build must run while HEAD is the release commit");
const status = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
if (status) throw new Error("release build requires a clean working tree");
const trackedRaw = execFileSync("git", ["ls-files", "data/raw"], { encoding: "utf8" })
  .trim().split("\n").filter(Boolean).filter((path) => path !== "data/raw/.gitkeep");
if (trackedRaw.length) throw new Error(`release build refuses tracked raw data: ${trackedRaw.join(", ")}`);
const commitEpoch = Number(execFileSync("git", ["show", "-s", "--format=%ct", releaseCommit], { encoding: "utf8" }).trim());
if (commitEpoch * 1000 > Date.parse(FINAL_DEADLINE)) throw new Error("release commit is after the submission deadline");

runReleaseVerification();
const postVerifyStatus = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
if (postVerifyStatus) throw new Error("pnpm verify mutated the clean release source/evidence worktree");

await rm("dist", { recursive: true, force: true });
for (const command of [
  ["scripts/check-eligibility.mjs", ["--promotion"]],
  ["node_modules/typescript/bin/tsc", ["-b"]],
  ["node_modules/vite/bin/vite.js", ["build"]],
]) {
  const result = spawnSync(process.execPath, [command[0], ...command[1]], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const build = await computeBuildDigest("dist");
const sourceTree = execFileSync("git", ["rev-parse", `${releaseCommit}^{tree}`], { encoding: "utf8" }).trim();
const eligibilityBindings = {};
for (const path of [
  "docs/data-scope-resolution.json",
  "docs/official-state.md",
  "docs/organizer-data-scope-question.md",
  "docs/product-thesis.md",
  "docs/planning-outline.md",
  "data/source-manifest.json",
  "docs/product-selection.json",
]) {
  eligibilityBindings[path] = createHash("sha256").update(await readFile(path)).digest("hex");
}
const eligibilityState = JSON.parse(await readFile("docs/data-scope-resolution.json", "utf8"));
const marker = {
  schemaVersion: 1,
  releaseCommit,
  sourceTree,
  buildSha256: build.buildSha256,
  fileCount: build.fileCount,
  files: build.files,
  builtAt: new Date().toISOString(),
  builder: "scripts/build-release.mjs",
  eligibilityBindings,
  productDataBinding: eligibilityState.binding.derived_binding,
};
await writeFile("dist/submission-build.json", `${JSON.stringify(marker, null, 2)}\n`, "utf8");
console.log(`[PASS] stamped release build ${releaseCommit} ${build.buildSha256}`);
