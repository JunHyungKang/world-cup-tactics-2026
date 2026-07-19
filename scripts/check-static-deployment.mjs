import { execFileSync } from "node:child_process";
import { auditStaticBuild, computeBuildDigest } from "./lib/final-submission.mjs";

const result = await auditStaticBuild("dist");
if (result.errors.length) {
  result.errors.forEach((error) => console.error(`[FAIL] ${error}`));
  process.exit(1);
}
const build = await computeBuildDigest("dist");
console.log(`[PASS] static deployment bytes: ${result.references.length} relative entry asset(s), ${build.fileCount} files, build=${build.buildSha256}`);

try {
  const remote = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  console.log(`[INFO] origin configured: ${remote}`);
} catch {
  console.log("[PENDING] external release surface: no origin remote; public GitHub and hosting remain owner/post-P0 actions");
}
console.log("[PENDING] public deployment proof: BG-12 and final preflight require the exact stamped HTTPS release");
